/**
 * Attribution d'un pays à un point, au moment du build.
 *
 * POURQUOI c'est nécessaire depuis que FIRMS est mondial : 86 000 foyers dans
 * une seule liste ne se lisent pas. Regroupés par pays, ils répondent à la seule
 * question qu'on se pose devant une carte du monde — « où ça brûle le plus en ce
 * moment ? ». Sans code pays, la vue mondiale ne serait qu'un nuage de points.
 *
 * POURQUOI AU BUILD et jamais dans le navigateur : la couche de frontières pèse
 * 3 Mo, soit cinq fois le jeu de détections lui-même. La faire télécharger à
 * chaque visiteur pour recalculer un résultat identique serait absurde. Le
 * navigateur ne reçoit qu'un index de pays et un entier par foyer.
 *
 * Natural Earth 1:50m est utilisé plutôt que 1:110m : au 1:110m, les frontières
 * sont simplifiées au point que des îles entières disparaissent et que les
 * littoraux s'écartent de plusieurs dizaines de kilomètres, ce qui rejetterait à
 * la mer des foyers côtiers — or les feux de forêt sont massivement côtiers.
 *
 * Domaine public (Natural Earth), donc récupérable au build sans question de
 * licence.
 */

const SOURCE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';

/** Anneau : suite de [lng, lat]. Premier anneau = contour, suivants = trous. */
type Ring = Array<[number, number]>;
type Polygon = Ring[];

interface CountryShape {
  /** ISO 3166-1 alpha-2. */
  code: string;
  name: string;
  polygons: Polygon[];
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Côté de la cellule d'index, en degrés.
 *
 * 5° est un compromis assumé : plus fin, l'index coûte plus à construire que les
 * tests qu'il économise (la Russie et le Canada s'inscriraient dans des
 * centaines de cellules) ; plus grossier, chaque point retesterait trop de pays.
 */
const CELL_DEG = 5;

function cellKey(lat: number, lng: number): number {
  // Encodage en un seul entier plutôt qu'une chaîne : l'index est interrogé
  // 86 000 fois, et une clé numérique évite autant d'allocations.
  const row = Math.floor((lat + 90) / CELL_DEG);
  const col = Math.floor((lng + 180) / CELL_DEG);
  return row * 1000 + col;
}

/**
 * Test point-dans-polygone par lancer de rayon.
 *
 * Les trous sont traités par la même règle de parité que le contour : un point
 * dans un trou est franchi deux fois et ressort donc « dehors ». C'est exactement
 * ce qu'on veut — le Lesotho ne doit pas être compté en Afrique du Sud.
 */
function isPointInRing(lat: number, lng: number, ring: Ring): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    // `(yi > lat) !== (yj > lat)` : le segment traverse-t-il la latitude du
    // point ? Comparaison stricte d'un seul côté, pour qu'un sommet exactement
    // à cette latitude ne soit pas compté deux fois.
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

function isPointInPolygon(lat: number, lng: number, polygon: Polygon): boolean {
  if (polygon.length === 0) return false;
  if (!isPointInRing(lat, lng, polygon[0])) return false;

  for (let i = 1; i < polygon.length; i += 1) {
    if (isPointInRing(lat, lng, polygon[i])) return false;
  }
  return true;
}

export interface CountryIndex {
  /** Codes ISO présents, dans l'ordre où l'index les référence. */
  codes: string[];
  /** Nom anglais par code, pour l'affichage de repli. */
  names: Record<string, string>;
  /**
   * Cherche le pays d'un point.
   *
   * @returns l'index dans `codes`, ou -1 en mer / hors frontières connues.
   */
  lookup: (lat: number, lng: number) => number;
}

function collectPolygons(geometry: unknown): Polygon[] {
  const geo = geometry as { type?: string; coordinates?: unknown };
  if (geo?.type === 'Polygon') return [geo.coordinates as Polygon];
  if (geo?.type === 'MultiPolygon') return geo.coordinates as Polygon[];
  return [];
}

export async function buildCountryIndex(): Promise<CountryIndex> {
  const response = await fetch(SOURCE, {
    headers: { 'User-Agent': 'atalaia/0.1 (+https://github.com/Lingelo/atalaia)' },
  });
  if (!response.ok) throw new Error(`Natural Earth a répondu ${response.status}`);

  const collection = (await response.json()) as {
    features: Array<{ properties: Record<string, unknown>; geometry: unknown }>;
  };

  const shapes: CountryShape[] = [];

  for (const feature of collection.features) {
    const properties = feature.properties ?? {};
    // `ISO_A2_EH` avant `ISO_A2` : Natural Earth met « -99 » dans `ISO_A2` pour
    // les territoires disputés ou dépendants, et réserve le code réel à la
    // variante « EH ». Sans cet ordre, la Serbie, le Kosovo et une quinzaine de
    // territoires se retrouveraient tous sous le même faux code.
    const code = [properties.ISO_A2_EH, properties.ISO_A2]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .find((value) => value.length === 2 && value !== '-9');
    if (!code) continue;

    const polygons = collectPolygons(feature.geometry);
    if (polygons.length === 0) continue;

    let minLat = 90;
    let maxLat = -90;
    let minLng = 180;
    let maxLng = -180;
    for (const polygon of polygons) {
      for (const [lng, lat] of polygon[0] ?? []) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      }
    }

    shapes.push({
      code,
      name: typeof properties.NAME === 'string' ? properties.NAME : code,
      polygons,
      minLat,
      maxLat,
      minLng,
      maxLng,
    });
  }

  // Un pays peut apparaître en plusieurs entités (métropole et territoires) :
  // on fusionne sur le code pour que l'index ne le compte qu'une fois.
  const codes: string[] = [];
  const names: Record<string, string> = {};
  const indexOf = new Map<string, number>();
  for (const shape of shapes) {
    if (!indexOf.has(shape.code)) {
      indexOf.set(shape.code, codes.length);
      codes.push(shape.code);
      names[shape.code] = shape.name;
    }
  }

  // Index spatial : chaque cellule liste les pays dont la boîte englobante la
  // recouvre. Réduit le test de 242 pays à quelques candidats.
  const grid = new Map<number, CountryShape[]>();
  for (const shape of shapes) {
    for (let lat = shape.minLat; lat <= shape.maxLat + CELL_DEG; lat += CELL_DEG) {
      for (let lng = shape.minLng; lng <= shape.maxLng + CELL_DEG; lng += CELL_DEG) {
        const key = cellKey(Math.min(lat, shape.maxLat), Math.min(lng, shape.maxLng));
        const bucket = grid.get(key);
        if (bucket) {
          if (!bucket.includes(shape)) bucket.push(shape);
        } else {
          grid.set(key, [shape]);
        }
      }
    }
  }

  return {
    codes,
    names,
    lookup(lat, lng) {
      const candidates = grid.get(cellKey(lat, lng));
      if (!candidates) return -1;

      for (const shape of candidates) {
        // Rejet par boîte englobante d'abord : bien moins cher qu'un lancer de
        // rayon sur des milliers de sommets.
        if (lat < shape.minLat || lat > shape.maxLat) continue;
        if (lng < shape.minLng || lng > shape.maxLng) continue;

        for (const polygon of shape.polygons) {
          if (isPointInPolygon(lat, lng, polygon)) {
            return indexOf.get(shape.code) ?? -1;
          }
        }
      }
      return -1;
    },
  };
}
