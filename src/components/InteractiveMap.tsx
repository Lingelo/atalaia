import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Incident, WatchZone, MapTileLayer, SatelliteDetection } from '../types';
import { resolveStatus } from '../lib/status';
import { formatTimeAgo } from '../lib/time';
import { SatelliteHeatLayer } from './map/SatelliteHeatLayer';

/**
 * Seuil de bascule nappe → anneaux individuels.
 *
 * Niveau 9 ≈ échelle d'un district : en deçà on regarde un pays et la densité
 * est la bonne lecture ; au-delà on regarde une vallée et le détail par foyer
 * (puissance, satellites, nombre de passages) redevient pertinent.
 */
const DETAIL_ZOOM = 9;

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
  isPickerMode?: boolean;
  pickerPos?: { lat: number; lng: number; radiusKm: number };
  onPickerPosChange?: (lat: number, lng: number) => void;
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
  isPickerMode = false,
  pickerPos,
  onPickerPosChange,
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
  const [zoom, setZoom] = useState(7);
  /** Incrémenté à chaque déplacement : redéclenche le filtrage des anneaux. */
  const [moveTick, setMoveTick] = useState(0);

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
        maxZoom: 19,
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
    };
  }, []);

  // Handle tile layer changes
  useEffect(() => {
    if (!mapRef.current) return;
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }

    const newTileLayer = L.tileLayer(getTileUrl(tileLayerType), {
      maxZoom: 19,
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
      const meta = resolveStatus(inc.statusCode, inc.status);
      const color = meta.color;

      // Taille du marqueur : racine carrée des effectifs, pour que l'aire du disque
      // reste proportionnelle aux moyens engagés. Plancher à 16 px pour qu'un feu
      // à 1 opérationnel reste visible et cliquable.
      const ops = inc.operacionais;
      const size = Math.max(16, Math.min(38, Math.round(14 + Math.sqrt(ops) * 1.2)));

      // Pulsation réservée aux sinistres encore combattus.
      const pulseClass =
        meta.code === 5 ? 'pulse-fire' : meta.code === 7 ? 'pulse-resolucao' : '';

      const customIcon = L.divIcon({
        className: 'custom-fire-marker',
        html: `
          <div style="
            width: ${size}px;
            height: ${size}px;
            background-color: ${color};
            border-radius: 50%;
            border: 1.5px solid ${isSelected ? '#ffffff' : '#0c0e0f'};
            box-shadow: ${isSelected ? '0 0 15px 4px ' + color : 'none'};
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: transform 0.2s ease;
            transform: scale(${isSelected ? 1.2 : 1});
          " class="${pulseClass}">
            ${
              size > 22
                ? `<span style="font-size: ${Math.round(size * 0.45)}px; font-weight: 700; color: #121415; line-height: 1;">${inc.operacionais}</span>`
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
          <div style="color: #babcc0; margin-top: 2px;">👥 ${inc.operacionais} op · 🚒 ${inc.veiculos} veí</div>
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
  //   - teinte : violet, absent de la palette des statuts
  // La forme seule suffit à les séparer, ce qui rend la carte lisible même en cas
  // de daltonisme. Une simple différence de couleur ne l'aurait pas garanti.
  useEffect(() => {
    if (!mapRef.current || !satelliteGroupRef.current) return;

    satelliteGroupRef.current.clearLayers();
    if (!showSatellite || isPickerMode || zoom < DETAIL_ZOOM) return;

    // Seuls les foyers visibles sont tracés : au-delà du seuil de zoom, l'emprise
    // à l'écran n'en contient qu'une poignée sur les onze cents.
    const bounds = mapRef.current.getBounds().pad(0.25);

    satelliteDetections.forEach((detection) => {
      if (!bounds.contains([detection.lat, detection.lng])) return;
      // Rayon proportionnel à la racine quatrième de la puissance radiative :
      // celle-ci s'étale de 0,2 à 789 MW, une échelle linéaire écraserait tout.
      const radius = Math.max(3, Math.min(11, 2.5 + Math.pow(detection.frpMw, 0.25) * 1.6));

      const ring = L.circleMarker([detection.lat, detection.lng], {
        renderer: canvasRendererRef.current ?? undefined,
        radius,
        color: detection.confidence === 'high' ? '#c4b5fd' : '#8b5cf6',
        weight: detection.confidence === 'high' ? 2 : 1.5,
        // `fill: false` porte toute la distinction : un anneau, jamais un disque.
        fill: false,
        interactive: true,
      });

      const detectedAgo = formatTimeAgo(detection.detectedAt);
      ring.bindTooltip(
        `<div style="font-weight:700;color:#c4b5fd">Deteção por satélite</div>
         <div style="color:#e2e2e3">${detection.frpMw.toFixed(1)} MW · ${detection.passes} passagem(ns)</div>
         <div style="color:#9ca3af">${detection.satellites.join(', ')} · ${detectedAgo}</div>
         <div style="color:#9ca3af;font-style:italic;margin-top:4px">Não confirmado no terreno</div>`,
        { className: 'satellite-tooltip', direction: 'top' }
      );

      satelliteGroupRef.current?.addLayer(ring);
    });
  }, [satelliteDetections, showSatellite, isPickerMode, zoom, moveTick]);

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

      circle.bindTooltip(`Zone: ${zone.name} (${zone.radiusKm} km)`, {
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
  const handleResetView = () => mapRef.current?.flyTo([39.5, -8.0], 7);
  const handleLocateMe = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          mapRef.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 10);
        },
        () => {
          handleResetView();
        }
      );
    } else {
      handleResetView();
    }
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
            title="Aumentar zoom"
            className="w-10 h-10 flex items-center justify-center hover:bg-[#282a2b] transition-colors border-b border-[#2D3034] text-[#e5bdb9] hover:text-[#e2e2e3]"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Diminuir zoom"
            className="w-10 h-10 flex items-center justify-center hover:bg-[#282a2b] transition-colors text-[#e5bdb9] hover:text-[#e2e2e3]"
          >
            <span className="material-symbols-outlined text-[20px]">remove</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleLocateMe}
          title="Minha localização / Centrar"
          className="w-10 h-10 bg-[#16191C] border border-[#2D3034] rounded flex items-center justify-center hover:bg-[#282a2b] transition-colors text-[#e5bdb9] hover:text-[#e2e2e3] shadow-lg"
        >
          <span className="material-symbols-outlined text-[20px]">my_location</span>
        </button>

        {/* Tile Layer Switcher */}
        <div className="relative group">
          <button
            type="button"
            title="Camadas do Mapa"
            className="w-10 h-10 bg-[#16191C] border border-[#2D3034] rounded flex items-center justify-center hover:bg-[#282a2b] transition-colors text-[#e5bdb9] hover:text-[#e2e2e3] shadow-lg"
          >
            <span className="material-symbols-outlined text-[20px]">layers</span>
          </button>
          <div className="absolute right-12 bottom-0 hidden group-hover:flex flex-col bg-[#16191C] border border-[#2D3034] rounded p-1 shadow-xl whitespace-nowrap min-w-[120px]">
            <button
              type="button"
              onClick={() => onChangeTileLayer('dark')}
              className={`px-3 py-1.5 text-xs text-left rounded transition-colors ${
                tileLayerType === 'dark' ? 'bg-[#ffb3ad] text-[#680009] font-bold' : 'text-[#e2e2e3] hover:bg-[#282a2b]'
              }`}
            >
              Escuro (Padrão)
            </button>
            <button
              type="button"
              onClick={() => onChangeTileLayer('satellite')}
              className={`px-3 py-1.5 text-xs text-left rounded transition-colors ${
                tileLayerType === 'satellite' ? 'bg-[#ffb3ad] text-[#680009] font-bold' : 'text-[#e2e2e3] hover:bg-[#282a2b]'
              }`}
            >
              Satélite
            </button>
            <button
              type="button"
              onClick={() => onChangeTileLayer('terrain')}
              className={`px-3 py-1.5 text-xs text-left rounded transition-colors ${
                tileLayerType === 'terrain' ? 'bg-[#ffb3ad] text-[#680009] font-bold' : 'text-[#e2e2e3] hover:bg-[#282a2b]'
              }`}
            >
              Topográfico
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
