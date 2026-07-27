/**
 * Client de l'API fogos.pt.
 *
 * En développement, les requêtes passent par le proxy défini dans
 * `vite.config.ts`, qui ajoute un User-Agent identifiable et mutualise le cache.
 * Sonder l'API avec un `curl` nu suffit à déclencher l'erreur Cloudflare 1015.
 *
 * En production statique, l'appel est direct : l'API publie
 * `Access-Control-Allow-Origin: *`, ce qui est une invitation explicite. Voir la
 * note sur `API_BASE` pour la contrepartie.
 */

import type { FogosActiveResponse, FogosIncident } from './fogosTypes';
import type { BurnedBreakdown, Incident } from '../types';

/**
 * Racine des appels.
 *
 * En développement : le proxy local, qui mutualise le cache et s'annonce avec un
 * User-Agent identifiable.
 *
 * En production statique (GitHub Pages) : appel direct, possible parce que
 * api.fogos.pt publie `Access-Control-Allow-Origin: *` — vérifié. Contrepartie
 * assumée : plus de cache partagé, chaque visiteur interroge la source. C'est
 * tenable au rythme d'un rafraîchissement par minute et par onglet ; si le trafic
 * grandit, il faudra une fonction serverless réutilisant `createUpstreamProxy`.
 */
const API_BASE = import.meta.env.DEV ? '/api/fogos' : 'https://api.fogos.pt';

/**
 * Extrait le contour d'un KML en coordonnées Leaflet.
 *
 * Le KML stocke "lng,lat,altitude" séparés par des espaces ; Leaflet attend
 * [lat, lng]. L'inversion est le piège classique — une erreur ici place les feux
 * portugais quelque part en mer, au large de la Somalie.
 *
 * Parsing par expression régulière plutôt que DOMParser : on ne veut qu'un bloc
 * de coordonnées, et les KML de la source portent des namespaces variables qui
 * compliquent une lecture XML stricte pour un gain nul ici.
 */
export function parseKmlPolygon(kml: string): Array<[number, number]> | undefined {
  const match = /<coordinates>([\s\S]*?)<\/coordinates>/.exec(kml);
  if (!match) return undefined;

  const points: Array<[number, number]> = [];
  for (const token of match[1].trim().split(/\s+/)) {
    const [lngRaw, latRaw] = token.split(',');
    const lng = Number(lngRaw);
    const lat = Number(latRaw);
    if (Number.isFinite(lat) && Number.isFinite(lng)) points.push([lat, lng]);
  }

  // Un polygone a besoin d'au moins trois sommets ; en dessous, on préfère ne rien
  // tracer plutôt que d'afficher une figure dégénérée.
  return points.length >= 3 ? points : undefined;
}

function toBurnedBreakdown(incident: FogosIncident): BurnedBreakdown | null {
  const area = incident.icnf?.burnArea;
  if (!area) return null;

  return {
    povoamentoHa: area.povoamento,
    matoHa: area.mato,
    agricolaHa: area.agricola,
  };
}

/** Traduit un incident brut vers le modèle de domaine. */
export function toIncident(raw: FogosIncident): Incident {
  const kml = raw.kmlVost ?? raw.kml;

  return {
    id: raw.id,
    title: raw.freguesia || raw.concelho,
    locationName: [raw.district, raw.concelho].filter(Boolean).join(', '),
    district: raw.district,
    municipality: raw.concelho,

    status: raw.status,
    statusCode: raw.statusCode,

    // L'API donne des SECONDES epoch, JavaScript raisonne en millisecondes.
    startedAt: raw.dateTime.sec * 1000,

    operacionais: raw.man ?? 0,
    veiculos: raw.terrain ?? 0,
    meiosAereos: raw.aerial ?? 0,

    lat: raw.lat,
    lng: raw.lng,

    nature: raw.natureza,
    // Un `0` exact est une sentinelle « inconnu », pas une mesure : toutes les
    // altitudes réelles observées sont fractionnaires (648.644, 48.6775…).
    // Afficher « 0 m » pour un sinistre situé à l'intérieur des terres serait faux.
    altitude: raw.icnf?.altitude ? raw.icnf.altitude : null,
    alertSource: raw.icnf?.fontealerta ?? null,

    burnedAreaHa: raw.icnf?.burnArea?.total ?? null,
    burnedBreakdown: toBurnedBreakdown(raw),

    weather: raw.weather ?? null,

    polygonCoords: kml ? parseKmlPolygon(kml) : undefined,

    // Non disponible sur cet endpoint : voir le commentaire de `history` dans types.ts.
    history: [],
  };
}

export class FogosApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'FogosApiError';
  }
}

/** Récupère les incidents actifs. `signal` permet d'annuler un rafraîchissement obsolète. */
export async function fetchActiveIncidents(signal?: AbortSignal): Promise<Incident[]> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/v2/incidents/active`, { signal });
  } catch (cause) {
    // Une annulation volontaire n'est pas une panne : on la laisse remonter telle quelle.
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new FogosApiError('Sem ligação ao serviço de incêndios.');
  }

  if (!response.ok) {
    throw new FogosApiError(
      `O serviço de incêndios respondeu ${response.status}.`,
      response.status
    );
  }

  const payload = (await response.json()) as FogosActiveResponse;
  if (!payload?.success || !Array.isArray(payload.data)) {
    throw new FogosApiError('Resposta inesperada do serviço de incêndios.');
  }

  // `coords: false` signale un incident sans localisation exploitable. On l'écarte
  // plutôt que de le poser en (0, 0), au large du golfe de Guinée.
  return payload.data
    .filter((raw) => raw.coords && Number.isFinite(raw.lat) && Number.isFinite(raw.lng))
    .map(toIncident);
}
