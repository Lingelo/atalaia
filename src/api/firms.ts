/**
 * Client NASA FIRMS — détections thermiques satellite, couverture MONDIALE.
 *
 * ⚠️ NATURE DE LA DONNÉE, à ne jamais confondre avec les incidents des services
 * de protection civile.
 *
 * L'ANEPC, l'INFOCA, les Bombers et la Junta de Castilla y León diffusent de la
 * donnée OPÉRATIONNELLE de terrain : des pompiers ont été dépêchés, on connaît
 * l'état du sinistre, souvent les moyens engagés.
 *
 * FIRMS diffuse une ANOMALIE THERMIQUE vue depuis l'orbite. On a un point, une
 * puissance radiative, une heure de passage du satellite. Rien d'autre : pas de
 * nom de lieu, pas d'état, pas de moyens engagés. S'y ajoutent 3 h de latence
 * et des faux positifs réguliers (torchères industrielles, brûlage agricole).
 *
 * Les deux ne doivent donc jamais être fusionnés dans une même liste ni dans un
 * même total : un pays sans service de protection civile interrogeable
 * afficherait « 0 opérationnel » partout, et l'utilisateur en conclurait qu'il
 * y brûle moins. Ce serait un artefact du modèle de données, pas la réalité.
 */

import type { SatelliteDetection } from '../types';

const API_BASE = '/api/firms';

/**
 * Trois satellites porteurs de l'instrument VIIRS, en couverture MONDIALE.
 *
 * On les interroge tous les trois pour la couverture, puis on regroupe : ils
 * survolent les mêmes zones et détectent donc le MÊME feu jusqu'à trois fois.
 *
 * MODIS est volontairement écarté : son schéma de confiance est numérique (0-100)
 * là où VIIRS est catégoriel, et sa résolution est quatre fois plus grossière.
 * Mélanger les deux imposerait une normalisation pour un gain marginal.
 *
 * ⚠️ Ces fichiers pèsent ~7 Mo CHACUN (86 000 lignes par satellite au relevé du
 * 30/07/2026), contre ~300 Ko pour les anciens fichiers limités à l'Europe. Ils
 * ne doivent jamais être téléchargés par un navigateur : voir `fetchSatelliteDetections`.
 */
export const VIIRS_SOURCES = [
  '/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv',
  '/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv',
  '/data/active_fire/noaa-21-viirs-c2/csv/J2_VIIRS_C2_Global_24h.csv',
];

/**
 * Taille de cellule du regroupement, en degrés. 0,01° ≈ 1,1 km — l'ordre de
 * grandeur de l'empreinte au sol d'un pixel VIIRS (375 m) plus la marge de
 * géolocalisation. Deux détections dans la même cellule sont considérées comme
 * le même foyer.
 */
const CLUSTER_DEG = 0.01;

/** Bits de `sat` dans le format compact. Ordre figé : il est écrit sur le disque. */
const SATELLITE_BITS: Array<[string, number]> = [
  ['N', 1],
  ['N20', 2],
  ['N21', 4],
];

export interface FirmsRow {
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
      // Renseigné au build par `scripts/build-firms.ts` : la couche de
      // frontières pèse 3 Mo et n'a rien à faire dans un navigateur.
      countryCode: null,
    });
  }

  // Les foyers les plus puissants en premier : c'est l'ordre de tracé, donc les
  // plus significatifs restent au-dessus en cas de superposition.
  return detections.sort((a, b) => b.frpMw - a.frpMw);
}

/**
 * Pipeline pur : CSV bruts → foyers regroupés, sur toute la planète.
 *
 * Extrait de la fonction de chargement pour être réutilisable hors navigateur —
 * le script de build s'en sert pour précalculer les données destinées à
 * GitHub Pages, où aucun serveur ne peut relayer FIRMS.
 *
 * ⚠️ AUCUN FILTRAGE GÉOGRAPHIQUE. La version précédente découpait un rectangle
 * autour de la péninsule Ibérique ; il a été retiré, c'est le sens de la
 * couverture mondiale. Le regroupement reste la seule réduction appliquée.
 */
export function processFirmsCsvs(csvTexts: string[]): SatelliteDetection[] {
  const rows = csvTexts
    .flatMap(parseFirmsCsv)
    // Les détections « low » sont majoritairement des faux positifs (surfaces
    // chaudes, réverbération). Les afficher sur une carte de sécurité publique
    // reviendrait à annoncer des feux qui n'existent pas. Ce filtre retire
    // environ un tiers des lignes mondiales.
    .filter((row) => row.confidence !== 'low');

  return clusterDetections(rows);
}

// --- Format compact --------------------------------------------------------
//
// POURQUOI un format colonne plutôt qu'un tableau d'objets :
//
// La couverture mondiale produit ~86 000 foyers. En JSON d'objets, cela pèse
// 15 Mo (1,6 Mo une fois compressé) — infligé à chaque visiteur qui ouvre la
// vue mondiale. Réécrit en colonnes d'entiers, avec latitude et horodatage
// encodés en écart au précédent, le même jeu tombe à 2,0 Mo (636 Ko compressés).
//
// Mesuré sur les données réelles du 30/07/2026, pas estimé. Le gain vient du
// tri par latitude : deux foyers voisins ont alors des latitudes proches, donc
// des écarts petits, que la compression réduit très efficacement.
//
// Le décodage reste un simple `JSON.parse` suivi d'une somme cumulée : pas de
// base64, pas de tableau typé. Une variante base64 a été mesurée à 848 Ko,
// donc PIRE, la compression n'ayant plus prise sur du texte encodé.

/** Version du format sur disque. Incrémenter à tout changement de disposition. */
export const FIRMS_FORMAT_VERSION = 2;

export interface FirmsPayload {
  v: number;
  /** Instant de production du jeu, pour afficher son âge réel. */
  generatedAt: number;
  /** Référence des horodatages, en millisecondes epoch. */
  t0: number;
  /** Codes ISO 3166-1 alpha-2, indexés par `cc`. */
  countries: string[];
  /** Nom anglais par code ISO, repli d'affichage quand la langue n'a pas le pays. */
  countryNames: Record<string, string>;
  /** Latitude × 10⁴, en écart au foyer précédent. */
  lat: number[];
  /** Longitude × 10⁴, en valeur absolue. */
  lng: number[];
  /** Minutes écoulées depuis `t0`, en écart au foyer précédent. */
  t: number[];
  /** Puissance radiative × 10, en mégawatts. */
  frp: number[];
  /** 2 = confiance haute, 1 = nominale. Les « low » sont écartées en amont. */
  conf: number[];
  passes: number[];
  /** Masque de bits des satellites : voir `SATELLITE_BITS`. */
  sat: number[];
  /** Index dans `countries`, ou -1 hors frontières connues (mer, torchère offshore). */
  cc: number[];
}

export function encodeFirmsPayload(
  detections: SatelliteDetection[],
  countries: string[],
  countryNames: Record<string, string>,
  generatedAt: number
): FirmsPayload {
  // Tri par latitude : c'est LUI qui rend l'encodage par écart efficace. Sans
  // lui, les écarts seraient aussi grands que les valeurs absolues et le format
  // ne gagnerait rien.
  const sorted = [...detections].sort((a, b) => a.lat - b.lat || a.lng - b.lng);

  const t0 = sorted.reduce((min, d) => Math.min(min, d.detectedAt), generatedAt);
  const codeIndex = new Map(countries.map((code, index) => [code, index]));

  const payload: FirmsPayload = {
    v: FIRMS_FORMAT_VERSION,
    generatedAt,
    t0,
    countries,
    countryNames,
    lat: [],
    lng: [],
    t: [],
    frp: [],
    conf: [],
    passes: [],
    sat: [],
    cc: [],
  };

  let previousLat = 0;
  let previousTime = 0;

  for (const detection of sorted) {
    const lat = Math.round(detection.lat * 1e4);
    payload.lat.push(lat - previousLat);
    previousLat = lat;

    payload.lng.push(Math.round(detection.lng * 1e4));

    const minutes = Math.round((detection.detectedAt - t0) / 60_000);
    payload.t.push(minutes - previousTime);
    previousTime = minutes;

    payload.frp.push(Math.round(detection.frpMw * 10));
    payload.conf.push(detection.confidence === 'high' ? 2 : 1);
    payload.passes.push(detection.passes);
    payload.sat.push(
      detection.satellites.reduce(
        (mask, name) => mask | (SATELLITE_BITS.find(([id]) => id === name)?.[1] ?? 0),
        0
      )
    );
    payload.cc.push(
      detection.countryCode === null ? -1 : (codeIndex.get(detection.countryCode) ?? -1)
    );
  }

  return payload;
}

export function decodeFirmsPayload(payload: FirmsPayload): SatelliteDetection[] {
  const detections: SatelliteDetection[] = [];

  let lat = 0;
  let minutes = 0;

  for (let i = 0; i < payload.lat.length; i += 1) {
    lat += payload.lat[i];
    minutes += payload.t[i];

    const lng = payload.lng[i];
    const countryIndex = payload.cc[i];
    const mask = payload.sat[i];

    detections.push({
      kind: 'satellite',
      // Reconstruit à l'identique de `clusterDetections` : c'est la clé de
      // cellule, donc stable d'un build à l'autre pour un foyer qui persiste.
      id: `firms-${Math.round(lat / 1e4 / CLUSTER_DEG)}:${Math.round(lng / 1e4 / CLUSTER_DEG)}`,
      lat: lat / 1e4,
      lng: lng / 1e4,
      detectedAt: payload.t0 + minutes * 60_000,
      frpMw: payload.frp[i] / 10,
      confidence: payload.conf[i] === 2 ? 'high' : 'nominal',
      passes: payload.passes[i],
      satellites: SATELLITE_BITS.filter(([, bit]) => (mask & bit) !== 0).map(([id]) => id),
      countryCode: countryIndex >= 0 ? (payload.countries[countryIndex] ?? null) : null,
    });
  }

  // Rendu à l'appelant dans l'ordre de puissance décroissante, comme le
  // pipeline direct : la carte et la liste comptent dessus.
  return detections.sort((a, b) => b.frpMw - a.frpMw);
}

/**
 * Emplacement du jeu précalculé.
 *
 * FIRMS ne renvoie AUCUN en-tête CORS : un navigateur ne peut donc pas
 * l'interroger directement depuis un site statique. Les données sont produites
 * au build par une GitHub Action planifiée, ce qui a trois vertus : ça contourne
 * l'absence de serveur, ça épargne à la NASA 21 Mo de CSV par visiteur, et ça
 * permet d'attribuer un pays à chaque foyer une fois pour toutes.
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
  // ⚠️ Le jeu précalculé est lu AUSSI en développement, contrairement aux
  // incidents. Les CSV mondiaux pèsent 21 Mo à eux trois : les retélécharger à
  // chaque rechargement de page rendrait le développement pénible et
  // martèlerait la NASA. `npm run build:data` produit le fichier ; poser
  // VITE_FIRMS_LIVE=1 force le passage par les CSV quand on veut vérifier le
  // pipeline de bout en bout.
  if (!import.meta.env.VITE_FIRMS_LIVE) {
    const response = await fetch(prebuiltUrl(), { signal });
    if (!response.ok) throw new Error('Serviço de deteção por satélite indisponível.');
    return decodeFirmsPayload((await response.json()) as FirmsPayload);
  }

  // `allSettled` et non `all` : si un satellite est indisponible, on affiche les
  // deux autres plutôt que de perdre toute la couche.
  const results = await Promise.allSettled(
    VIIRS_SOURCES.map(async (path) => {
      const response = await fetch(`${API_BASE}${path}`, { signal });
      if (!response.ok) throw new Error(`FIRMS ${response.status}`);
      return response.text();
    })
  );

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  if (results.every((r) => r.status === 'rejected')) {
    throw new Error('Serviço de deteção por satélite indisponível.');
  }

  return processFirmsCsvs(
    results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
      .map((r) => r.value)
  );
}
