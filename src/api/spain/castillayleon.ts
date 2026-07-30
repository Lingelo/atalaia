/**
 * Castille-et-León — Junta de Castilla y León (portail « datos abiertos »).
 *
 * Source la plus RICHE des trois : elle publie la surface brûlée ventilée par
 * type de couvert, le niveau de gravité (IGR), la cause probable, et le détail
 * nominatif des moyens engagés. C'est aussi la seule à couvrir plusieurs années
 * (depuis juin 2021), ce dont la vue Historique tire parti.
 *
 * ⚠️ DEUX PIÈGES STRUCTURELS, qui expliquent tout ce fichier.
 *
 * 1. Ce n'est pas un flux d'incendies mais un BULLETIN QUOTIDIEN (« parte
 *    diario »), publié deux fois par jour. Un même incendie y figure autant de
 *    fois qu'il a duré de demi-journées : 26 996 lignes ne décrivent que 5 664
 *    incendies distincts. Les compter naïvement multiplierait par cinq le
 *    nombre de feux de la région. Voir `dedupeReports`.
 *
 * 2. Les moyens engagés et la surface brûlée sont publiés en TEXTE LIBRE, pas
 *    en champs numériques. Il faut donc les analyser, et le faire prudemment :
 *    voir `parseResources` et `parseBurnedArea`.
 */

import type { BurnedBreakdown, Incident, ResourceEntry } from '../../types';
import { phaseFromSpanishLabel } from '../../lib/status.ts';

const DATASET =
  'https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/incendios-forestales';

/** Une ligne du bulletin, telle que publiée. */
export interface JcylRecord {
  /** Date du bulletin qui porte la ligne — PAS celle de l'incendie. */
  fecha_del_parte: string | null;
  hora_del_parte: string | null;
  /** Publié comme un tableau, contenant en pratique une seule province. */
  provincia: string[] | string | null;
  causa_probable: string | null;
  termino_municipal: string | null;
  /** Niveau IGR : "0", "1" ou "2". */
  nivel: string | null;
  fecha_de_inicio: string | null;
  hora_de_inicio: string | null;
  /** Texte libre. Ex. : "3 Técnicos;15 A.M.;8 Autobombas;1 HT-ROSINOS". */
  medios_de_extincion: string | null;
  situacion_actual: string | null;
  /** Texte libre. Ex. : "ARBOLADO:152,44 HA.; MATORRAL:4,00 HA.;". */
  tipo_y_has_de_superficie_afectada: string | null;
  fecha_extinguido: string | null;
  hora_extinguido: string | null;
  nivel_maximo_alcanzado: string | null;
  posicion: { lon: number; lat: number } | null;
  codigo_municipio_ine: string | null;
}

interface JcylResponse {
  total_count?: number;
  results?: JcylRecord[];
}

function province(record: JcylRecord): string {
  const raw = record.provincia;
  if (Array.isArray(raw)) return (raw[0] ?? '').trim();
  return (raw ?? '').trim();
}

/**
 * Identité d'un INCENDIE, par opposition à celle d'une ligne de bulletin.
 *
 * Le portail ne publie aucun identifiant d'incendie stable : on reconstruit
 * l'identité à partir du nom de commune et de l'instant de départ, qui ensemble
 * ne collident pas en pratique.
 *
 * ⚠️ `codigo_municipio_ine` est délibérément ÉCARTÉ de cette clé, bien qu'il
 * paraisse plus fiable qu'un toponyme. Il est publié de façon intermittente
 * pour un même feu : l'incendie de Llamas de Cabrera du 08/08/2025 apparaît à
 * la fois avec le code « 24016 » et avec un code nul, dans le bulletin du même
 * jour. S'en servir dédoublait donc les plus gros incendies de l'archive — le
 * contraire du but recherché.
 */
function fireKey(record: JcylRecord): string {
  const municipality = (record.termino_municipal ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');

  return [municipality, record.fecha_de_inicio ?? '', record.hora_de_inicio ?? ''].join('|');
}

/** Ordre de publication d'un bulletin, pour retenir le plus récent. */
function reportOrder(record: JcylRecord): string {
  return `${record.fecha_del_parte ?? ''}T${record.hora_del_parte ?? ''}`;
}

/**
 * Réduit les bulletins successifs à un état par incendie, le plus récent.
 *
 * Le dernier bulletin est celui qui porte la surface définitive et l'état final :
 * garder le premier afficherait « EN PERIMETRACIÓN » sur des feux éteints depuis
 * des mois.
 *
 * Les lignes sans position sont écartées — le portail publie aussi des lignes
 * « SIN INCIDENCIAS », qui signalent l'absence de feu dans une province et ne
 * décrivent aucun incendie.
 */
export function dedupeReports(records: JcylRecord[]): JcylRecord[] {
  const latest = new Map<string, JcylRecord>();

  for (const record of records) {
    if (!record.posicion) continue;
    if (!Number.isFinite(record.posicion.lat) || !Number.isFinite(record.posicion.lon)) continue;
    // « SIN INCIDENCIAS » n'est pas un toponyme : c'est un bulletin vide.
    if ((record.termino_municipal ?? '').toUpperCase().startsWith('SIN INCIDENCIAS')) continue;
    if (!record.fecha_de_inicio) continue;

    const key = fireKey(record);
    const previous = latest.get(key);
    if (!previous || reportOrder(record) > reportOrder(previous)) latest.set(key, record);
  }

  return [...latest.values()];
}

/** "2026-07-22" + "17:41" → millisecondes epoch. */
export function parseSpanishDateTime(date: string | null, time: string | null): number | null {
  if (!date) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec((time ?? '').trim());
  const hours = match ? match[1].padStart(2, '0') : '00';
  const minutes = match ? match[2] : '00';

  // Heure d'Europe/Madrid, que l'on ne peut pas déduire du seul libellé : on
  // interprète en UTC et on assume l'écart d'une à deux heures. L'alternative
  // — embarquer une base de fuseaux — coûterait plus que la précision gagnée
  // sur un affichage en « il y a N heures ».
  const parsed = Date.parse(`${date}T${hours}:${minutes}:00Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Analyse la liste des moyens engagés, publiée en texte libre.
 *
 * Format observé : des postes séparés par des points-virgules, chacun préfixé
 * de son nombre — « 3 Técnicos;15 A.M.;8 Autobombas;1 HT-ROSINOS;6 ELIF ».
 * Certains postes n'ont pas de nombre (« UY-2 (Lucas) ») : ils sont comptés 1.
 *
 * PRINCIPE DE PRUDENCE : on ne classe en effectif, véhicule ou moyen aérien que
 * ce qui est reconnu sans ambiguïté. Tout le reste est conservé dans `resources`
 * avec son libellé d'origine, et n'entre dans AUCUN total. « ELIF », « BRIF » et
 * « Cuadrillas » désignent des ÉQUIPES dont l'effectif n'est pas publié : les
 * compter comme des personnes fabriquerait un chiffre, les ignorer perdrait de
 * l'information. On les cite donc, sans les additionner.
 */
export function parseResources(text: string | null): {
  personnel: number | null;
  vehicles: number | null;
  aircraft: number | null;
  resources: ResourceEntry[];
} {
  const entries: ResourceEntry[] = [];
  let personnel: number | null = null;
  let vehicles: number | null = null;
  let aircraft: number | null = null;

  const add = (current: number | null, value: number): number => (current ?? 0) + value;

  for (const chunk of (text ?? '').split(';')) {
    const piece = chunk.trim();
    if (!piece) continue;

    const match = /^(\d+)\s+(.*)$/.exec(piece);
    const count = match ? Number(match[1]) : 1;
    const label = (match ? match[2] : piece).trim();
    if (!label || count <= 0) continue;

    // Personnes : techniciens et agents environnementaux ("A.M." pour agentes
    // medioambientales), les deux seuls postes publiés en individus.
    if (/^t[ée]cnic/i.test(label) || /^a\.?\s?m\.?$/i.test(label) || /^agentes/i.test(label)) {
      personnel = add(personnel, count);
      entries.push({ label, count, unit: 'people' });
      continue;
    }

    // Aéronefs : hélicoptères de transport (HT-, 2HT-), avions de coordination
    // ou de largage (ACO-, AT-), et les libellés explicites.
    if (/^\d*ht-/i.test(label) || /^(aco|at)-/i.test(label) || /^(avi|hidro|helic)/i.test(label)) {
      aircraft = add(aircraft, count);
      entries.push({ label, count, unit: 'units' });
      continue;
    }

    // Engins terrestres.
    if (/^(autobomba|bulldozer|nodriza|veh[íi]culo|tractor)/i.test(label)) {
      vehicles = add(vehicles, count);
      entries.push({ label, count, unit: 'units' });
      continue;
    }

    // Équipes à effectif non publié : citées, jamais totalisées.
    entries.push({ label, count, unit: 'units' });
  }

  return { personnel, vehicles, aircraft, resources: entries };
}

/**
 * Analyse la surface brûlée, publiée en texte libre.
 *
 * Formats observés :
 *   "ARBOLADO:152,44 HA.; MATORRAL:4,00 HA.;"
 *   "FORESTAL:ARBOLADO:650,00 HA. ; MATORRAL:143,00 HA. ;"
 *   "AGRICOLA:23,40 HA."
 *   "EN PERIMETRACIÓN"           ← aucun chiffre : la mesure n'est pas faite
 *
 * Le dernier cas est la raison d'être du type de retour nullable : un feu en
 * cours de périmétrage n'a pas une surface de 0 hectare, il a une surface
 * INCONNUE. Renvoyer 0 le ferait passer pour un feu sans conséquence.
 *
 * ⚠️ Décimales à la VIRGULE, comme le veut la convention espagnole. Les lire
 * comme des séparateurs de milliers transformerait 152,44 ha en 15 244 ha.
 */
export function parseBurnedArea(text: string | null): {
  total: number | null;
  breakdown: BurnedBreakdown | null;
} {
  if (!text) return { total: null, breakdown: null };

  let arbolado = 0;
  let matorral = 0;
  let agricola = 0;
  let found = false;

  const pattern = /(ARBOLADO|MATORRAL|AGR[ÍI]COLA|PASTIZAL)\s*:\s*([\d.,]+)\s*HA/gi;
  for (const match of text.matchAll(pattern)) {
    // On retire les points (séparateurs de milliers) avant de convertir la
    // virgule décimale en point.
    const value = Number(match[2].replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(value)) continue;
    found = true;

    const category = match[1].toUpperCase();
    if (category === 'ARBOLADO') arbolado += value;
    else if (category === 'MATORRAL' || category === 'PASTIZAL') matorral += value;
    else agricola += value;
  }

  if (!found) return { total: null, breakdown: null };

  return {
    total: arbolado + matorral + agricola,
    // Aligné sur la ventilation portugaise : peuplement / broussailles /
    // agricole, ce qui permet au panneau de détail d'être commun aux deux pays.
    breakdown: { povoamentoHa: arbolado, matoHa: matorral, agricolaHa: agricola },
  };
}

export function toIncident(record: JcylRecord): Incident {
  const municipality = (record.termino_municipal ?? '').trim();
  const prov = province(record);
  const status = (record.situacion_actual ?? '').trim();
  const { personnel, vehicles, aircraft, resources } = parseResources(record.medios_de_extincion);
  const { total, breakdown } = parseBurnedArea(record.tipo_y_has_de_superficie_afectada);

  return {
    id: `jcyl-${fireKey(record)}`,
    source: 'jcyl',

    title: municipality || prov,
    locationName: prov,
    district: prov,
    municipality,

    status,
    phase: phaseFromSpanishLabel(status),
    statusCode: null,

    startedAt: parseSpanishDateTime(record.fecha_de_inicio, record.hora_de_inicio) ?? Date.now(),

    personnel,
    // Les « técnicos » et « A.M. » sont bien des personnes, mais les ELIF, BRIF
    // et cuadrillas sont publiées en ÉQUIPES dont l'effectif reste inconnu :
    // le total ne peut donc être qu'un plancher. Voir `parseResources`.
    personnelIsPartial: true,
    vehicles,
    aircraft,
    resources,

    // IGR : niveau de gravité potentielle, de 0 à 2. Publié tel quel, sans
    // réinterprétation — c'est une échelle réglementaire espagnole, sans
    // équivalent dans les statuts portugais.
    severityLevel: (record.nivel ?? record.nivel_maximo_alcanzado ?? '').trim() || null,

    lat: record.posicion?.lat ?? 0,
    lng: record.posicion?.lon ?? 0,

    nature: (record.causa_probable ?? '').trim(),
    altitude: null,
    alertSource: null,

    burnedAreaHa: total,
    burnedBreakdown: breakdown,

    weather: null,
    history: [],
  };
}

/** Télécharge des lignes de bulletin, avec pagination du portail OpenDataSoft. */
export async function fetchJcylRecords(
  where: string,
  limit: number,
  signal?: AbortSignal
): Promise<JcylRecord[]> {
  const records: JcylRecord[] = [];
  // Le portail plafonne `limit` à 100 par requête sur l'API `records`.
  const pageSize = 100;

  for (let offset = 0; offset < limit; offset += pageSize) {
    const params = new URLSearchParams({
      where,
      limit: String(Math.min(pageSize, limit - offset)),
      offset: String(offset),
      order_by: 'fecha_del_parte desc',
    });

    const response = await fetch(`${DATASET}/records?${params.toString()}`, { signal });
    if (!response.ok) throw new Error(`JCyL ${response.status}`);

    const payload = (await response.json()) as JcylResponse;
    const page = payload.results ?? [];
    records.push(...page);
    if (page.length < pageSize) break;
  }

  return records;
}

/**
 * Récupère les incendies de Castille-et-León publiés depuis `sinceMs`.
 *
 * Le filtre porte sur la date du BULLETIN et non sur celle de l'incendie : un
 * feu déclaré il y a dix jours et toujours actif figure dans le bulletin de ce
 * matin, et doit apparaître. Filtrer sur `fecha_de_inicio` l'aurait masqué.
 */
export async function fetchCastillaYLeonIncidents(
  sinceMs: number,
  signal?: AbortSignal
): Promise<Incident[]> {
  const since = new Date(sinceMs).toISOString().slice(0, 10);
  const where = `fecha_del_parte >= date'${since}' and posicion is not null`;

  const records = await fetchJcylRecords(where, 500, signal);
  return dedupeReports(records).map(toIncident);
}
