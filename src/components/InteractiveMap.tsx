import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Incident, WatchZone, MapTileLayer, SatelliteDetection, ViewScope } from '../types';
import { resolvePhase } from '../lib/status';
import { formatTimeAgo } from '../lib/time';
import { SatelliteHeatLayer } from './map/SatelliteHeatLayer';
import { SpatialIndex } from './map/spatialIndex';
import { useI18n } from '../i18n/context';
import type { TranslationKey } from '../i18n/pt';

/**
 * Seuil de bascule nappe → anneaux individuels.
 *
 * Niveau 9 ≈ échelle d'un district : en deçà on regarde un pays et la densité
 * est la bonne lecture ; au-delà on regarde une vallée et le détail par foyer
 * (puissance, satellites, nombre de passages) redevient pertinent.
 */
const DETAIL_ZOOM = 9;

/**
 * Teinte d'un foyer satellite selon l'ANCIENNETÉ de sa détection.
 *
 * POURQUOI graduer, et pourquoi par la fraîcheur plutôt que par la puissance :
 *
 * Le jeu VIIRS couvre 24 heures glissantes. Des anneaux uniformes y mettent sur
 * le même plan un foyer vu il y a une heure et un autre vu la veille — or c'est
 * précisément la distinction utile : « où ça brûle MAINTENANT ». La puissance,
 * elle, est déjà portée par le RAYON de l'anneau ; la coder aussi en couleur
 * ferait doublon.
 *
 * ⚠️ La gamme reste dans la BRAISE, du plus vif au plus éteint, et ne croise à
 * aucun moment la palette des statuts opérationnels (orange #f97316, rouge
 * #ef4444, ambre #fbbf24, jaune #eab308). Une détection graduée reste une
 * détection : elle n'emprunte pas la sémantique d'un sinistre confirmé, où le
 * vert dit « éteint » et le rouge « en cours ». Ici rien n'est éteint — le
 * satellite ne sait pas si un feu a été combattu, seulement qu'il rayonnait au
 * moment du passage.
 */
function emberColor(detectedAt: number, now: number): string {
  const hours = (now - detectedAt) / 3_600_000;

  if (hours < 3) return '#fdba74';
  if (hours < 6) return '#fb923c';
  if (hours < 12) return '#ea580c';
  if (hours < 24) return '#c2410c';
  return '#7c2d12';
}

interface InteractiveMapProps {
  incidents: Incident[];
  watchZones: WatchZone[];
  selectedIncidentId?: string | null;
  onSelectIncident: (incident: Incident) => void;
  tileLayerType: MapTileLayer;
  onChangeTileLayer: (layer: MapTileLayer) => void;
  /** Couche satellite, distincte des incidents opérationnels. Voir src/api/firms.ts. */
  satelliteDetections?: SatelliteDetection[];
  showSatellite?: boolean;
  /** Cadrage initial de la carte. Le mode Monde ne s'ouvre pas sur le Portugal. */
  scope?: ViewScope;
  isPickerMode?: boolean;
  pickerPos?: { lat: number; lng: number; radiusKm: number };
  onPickerPosChange?: (lat: number, lng: number) => void;
  /**
   * Interrupteur de la couche satellite, rendu dans le menu des fonds de carte.
   *
   * Passé en `ReactNode` plutôt que reconstruit ici : l'état de la couche, son
   * chargement et son compteur appartiennent à `App`, et la carte n'a pas à les
   * connaître pour loger la commande au bon endroit.
   */
  satelliteControl?: React.ReactNode;
  className?: string;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  incidents,
  watchZones,
  selectedIncidentId,
  onSelectIncident,
  tileLayerType,
  onChangeTileLayer,
  satelliteDetections = [],
  showSatellite = false,
  scope = 'iberia',
  isPickerMode = false,
  pickerPos,
  onPickerPosChange,
  satelliteControl,
  className = 'w-full h-full',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const polygonsGroupRef = useRef<L.LayerGroup | null>(null);
  const zonesGroupRef = useRef<L.LayerGroup | null>(null);
  const satelliteGroupRef = useRef<L.LayerGroup | null>(null);
  /**
   * Rendu canvas réservé à la couche satellite : elle compte ~1 100 foyers, là
   * où le SVG par défaut de Leaflet crée un nœud DOM par marqueur et s'effondre
   * à cette échelle.
   */
  const canvasRendererRef = useRef<L.Canvas | null>(null);
  const pickerMarkerRef = useRef<L.Circle | null>(null);
  const heatLayerRef = useRef<SatelliteHeatLayer | null>(null);
  const satelliteIndexRef = useRef<SpatialIndex<SatelliteDetection> | null>(null);
  const { t, intlTag } = useI18n();
  const [zoom, setZoom] = useState(7);
  /** Incrémenté à chaque déplacement : redéclenche le filtrage des anneaux. */
  const [moveTick, setMoveTick] = useState(0);
  /** Suivi de la géolocalisation, pour en rendre compte plutôt que d'échouer en silence. */
  const [locateStatus, setLocateStatus] = useState<
    'idle' | 'searching' | 'denied' | 'unavailable' | 'timeout'
  >('idle');
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Tile layer URLs
  const getTileUrl = (type: MapTileLayer) => {
    switch (type) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'terrain':
        return 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      case 'dark':
      default:
        return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    }
  };

  const getTileAttribution = (type: MapTileLayer) => {
    switch (type) {
      case 'satellite':
        return '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
      case 'terrain':
        return 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)';
      case 'dark':
      default:
        return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
    }
  };

  /**
   * Options propres à chaque fond.
   *
   * `maxZoom` n'est PAS uniforme, contrairement à ce qu'on faisait : OpenTopoMap
   * ne publie rien au-delà du niveau 17. Annoncer 19 laissait l'utilisateur
   * zoomer sur deux niveaux de tuiles inexistantes — une carte grise, sans
   * message, qu'on ne peut interpréter que comme une panne.
   *
   * `className` porte le traitement visuel défini dans `index.css`. Seul le fond
   * topographique en reçoit un : il est clair et dense, et sans atténuation les
   * marqueurs de statut cessent d'être ce que l'œil voit en premier.
   */
  const getTileOptions = (type: MapTileLayer): { maxZoom: number; className?: string } => {
    switch (type) {
      case 'satellite':
        return { maxZoom: 19 };
      case 'terrain':
        return { maxZoom: 17, className: 'atalaia-tiles-terrain' };
      case 'dark':
      default:
        return { maxZoom: 19 };
    }
  };

  // Couleur de statut : voir le registre unique dans src/lib/status.ts.

  // Initialize map instance
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [39.5, -8.0],
        zoom: 7,
        zoomControl: false,
        attributionControl: false,
      });

      const tileLayer = L.tileLayer(getTileUrl(tileLayerType), {
        ...getTileOptions(tileLayerType),
        attribution: getTileAttribution(tileLayerType),
      }).addTo(map);

      tileLayerRef.current = tileLayer;
      canvasRendererRef.current = L.canvas({ padding: 0.3 });

      // Ordre d'ajout = ordre d'empilement. La couche satellite est posée en
      // premier : les incidents opérationnels, seule donnée de terrain vérifiée,
      // doivent toujours rester au-dessus.
      satelliteGroupRef.current = L.layerGroup().addTo(map);
      markersGroupRef.current = L.layerGroup().addTo(map);
      polygonsGroupRef.current = L.layerGroup().addTo(map);
      zonesGroupRef.current = L.layerGroup().addTo(map);

      mapRef.current = map;
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      // Toutes ces couches appartenaient à la carte qu'on vient de détruire.
      // Les oublier explicitement est ce qui rend l'effet REJOUABLE : sans cette
      // remise à zéro, un second passage retrouve `heatLayerRef` non vide, en
      // conclut que la nappe est déjà posée, et ne la rattache jamais à la
      // nouvelle carte — la couche satellite disparaît alors sans erreur.
      // C'est exactement ce que StrictMode provoque en développement.
      tileLayerRef.current = null;
      canvasRendererRef.current = null;
      satelliteGroupRef.current = null;
      markersGroupRef.current = null;
      polygonsGroupRef.current = null;
      zonesGroupRef.current = null;
      heatLayerRef.current = null;
      pickerMarkerRef.current = null;
    };
  }, []);

  /**
   * Recalcule la taille de la carte quand son CONTENEUR change, et pas
   * seulement quand la fenêtre change.
   *
   * ⚠️ Leaflet n'écoute que `window.resize`. Replier la colonne de gauche élargit
   * le conteneur sans toucher à la fenêtre : la carte gardait donc en mémoire son
   * ancienne largeur, ne demandait aucune tuile pour la bande libérée, et
   * laissait une zone noire à droite. Rien dans l'interface ne permettait de
   * comprendre pourquoi.
   *
   * Le `requestAnimationFrame` fusionne les notifications : la colonne se replie
   * par une transition de 300 ms, l'observateur se déclenche donc à chaque image,
   * et recalculer les tuiles autant de fois serait du gaspillage.
   */
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    let frame: number | null = null;
    const observer = new ResizeObserver(() => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        // `animate: false` : on suit un redimensionnement en cours, pas un
        // déplacement. Une animation par image se verrait comme un tremblement.
        mapRef.current?.invalidateSize({ animate: false, pan: false });
      });
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  // Handle tile layer changes
  useEffect(() => {
    if (!mapRef.current) return;
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }

    const newTileLayer = L.tileLayer(getTileUrl(tileLayerType), {
      ...getTileOptions(tileLayerType),
      attribution: getTileAttribution(tileLayerType),
    }).addTo(mapRef.current);

    tileLayerRef.current = newTileLayer;
  }, [tileLayerType]);

  // Handle Map Click in Picker Mode
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (isPickerMode && onPickerPosChange) {
        onPickerPosChange(e.latlng.lat, e.latlng.lng);
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [isPickerMode, onPickerPosChange]);

  // Render Incidents (Markers & Burned Polygons)
  useEffect(() => {
    if (!mapRef.current || !markersGroupRef.current || !polygonsGroupRef.current) return;

    markersGroupRef.current.clearLayers();
    polygonsGroupRef.current.clearLayers();

    if (isPickerMode) return;

    incidents.forEach((inc) => {
      const isSelected = inc.id === selectedIncidentId;
      const meta = resolvePhase(inc.phase);
      const color = meta.color;

      // Taille du marqueur : racine carrée des effectifs, pour que l'aire du disque
      // reste proportionnelle aux moyens engagés. Plancher à 16 px pour qu'un feu
      // à 1 opérationnel reste visible et cliquable.
      //
      // ⚠️ `personnel` vaut `null` chez les services qui ne le publient pas. Un
      // marqueur dimensionné à 0 y serait le plus PETIT de la carte, donnant à
      // lire « incident négligeable » là où on ne sait simplement pas. On rend
      // donc ces marqueurs à une taille médiane, et le disque creux ci-dessous
      // signale que le chiffre manque.
      const ops = inc.personnel;
      const size =
        ops === null ? 22 : Math.max(16, Math.min(38, Math.round(14 + Math.sqrt(ops) * 1.2)));

      // Pulsation réservée aux sinistres encore combattus.
      const pulseClass =
        inc.phase === 'active' ? 'pulse-fire' : inc.phase === 'controlled' ? 'pulse-resolucao' : '';

      const customIcon = L.divIcon({
        className: 'custom-fire-marker',
        html: `
          <div style="
            width: ${size}px;
            height: ${size}px;
            background-color: ${color};
            border-radius: 50%;
            border: 1.5px solid ${isSelected ? '#ffffff' : '#0c0e0f'};
            box-shadow: ${
              isSelected
                ? '0 0 15px 4px ' + color + ', 0 1px 4px rgba(0,0,0,0.9)'
                : '0 0 0 1px rgba(0,0,0,0.45), 0 1px 4px rgba(0,0,0,0.75)'
            };
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: transform 0.2s ease;
            transform: scale(${isSelected ? 1.2 : 1});
          " class="${pulseClass}">
            ${
              ops === null
                ? `<div style="width: 8px; height: 8px; border: 2px solid #121415; border-radius: 50%;"></div>`
                : size > 22
                  ? `<span style="font-size: ${Math.round(size * 0.45)}px; font-weight: 700; color: #121415; line-height: 1;">${ops}</span>`
                  : `<div style="width: 4px; height: 4px; background: #121415; border-radius: 50%;"></div>`
            }
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([inc.lat, inc.lng], { icon: customIcon });

      // Click event
      marker.on('click', () => {
        onSelectIncident(inc);
      });

      // Tooltip hover
      marker.bindTooltip(
        `
        <div style="padding: 2px 4px; font-family: Inter, sans-serif; font-size: 12px;">
          <div style="font-weight: 700; color: #ffffff;">${inc.title} (${inc.locationName})</div>
          <div style="color: ${color}; font-weight: 600; font-size: 11px; text-transform: uppercase;">${inc.status}</div>
          <div style="color: #babcc0; margin-top: 2px;">👥 ${inc.personnel ?? '—'} · 🚒 ${inc.vehicles ?? '—'} · ✈ ${inc.aircraft ?? '—'}</div>
        </div>
      `,
        {
          direction: 'top',
          offset: [0, -size / 2],
          opacity: 0.95,
          className: 'leaflet-custom-tooltip',
        }
      );

      markersGroupRef.current?.addLayer(marker);

      // Render Polygon if available
      if (inc.polygonCoords && inc.polygonCoords.length > 0) {
        const polygon = L.polygon(inc.polygonCoords, {
          color: color,
          weight: isSelected ? 2.5 : 1.5,
          dashArray: '4, 4',
          fillColor: color,
          fillOpacity: isSelected ? 0.25 : 0.12,
        });

        polygon.on('click', () => onSelectIncident(inc));
        polygonsGroupRef.current?.addLayer(polygon);
      }
    });
  }, [incidents, selectedIncidentId, isPickerMode, onSelectIncident]);

  // Index des foyers, reconstruit uniquement quand le jeu change.
  useEffect(() => {
    satelliteIndexRef.current = new SpatialIndex(satelliteDetections);
  }, [satelliteDetections]);

  // Suit le zoom (qui commande la bascule nappe / anneaux) et les déplacements
  // (dont dépend le filtrage des anneaux sur l'emprise visible).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const sync = () => {
      setZoom(map.getZoom());
      setMoveTick((tick) => tick + 1);
    };
    sync();
    map.on('moveend zoomend', sync);
    return () => {
      map.off('moveend zoomend', sync);
    };
  }, []);

  // Couche satellite (NASA FIRMS), en NAPPE DE DENSITÉ aux échelles larges.
  //
  // En dessous du seuil, un foyer isolé ne représente que quelques pixels : mille
  // points distincts y affirmeraient mille positions précises que la donnée ne
  // garantit pas. La nappe dit ce que la mesure dit vraiment.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const shouldShow = showSatellite && !isPickerMode && zoom < DETAIL_ZOOM;

    if (!shouldShow) {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
      return;
    }

    if (!heatLayerRef.current) {
      heatLayerRef.current = new SatelliteHeatLayer(satelliteDetections);
      heatLayerRef.current.addTo(map);
    } else {
      heatLayerRef.current.setDetections(satelliteDetections);
    }
  }, [satelliteDetections, showSatellite, isPickerMode, zoom]);

  // Couche satellite en ANNEAUX individuels, à partir du seuil de zoom.
  //
  // Distinction visuelle volontairement REDONDANTE avec la couche opérationnelle :
  //   - forme  : anneau CREUX, là où les incidents sont des disques PLEINS
  //   - teinte : braise sombre, sous le spectre chaud VIF des statuts
  // La forme seule suffit à les séparer, ce qui rend la carte lisible même en cas
  // de daltonisme. Une simple différence de couleur ne l'aurait pas garanti.
  useEffect(() => {
    if (!mapRef.current || !satelliteGroupRef.current) return;

    satelliteGroupRef.current.clearLayers();
    if (!showSatellite || isPickerMode || zoom < DETAIL_ZOOM) return;

    // Un seul instant de référence pour toute la passe : lire l'horloge par
    // foyer ferait varier la teinte au sein d'un même rendu, pour rien.
    const renderedAt = Date.now();

    // Seuls les foyers visibles sont tracés : au-delà du seuil de zoom, l'emprise
    // à l'écran n'en contient qu'une poignée sur les 86 000 du jeu mondial.
    // L'index évite d'avoir à tester les 86 000 pour en retenir trois.
    const bounds = mapRef.current.getBounds().pad(0.25);
    const candidates = satelliteIndexRef.current?.within(
      bounds.getSouth(),
      bounds.getWest(),
      bounds.getNorth(),
      bounds.getEast()
    ) ?? satelliteDetections;

    candidates.forEach((detection) => {
      if (!bounds.contains([detection.lat, detection.lng])) return;
      // Rayon proportionnel à la racine quatrième de la puissance radiative :
      // celle-ci s'étale de 0,2 à 789 MW, une échelle linéaire écraserait tout.
      const radius = Math.max(3, Math.min(11, 2.5 + Math.pow(detection.frpMw, 0.25) * 1.6));

      const ring = L.circleMarker([detection.lat, detection.lng], {
        renderer: canvasRendererRef.current ?? undefined,
        radius,
        // Braise graduée par fraîcheur : voir `emberColor`, qui explique
        // pourquoi cette gamme ne croise jamais la palette des statuts.
        color: emberColor(detection.detectedAt, renderedAt),
        // ⚠️ La confiance passe par l'ÉPAISSEUR, maintenant que la couleur code
        // l'ancienneté. Deux informations sur une même teinte s'annuleraient.
        //
        // Anneau épais dans tous les cas : la couleur ne sépare plus les deux
        // couches aussi franchement que le violet le faisait, c'est donc la
        // FORME qui porte la distinction. Elle doit se voir sans hésitation — et
        // elle reste lisible en cas de daltonisme, là où une teinte ne l'est pas.
        weight: detection.confidence === 'high' ? 3 : 2,
        // `fill: false` porte toute la distinction : un anneau, jamais un disque.
        fill: false,
        interactive: true,
      });

      const detectedAgo = formatTimeAgo(detection.detectedAt, intlTag, t('time.justNow'));
      ring.bindTooltip(
        `<div style="font-weight:700;color:#fb923c">${t('satellite.tooltipTitle')}</div>
         <div style="color:#e2e2e3">${t('satellite.tooltipPower', {
           frp: detection.frpMw.toFixed(1),
           passes: detection.passes,
         })}</div>
         <div style="color:#9ca3af">${detection.satellites.join(', ')} · ${detectedAgo}</div>
         <div style="color:#9ca3af;font-style:italic;margin-top:4px">${t('satellite.tooltipUnconfirmed')}</div>`,
        { className: 'satellite-tooltip', direction: 'top' }
      );

      satelliteGroupRef.current?.addLayer(ring);
    });
  }, [satelliteDetections, showSatellite, isPickerMode, zoom, moveTick, t, intlTag]);

  // Render Watch Zones
  useEffect(() => {
    if (!mapRef.current || !zonesGroupRef.current) return;

    zonesGroupRef.current.clearLayers();

    if (isPickerMode) return;

    watchZones.forEach((zone) => {
      if (!zone.active) return;

      const circle = L.circle([zone.lat, zone.lng], {
        radius: zone.radiusKm * 1000,
        color: '#7bd1fd',
        weight: 1.5,
        dashArray: '6, 6',
        fillColor: '#7bd1fd',
        fillOpacity: 0.08,
      });

      circle.bindTooltip(`${zone.name} · ${zone.radiusKm} km`, {
        direction: 'center',
        permanent: false,
      });

      zonesGroupRef.current?.addLayer(circle);
    });
  }, [watchZones, isPickerMode]);

  // Render Picker Circle mode
  useEffect(() => {
    if (!mapRef.current) return;

    if (isPickerMode && pickerPos) {
      if (pickerMarkerRef.current) {
        pickerMarkerRef.current.setLatLng([pickerPos.lat, pickerPos.lng]);
        pickerMarkerRef.current.setRadius(pickerPos.radiusKm * 1000);
      } else {
        const circle = L.circle([pickerPos.lat, pickerPos.lng], {
          radius: pickerPos.radiusKm * 1000,
          color: '#ffb3ad',
          weight: 2,
          fillColor: '#ffb3ad',
          fillOpacity: 0.15,
        }).addTo(mapRef.current);

        pickerMarkerRef.current = circle;
      }
    } else {
      if (pickerMarkerRef.current && mapRef.current) {
        mapRef.current.removeLayer(pickerMarkerRef.current);
        pickerMarkerRef.current = null;
      }
    }
  }, [isPickerMode, pickerPos]);

  /**
   * Recadre la carte quand on change de périmètre.
   *
   * Sans cela, passer en mode Monde laisserait la vue sur le Portugal : les
   * 86 000 foyers seraient bien chargés, mais l'utilisateur n'en verrait que la
   * poignée ibérique et conclurait que « mondial » ne change rien.
   *
   * Le recadrage ne s'applique QU'au changement de périmètre, et pas à chaque
   * rendu : reposition­ner la carte pendant que l'utilisateur la déplace serait
   * insupportable.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || isPickerMode) return;

    const framing: Record<ViewScope, { center: [number, number]; zoom: number }> = {
      portugal: { center: [39.5, -8.0], zoom: 7 },
      spain: { center: [40.0, -3.7], zoom: 6 },
      iberia: { center: [39.8, -5.5], zoom: 6 },
    };

    const { center, zoom } = framing[scope];
    map.flyTo(center, zoom, { duration: 0.8 });
  }, [scope, isPickerMode]);

  // Fly to selected incident location
  useEffect(() => {
    if (!mapRef.current || !selectedIncidentId) return;

    const target = incidents.find((i) => i.id === selectedIncidentId);
    if (target) {
      mapRef.current.flyTo([target.lat, target.lng], 10, {
        duration: 1.2,
      });
    }
  }, [selectedIncidentId, incidents]);

  // Controls helper functions
  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  /**
   * Centre la carte sur la position de l'utilisateur.
   *
   * ⚠️ L'échec ne recadre PLUS sur la péninsule. C'était le défaut de la version
   * précédente : quand la position était refusée ou introuvable, la carte
   * sautait ailleurs sans un mot. L'utilisateur voyait un mouvement, donc une
   * réaction, et ne pouvait qu'en conclure que le bouton fonctionnait mal. Un
   * échec doit se dire, pas se déguiser en succès.
   *
   * Le `timeout` est indispensable : sans lui, la promesse peut ne jamais
   * revenir, et le bouton reste indéfiniment en attente.
   */
  const handleLocateMe = () => {
    if (!('geolocation' in navigator)) {
      setLocateStatus('unavailable');
      return;
    }

    setLocateStatus('searching');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocateStatus('idle');
        mapRef.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 10);
      },
      (error) => {
        // Chaque cause appelle une conduite différente : autoriser dans le
        // navigateur, réessayer, ou renoncer. Un message unique les mélangerait.
        setLocateStatus(
          error.code === error.PERMISSION_DENIED
            ? 'denied'
            : error.code === error.TIMEOUT
              ? 'timeout'
              : 'unavailable'
        );
      },
      { timeout: 10_000, maximumAge: 60_000, enableHighAccuracy: false }
    );
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Leaflet map container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Map Control Buttons Overlay (Bottom Right) */}
      <div className="absolute bottom-6 right-6 z-[400] flex flex-col gap-2 pointer-events-auto">
        <div className="flex flex-col bg-[#16191C] border border-[#2D3034] rounded overflow-hidden shadow-lg">
          <button
            type="button"
            onClick={handleZoomIn}
            title={t('map.zoomIn')}
            className="w-10 h-10 flex items-center justify-center hover:bg-[#282a2b] transition-colors border-b border-[#2D3034] text-[#e5bdb9] hover:text-[#e2e2e3]"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title={t('map.zoomOut')}
            className="w-10 h-10 flex items-center justify-center hover:bg-[#282a2b] transition-colors text-[#e5bdb9] hover:text-[#e2e2e3]"
          >
            <span className="material-symbols-outlined text-[20px]">remove</span>
          </button>
        </div>

        {/* L'échec s'affiche À CÔTÉ du bouton qui l'a provoqué, et non dans un
            bandeau lointain : c'est là que l'utilisateur regarde. Il se referme
            au clic suivant, sans minuterie — rien ne presse, et une alerte qui
            s'évapore avant d'être lue ne vaut pas mieux que pas d'alerte. */}
        {locateStatus !== 'idle' && locateStatus !== 'searching' && (
          <div className="absolute right-12 bottom-[52px] w-[220px] rounded border border-[#2D3034] bg-[#16191C] px-3 py-2 shadow-xl">
            <p className="font-['Inter'] text-[11px] leading-snug text-[#e5bdb9]">
              {t(`map.locate.${locateStatus}` as TranslationKey)}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={handleLocateMe}
          disabled={locateStatus === 'searching'}
          title={t('map.locate')}
          className="w-10 h-10 bg-[#16191C] border border-[#2D3034] rounded flex items-center justify-center hover:bg-[#282a2b] transition-colors text-[#e5bdb9] hover:text-[#e2e2e3] shadow-lg disabled:opacity-60"
        >
          <span
            className={`material-symbols-outlined text-[20px] ${
              locateStatus === 'searching' ? 'animate-spin' : ''
            }`}
          >
            {locateStatus === 'searching' ? 'progress_activity' : 'my_location'}
          </span>
        </button>

        {/* Tile Layer Switcher */}
        {/* ⚠️ Menu ouvert au CLIC, et non au survol comme auparavant. Un
            `group-hover` n'existe pas au doigt : sur téléphone, ce menu était
            purement et simplement inatteignable — les fonds de carte y étaient
            invisibles. Le clic fonctionne dans les deux cas. */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLayerMenu((open) => !open)}
            aria-expanded={showLayerMenu}
            title={t('map.layers')}
            className={`w-10 h-10 border border-[#2D3034] rounded flex items-center justify-center transition-colors shadow-lg ${
              showLayerMenu
                ? 'bg-[#282a2b] text-[#e2e2e3]'
                : 'bg-[#16191C] text-[#e5bdb9] hover:bg-[#282a2b] hover:text-[#e2e2e3]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">layers</span>
          </button>
          <div
            className={`absolute right-12 bottom-0 ${
              showLayerMenu ? 'flex' : 'hidden'
            } flex-col bg-[#16191C] border border-[#2D3034] rounded p-1 shadow-xl w-[248px] max-w-[calc(100vw-5rem)]`}
          >
            <button
              type="button"
              onClick={() => onChangeTileLayer('dark')}
              className={`px-3 py-1.5 text-xs text-left rounded transition-colors ${
                tileLayerType === 'dark' ? 'bg-[#ffb3ad] text-[#680009] font-bold' : 'text-[#e2e2e3] hover:bg-[#282a2b]'
              }`}
            >
              {t('map.layerDark')}
            </button>
            <button
              type="button"
              onClick={() => onChangeTileLayer('satellite')}
              className={`px-3 py-1.5 text-xs text-left rounded transition-colors ${
                tileLayerType === 'satellite' ? 'bg-[#ffb3ad] text-[#680009] font-bold' : 'text-[#e2e2e3] hover:bg-[#282a2b]'
              }`}
            >
              {t('map.layerSatellite')}
            </button>
            <button
              type="button"
              onClick={() => onChangeTileLayer('terrain')}
              className={`px-3 py-1.5 text-xs text-left rounded transition-colors ${
                tileLayerType === 'terrain' ? 'bg-[#ffb3ad] text-[#680009] font-bold' : 'text-[#e2e2e3] hover:bg-[#282a2b]'
              }`}
            >
              {t('map.layerTerrain')}
            </button>

            {/* La couche satellite rejoint les fonds de carte : même question
                posée à la carte, même menu. `satelliteControl` est monté par
                `App`, qui détient l'état de la couche et son compteur. */}
            {satelliteControl}
          </div>
        </div>
      </div>
    </div>
  );
};
