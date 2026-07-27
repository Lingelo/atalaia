/**
 * Client NASA FIRMS — détections thermiques satellite.
 *
 * ⚠️ NATURE DE LA DONNÉE, à ne jamais confondre avec les incidents ANEPC.
 *
 * fogos.pt diffuse de la donnée OPÉRATIONNELLE de terrain : des pompiers ont été
 * dépêchés, on connaît leur nombre, le statut du sinistre, sa chronologie.
 *
 * FIRMS diffuse une ANOMALIE THERMIQUE vue depuis l'orbite. On a un point, une
 * puissance radiative, une heure de passage du satellite. Rien d'autre : pas de
 * nom de lieu, pas de statut, pas de moyens engagés. S'y ajoutent 3 h de latence
 * et des faux positifs réguliers (torchères industrielles, brûlage agricole).
 *
 * Les deux ne doivent donc jamais être fusionnés dans une même liste ni dans un
 * même total : la France afficherait « 0 opérationnel » partout, et l'utilisateur
 * en conclurait qu'elle brûle moins que le Portugal. Ce serait un artefact du
 * modèle de données, pas la réalité.
 */

import type { SatelliteDetection } from '../types';

const API_BASE = '/api/firms';

/**
 * Trois satellites porteurs de l'instrument VIIRS. On les interroge tous les
 * trois pour la couverture, puis on regroupe : ils survolent les mêmes zones et
 * détectent donc le MÊME feu jusqu'à trois fois.
 *
 * MODIS est volontairement écarté : son schéma de confiance est numérique (0-100)
 * là où VIIRS est catégoriel, et sa résolution est quatre fois plus grossière.
 * Mélanger les deux imposerait une normalisation pour un gain marginal.
 */
export const VIIRS_SOURCES = [
  '/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Europe_24h.csv',
  '/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Europe_24h.csv',
  '/data/active_fire/noaa-21-viirs-c2/csv/J2_VIIRS_C2_Europe_24h.csv',
];

/**
 * Emprise couvrant la Péninsule Ibérique et la France métropolitaine.
 * Le fichier amont couvre toute l'Europe : sans ce filtre on chargerait l'Oural.
 *
 * ⚠️ C'est un RECTANGLE, il ne peut pas épouser des frontières. Descendre assez
 * bas pour inclure Tarifa (36,0° N) fait forcément entrer la côte maghrébine
 * (Alger est à 36,7° N) ; s'étendre assez à l'est pour la Corse fait entrer
 * l'Italie du Nord. Découper au pays exigerait un test point-dans-polygone sur
 * les frontières, coûteux pour un gain faible. On assume donc le débordement, à
 * une condition : que l'interface ne prétende PAS afficher seulement trois pays.
 * Voir le libellé de SatelliteLayerControl.
 */
const BBOX = { minLat: 35.8, maxLat: 51.3, minLng: -10.0, maxLng: 9.6 };

/**
 * Taille de cellule du regroupement, en degrés. 0,01° ≈ 1,1 km — l'ordre de
 * grandeur de l'empreinte au sol d'un pixel VIIRS (375 m) plus la marge de
 * géolocalisation. Deux détections dans la même cellule sont considérées comme
 * le même foyer.
 */
const CLUSTER_DEG = 0.01;

interface FirmsRow {
  latitude: number;
  longitude: number;
  acq_date: string;
  acq_time: string;
  satellite: string;
  confidence: string;
  frp: number;
  daynight: string;
}

/**
 * Parse un CSV FIRMS.
 *
 * Découpage naïf sur la virgule, ce qui est ici légitime : le format FIRMS ne
 * contient ni guillemets ni virgules dans les valeurs — que des nombres et des
 * codes courts. Un parseur CSV complet serait une dépendance pour rien.
 */
export function parseFirmsCsv(csv: string): FirmsRow[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const index = (name: string) => headers.indexOf(name);

  const iLat = index('latitude');
  const iLng = index('longitude');
  const iDate = index('acq_date');
  const iTime = index('acq_time');
  const iSat = index('satellite');
  const iConf = index('confidence');
  const iFrp = index('frp');
  const iDay = index('daynight');

  if (iLat < 0 || iLng < 0) return [];

  const rows: FirmsRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i].split(',');
    const latitude = Number(cells[iLat]);
    const longitude = Number(cells[iLng]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    rows.push({
      latitude,
      longitude,
      acq_date: cells[iDate] ?? '',
      acq_time: cells[iTime] ?? '',
      satellite: cells[iSat] ?? '',
      confidence: (cells[iConf] ?? '').trim(),
      frp: Number(cells[iFrp]) || 0,
      daynight: cells[iDay] ?? '',
    });
  }
  return rows;
}

/** `acq_date` "2026-07-26" + `acq_time` "0134" → millisecondes epoch (UTC). */
function toTimestamp(row: FirmsRow): number {
  const padded = row.acq_time.padStart(4, '0');
  const iso = `${row.acq_date}T${padded.slice(0, 2)}:${padded.slice(2, 4)}:00Z`;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function inBbox(row: FirmsRow): boolean {
  return (
    row.latitude >= BBOX.minLat &&
    row.latitude <= BBOX.maxLat &&
    row.longitude >= BBOX.minLng &&
    row.longitude <= BBOX.maxLng
  );
}

/**
 * Regroupe les détections proches en foyers uniques.
 *
 * On conserve la détection la plus puissante de chaque cellule comme
 * représentante, et on compte les autres : ce décompte est une information utile
 * (plusieurs passages successifs = foyer persistant), pas seulement du bruit à
 * masquer.
 */
export function clusterDetections(rows: FirmsRow[]): SatelliteDetection[] {
  const cells = new Map<string, FirmsRow[]>();

  for (const row of rows) {
    const key = `${Math.round(row.latitude / CLUSTER_DEG)}:${Math.round(row.longitude / CLUSTER_DEG)}`;
    const bucket = cells.get(key);
    if (bucket) bucket.push(row);
    else cells.set(key, [row]);
  }

  const detections: SatelliteDetection[] = [];
  for (const [key, bucket] of cells) {
    const strongest = bucket.reduce((best, row) => (row.frp > best.frp ? row : best), bucket[0]);
    const latest = bucket.reduce(
      (best, row) => (toTimestamp(row) > toTimestamp(best) ? row : best),
      bucket[0]
    );

    detections.push({
      kind: 'satellite',
      id: `firms-${key}`,
      lat: strongest.latitude,
      lng: strongest.longitude,
      detectedAt: toTimestamp(latest),
      /** Puissance radiative en mégawatts : le seul indicateur d'intensité disponible. */
      frpMw: strongest.frp,
      confidence:
        strongest.confidence === 'high'
          ? 'high'
          : strongest.confidence === 'low'
            ? 'low'
            : 'nominal',
      passes: bucket.length,
      satellites: Array.from(new Set(bucket.map((row) => row.satellite))).sort(),
    });
  }

  // Les foyers les plus puissants en premier : c'est l'ordre de tracé, donc les
  // plus significatifs restent au-dessus en cas de superposition.
  return detections.sort((a, b) => b.frpMw - a.frpMw);
}

/**
 * Pipeline pur : CSV bruts → foyers regroupés.
 *
 * Extrait de la fonction de chargement pour être réutilisable hors navigateur —
 * le script de build s'en sert pour précalculer les données destinées à
 * GitHub Pages, où aucun serveur ne peut relayer FIRMS (voir plus bas).
 */
export function processFirmsCsvs(csvTexts: string[]): SatelliteDetection[] {
  const rows = csvTexts
    .flatMap(parseFirmsCsv)
    .filter(inBbox)
    // Les détections « low » sont majoritairement des faux positifs (surfaces
    // chaudes, réverbération). Les afficher sur une carte de sécurité publique
    // reviendrait à annoncer des feux qui n'existent pas.
    .filter((row) => row.confidence !== 'low');

  return clusterDetections(rows);
}

/**
 * Emplacement du jeu précalculé, en production.
 *
 * FIRMS ne renvoie AUCUN en-tête CORS : un navigateur ne peut donc pas
 * l'interroger directement depuis un site statique. Les données sont produites
 * au build par une GitHub Action planifiée, ce qui a deux vertus : ça contourne
 * l'absence de serveur, et ça épargne à la NASA un téléchargement de 900 Ko par
 * visiteur. La fraîcheur (quelques heures) correspond de toute façon à la
 * cadence de repassage des satellites.
 */
function prebuiltUrl(): string {
  // Évalué à l'appel et non au chargement du module : `import.meta.env` n'existe
  // que sous Vite, or ce fichier est aussi importé par le script de build Node,
  // qui ne réutilise que les fonctions pures.
  return `${import.meta.env.BASE_URL}data/firms.json`;
}

export async function fetchSatelliteDetections(
  signal?: AbortSignal
): Promise<SatelliteDetection[]> {
  // En production (site statique), on lit le jeu précalculé.
  if (!import.meta.env.DEV) {
    const response = await fetch(prebuiltUrl(), { signal });
    if (!response.ok) throw new Error('Serviço de deteção por satélite indisponível.');
    return (await response.json()) as SatelliteDetection[];
  }

  // `allSettled` et non `all` : si un satellite est indisponible, on affiche les
  // deux autres plutôt que de perdre toute la couche.
  const results = await Promise.allSettled(
    VIIRS_SOURCES.map(async (path) => {
      const response = await fetch(`${API_BASE}${path}`, { signal });
      if (!response.ok) throw new Error(`FIRMS ${response.status}`);
      return parseFirmsCsv(await response.text());
    })
  );

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  if (results.every((r) => r.status === 'rejected')) {
    throw new Error('Serviço de deteção por satélite indisponível.');
  }

  const rows = results
    .filter((r): r is PromiseFulfilledResult<FirmsRow[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value)
    .filter(inBbox)
    .filter((row) => row.confidence !== 'low');

  return clusterDetections(rows);
}
