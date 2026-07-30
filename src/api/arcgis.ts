/**
 * Client minimal pour les services ArcGIS Feature Server.
 *
 * Deux des trois services espagnols publient par ce biais (INFOCA en Andalousie,
 * Bombers de la Generalitat en Catalogne). Plutôt que d'ajouter le SDK ArcGIS —
 * plusieurs centaines de kilooctets pour construire une chaîne de requête — on
 * écrit les deux fonctions dont on a besoin.
 *
 * ⚠️ `f=geojson` N'EST PAS utilisé, bien que ce soit le format le plus naturel :
 * le service de l'INFOCA le refuse (« Unable to perform query operation », 400),
 * là où `f=json` répond normalement. On demande donc le format Esri et on
 * convertit soi-même. Vérifié le 30/07/2026.
 *
 * ⚠️ `outSR=4326` est OBLIGATOIRE sur chaque requête. Sans lui, l'INFOCA répond
 * en Web Mercator (EPSG:3857) et les Bombers en UTM 31N (EPSG:25831) : les
 * coordonnées brutes valent alors plusieurs centaines de milliers d'unités et
 * poseraient les feux au large de l'Afrique de l'Ouest. Le serveur sait
 * reprojeter, on le lui demande.
 */

export interface EsriFeature<A> {
  attributes: A;
  geometry?: { x: number; y: number } | null;
}

interface EsriQueryResponse<A> {
  features?: Array<EsriFeature<A>>;
  error?: { code: number; message: string };
  exceededTransferLimit?: boolean;
}

export interface EsriQueryOptions {
  /** Filtre SQL. `1=1` pour tout prendre. */
  where: string;
  /** Champs demandés. `*` accepté, mais nommer les champs allège la réponse. */
  outFields: string;
  /** Tri, au format Esri (« FECHA DESC »). */
  orderByFields?: string;
  /** Plafond de lignes. Le service impose le sien, souvent 1 000 ou 2 000. */
  resultRecordCount?: number;
}

/**
 * Interroge une couche et renvoie les entités avec des coordonnées en WGS 84.
 *
 * Les entités sans géométrie exploitable sont ÉCARTÉES ici plutôt que plus haut :
 * un feu sans position ne peut être ni affiché sur la carte ni rattaché à une
 * zone de surveillance, et le poser en (0, 0) l'enverrait dans le golfe de Guinée.
 */
export async function queryEsriLayer<A>(
  layerUrl: string,
  options: EsriQueryOptions,
  signal?: AbortSignal
): Promise<Array<{ attributes: A; lat: number; lng: number }>> {
  const params = new URLSearchParams({
    where: options.where,
    outFields: options.outFields,
    f: 'json',
    outSR: '4326',
    returnGeometry: 'true',
  });
  if (options.orderByFields) params.set('orderByFields', options.orderByFields);
  if (options.resultRecordCount !== undefined) {
    params.set('resultRecordCount', String(options.resultRecordCount));
  }

  const response = await fetch(`${layerUrl}/query?${params.toString()}`, { signal });
  if (!response.ok) throw new Error(`ArcGIS ${response.status}`);

  const payload = (await response.json()) as EsriQueryResponse<A>;
  // Un service ArcGIS peut renvoyer 200 avec une erreur dans le corps : sans ce
  // test, une panne amont passerait pour « aucun feu en cours ».
  if (payload.error) throw new Error(`ArcGIS ${payload.error.code}: ${payload.error.message}`);

  return (payload.features ?? []).flatMap((feature) => {
    const { x, y } = feature.geometry ?? {};
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    return [{ attributes: feature.attributes, lat: y as number, lng: x as number }];
  });
}

/**
 * Littéral de date au format attendu dans une clause `where` ArcGIS.
 *
 * ⚠️ Un epoch brut est REFUSÉ, alors que c'est la forme sous laquelle le service
 * RENVOIE ses dates : `ACT_DAT_INICI >= 1783864621000` déclenche « Invalid query
 * parameters » (400) sur la couche des Bombers. Il faut un littéral SQL. Cette
 * asymétrie entre lecture et écriture est la raison de ce petit assistant.
 */
export function esriDateLiteral(ms: number): string {
  return `DATE '${new Date(ms).toISOString().slice(0, 10)}'`;
}

/**
 * Combine une date-seule et une heure publiées séparément.
 *
 * L'INFOCA publie `FECHA` (epoch à minuit UTC) et `HORA` ("12:52:22") dans deux
 * champs distincts. Utiliser `FECHA` seule daterait tous les feux du jour à
 * minuit, ce qui afficherait « il y a 13 h » sur un départ de midi.
 */
export function combineDateAndTime(dateMs: number | null, time: string | null): number | null {
  if (dateMs === null || !Number.isFinite(dateMs)) return null;

  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec((time ?? '').trim());
  if (!match) return dateMs;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? '0');
  if (hours > 23 || minutes > 59) return dateMs;

  return dateMs + ((hours * 60 + minutes) * 60 + seconds) * 1000;
}
