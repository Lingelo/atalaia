import L from 'leaflet';

import type { SatelliteDetection } from '../../types';
import { SpatialIndex } from './spatialIndex';

/**
 * Nappe de densité pour les détections satellite.
 *
 * POURQUOI une nappe plutôt que des points, aux échelles larges :
 *
 * Un anneau posé à une position précise AFFIRME « il y a un feu, ici ». FIRMS ne
 * sait pas cela. Il sait qu'un pixel de 375 m a émis un rayonnement anormal, avec
 * une marge de géolocalisation et environ trois heures de latence. Afficher un
 * millier de points distincts revendique une précision que la donnée n'a pas.
 *
 * Une nappe dit ce que la mesure dit réellement : « activité thermique diffuse
 * dans cette zone ». Le flou n'est pas un défaut de rendu, c'est l'information.
 *
 * DÉGRADÉ VIOLET, JAMAIS ROUGE-ORANGE. Les dégradés de chaleur habituels vont du
 * jaune au rouge, exactement la palette réservée aux statuts opérationnels. Une
 * tache rouge sous un marqueur rouge annulerait la séparation entre donnée de
 * terrain vérifiée et détection non confirmée. C'est une contrainte de lisibilité,
 * pas un choix esthétique.
 *
 * Écrit à la main plutôt qu'avec un greffon : le besoin tient en une centaine de
 * lignes, et le projet vient d'être débarrassé de neuf dépendances inutilisées.
 */

/** Rayon d'influence au sol d'une détection, en mètres. */
const GROUND_RADIUS_M = 9000;

/** Bornes en pixels : en deçà la nappe se pixellise, au-delà elle noie la carte. */
const MIN_RADIUS_PX = 7;
const MAX_RADIUS_PX = 64;

const OPACITY = 0.72;

/** Marge hors écran, pour que les nappes entrent progressivement au déplacement. */
const PADDING_PX = 80;

/**
 * Construit la table de correspondance densité → couleur (256 entrées).
 * Du violet profond presque transparent au lilas clair pour les foyers denses.
 */
function buildPalette(): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new Uint8ClampedArray(256 * 4);

  const gradient = ctx.createLinearGradient(0, 0, 256, 0);
  gradient.addColorStop(0.0, 'rgba(76, 29, 149, 0)');
  gradient.addColorStop(0.25, 'rgba(91, 33, 182, 0.75)');
  gradient.addColorStop(0.5, 'rgba(124, 58, 237, 0.9)');
  gradient.addColorStop(0.75, 'rgba(167, 139, 250, 0.95)');
  gradient.addColorStop(1.0, 'rgba(233, 213, 255, 1)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 1);
  return ctx.getImageData(0, 0, 256, 1).data;
}

export class SatelliteHeatLayer extends L.Layer {
  /**
   * Index reconstruit à chaque changement de jeu, jamais à chaque redessin :
   * indexer 86 000 foyers coûte quelques millisecondes, les redessins sont
   * beaucoup plus fréquents que les rafraîchissements de données.
   */
  private index: SpatialIndex<SatelliteDetection>;
  private canvas: HTMLCanvasElement | null = null;
  private palette: Uint8ClampedArray | null = null;
  private frame: number | null = null;
  /**
   * Puissance maximale du jeu ENTIER, pas de la portion visible.
   *
   * ⚠️ La calculer sur les seuls foyers à l'écran ferait varier l'échelle de
   * couleur au fil des déplacements : un feu modeste paraîtrait intense dès
   * qu'on cadre une région calme. La densité doit rester comparable d'une vue à
   * l'autre.
   */
  private maxFrp = 1;

  constructor(detections: SatelliteDetection[]) {
    super();
    this.index = new SpatialIndex(detections);
    this.maxFrp = detections.reduce((max, d) => Math.max(max, d.frpMw), 1);
  }

  setDetections(detections: SatelliteDetection[]): void {
    this.index = new SpatialIndex(detections);
    this.maxFrp = detections.reduce((max, d) => Math.max(max, d.frpMw), 1);
    this.scheduleRedraw();
  }

  onAdd(map: L.Map): this {
    this.palette ??= buildPalette();

    const canvas = L.DomUtil.create('canvas', 'leaflet-layer satellite-heat') as HTMLCanvasElement;
    canvas.style.pointerEvents = 'none';
    this.canvas = canvas;

    map.getPanes().overlayPane.appendChild(canvas);
    map.on('moveend zoomend resize', this.scheduleRedraw, this);
    // Pendant un zoom animé, la nappe est masquée : la redessiner à chaque image
    // coûterait cher pour un résultat qui glisse de toute façon.
    map.on('zoomanim', this.hide, this);

    this.scheduleRedraw();
    return this;
  }

  onRemove(map: L.Map): this {
    map.off('moveend zoomend resize', this.scheduleRedraw, this);
    map.off('zoomanim', this.hide, this);
    this.canvas?.remove();
    this.canvas = null;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    return this;
  }

  private hide(): void {
    if (this.canvas) this.canvas.style.opacity = '0';
  }

  private scheduleRedraw = (): void => {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.redraw();
    });
  };

  private redraw(): void {
    const map = this._map;
    const canvas = this.canvas;
    const palette = this.palette;
    if (!map || !canvas || !palette) return;

    const size = map.getSize();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = size.x * dpr;
    canvas.height = size.y * dpr;
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;
    canvas.style.opacity = String(OPACITY);

    // Le canvas couvre le viewport : on le replace à l'origine du conteneur,
    // que la couche overlay décale au gré des déplacements.
    L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));

    // `willReadFrequently` : la passe de colorisation relit le canvas via
    // getImageData à chaque redessin. Sans cet indicateur, le navigateur garde le
    // tampon sur le GPU et chaque lecture impose un aller-retour coûteux.
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size.x, size.y);

    // Rayon dérivé d'une distance au SOL, pour que la nappe garde un sens
    // géographique constant quel que soit le zoom.
    const center = map.getCenter();
    const metersPerPixel =
      (40075016.686 * Math.cos((center.lat * Math.PI) / 180)) / (256 * Math.pow(2, map.getZoom()));
    const radius = Math.max(
      MIN_RADIUS_PX,
      Math.min(MAX_RADIUS_PX, GROUND_RADIUS_M / metersPerPixel)
    );

    // Passe 1 : accumulation en niveaux de gris. `lighter` fait s'additionner les
    // contributions, ce qui produit la densité.
    ctx.globalCompositeOperation = 'lighter';

    const maxFrp = this.maxFrp;

    // Seuls les foyers dont la cellule recoupe l'écran sont projetés. Sur un jeu
    // mondial zoomé sur une région, cela remplace 86 000 projections par
    // quelques centaines.
    const bounds = map.getBounds().pad(0.3);
    const visible = this.index.within(
      bounds.getSouth(),
      bounds.getWest(),
      bounds.getNorth(),
      bounds.getEast()
    );

    for (const detection of visible) {
      const point = map.latLngToContainerPoint([detection.lat, detection.lng]);
      if (
        point.x < -PADDING_PX ||
        point.y < -PADDING_PX ||
        point.x > size.x + PADDING_PX ||
        point.y > size.y + PADDING_PX
      ) {
        continue;
      }

      // Poids par racine quatrième de la puissance : elle s'étale sur trois ordres
      // de grandeur, une pondération linéaire ferait disparaître les petits foyers.
      const weight = Math.min(1, 0.25 + Math.pow(detection.frpMw / maxFrp, 0.25) * 0.75);

      const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
      gradient.addColorStop(0, `rgba(255,255,255,${weight})`);
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Passe 2 : la densité accumulée (canal alpha) est convertie en couleur.
    ctx.globalCompositeOperation = 'source-over';
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = image.data;

    for (let i = 0; i < pixels.length; i += 4) {
      const density = pixels[i + 3];
      if (density === 0) continue;

      const offset = density * 4;
      pixels[i] = palette[offset];
      pixels[i + 1] = palette[offset + 1];
      pixels[i + 2] = palette[offset + 2];
      pixels[i + 3] = palette[offset + 3];
    }

    ctx.putImageData(image, 0, 0);
  }
}
