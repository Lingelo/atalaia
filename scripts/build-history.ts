/**
 * Agrège les ARCHIVES RÉELLES des services, pour la vue Historique.
 *
 * Ce script remplace `src/data/mockData.ts`, qui alimentait cette vue avec des
 * chiffres inventés (« 64 201 occurrences », « Serra da Estrela 28 000 ha »).
 * Tout ce qu'il produit est mesuré chez les services eux-mêmes.
 *
 * DEUX ARCHIVES, DE NATURES DIFFÉRENTES — d'où deux blocs séparés dans le JSON
 * plutôt qu'un total ibérique, qui serait un mensonge par agrégation :
 *
 *   Portugal (fogos.pt) — 151 000 occurrences depuis 2018. Riche en DÉCOMPTES,
 *     pauvre en surfaces : sur 1 000 occurrences d'août 2025 relevées, DEUX
 *     portaient une surface brûlée exploitable. Ce bloc ne publie donc aucune
 *     surface, plutôt qu'une surface calculée sur 0,2 % des cas et présentée
 *     comme un total national.
 *
 *   Castilla y León (Junta) — 5 600 incendies depuis juin 2021, dont 2 800 avec
 *     une surface brûlée ventilée par couvert. C'est la seule des quatre sources
 *     à publier des surfaces exploitables, et le seul bloc qui en affiche.
 *
 * ⚠️ CADENCE. Ce script est LENT (plusieurs minutes) parce que l'archive
 * portugaise se pagine par tranches de 1 000. Il n'a rien à faire dans le cycle
 * de publication toutes les 15 minutes : l'historique bouge d'un jour sur
 * l'autre, pas d'un quart d'heure sur l'autre. Voir le workflow, qui l'exécute
 * une fois par jour.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { dedupeReports, parseBurnedArea, parseSpanishDateTime, type JcylRecord }
  from '../src/api/spain/castillayleon.ts';
import type {
  HistoryBlock,
  HistoryPayload,
  MonthlyCount,
  NotableFire,
  RegionStat,
  YearlyCount,
} from '../src/types.ts';

const USER_AGENT = 'atalaia/0.1 (+https://github.com/Lingelo/atalaia)';
const OUTPUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/history.json');

/**
 * Nombre d'années de référence pour la courbe « moyenne ».
 *
 * Trois ans : assez pour lisser une saison exceptionnelle (2022 l'a été des deux
 * côtés de la frontière), assez peu pour rester représentatif du climat récent —
 * et assez peu, surtout, pour tenir dans le quota de l'API portugaise, qui coûte
 * une requête par mois et par année de référence. Voir `FOGOS_MIN_INTERVAL_MS`.
 *
 * Les années réellement utilisées voyagent avec les données (`baselineYears`),
 * pour que l'interface écrive « moyenne 2023-2025 » plutôt qu'un vague
 * « moyenne » dont personne ne connaîtrait la base.
 */
const BASELINE_YEARS = 3;

/** Combien de territoires et d'incendies marquants publier. */
const TOP_REGIONS = 12;
const TOP_NOTABLE = 8;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// --- Portugal : archive fogos.pt -------------------------------------------

const FOGOS_SEARCH = 'https://api.fogos.pt/v2/incidents/search';

interface FogosSearchResponse {
  paginator?: { totalItems?: number; totalPages?: number; currentPage?: number };
  data?: Array<{
    dateTime?: { sec?: number };
    district?: string | null;
    concelho?: string | null;
    isFire?: boolean;
  }>;
}

/**
 * Intervalle minimal entre deux requêtes à fogos.pt, en millisecondes.
 *
 * ⚠️ Ce n'est pas de la prudence décorative. api.fogos.pt est derrière
 * Cloudflare : enchaîner les 72 décomptes mensuels sans temporisation déclenche
 * un 429 dès la douzième requête (constaté). L'API est offerte gracieusement à
 * la communauté ; un script de build n'a aucune raison de la marteler.
 */
const FOGOS_MIN_INTERVAL_MS = 3500;

/** Nombre de tentatives avant d'abandonner une requête. */
const FOGOS_MAX_ATTEMPTS = 7;

/** Plafond de la reprise exponentielle. Au-delà, on n'attend plus utilement. */
const FOGOS_MAX_BACKOFF_MS = 120_000;

let lastFogosCall = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

/**
 * Appelle l'API en respectant la cadence, avec reprise exponentielle sur 429.
 *
 * Les requêtes sont sérialisées par construction (le script les `await` une à
 * une) : une simple horloge partagée suffit, sans file d'attente.
 */
async function fogosSearch(params: Record<string, string>): Promise<FogosSearchResponse> {
  const query = new URLSearchParams(params).toString();

  for (let attempt = 1; ; attempt += 1) {
    const wait = lastFogosCall + FOGOS_MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastFogosCall = Date.now();

    const response = await fetch(`${FOGOS_SEARCH}?${query}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });

    if (response.ok) return (await response.json()) as FogosSearchResponse;

    // 429 (quota) et 5xx (avarie passagère) méritent une seconde chance ; une
    // erreur de requête n'en mérite aucune, elle se reproduirait à l'identique.
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= FOGOS_MAX_ATTEMPTS) {
      throw new Error(`fogos.pt a répondu ${response.status} sur ${query}`);
    }

    const backoff = Math.min(2 ** attempt * 1000, FOGOS_MAX_BACKOFF_MS);
    console.warn(`fogos.pt ${response.status} — nouvelle tentative dans ${backoff / 1000} s`);
    await sleep(backoff);
  }
}

/**
 * Décompte d'occurrences sur un intervalle, SANS rapatrier les occurrences.
 *
 * `limit=1` puis lecture de `paginator.totalItems` : le serveur fait le compte,
 * on télécharge une ligne. C'est ce qui rend la courbe de référence abordable —
 * 72 intervalles coûtent 72 petites requêtes au lieu de 700 000 lignes.
 *
 * ⚠️ `before` seul est IGNORÉ par l'API (vérifié : il renvoie le total complet).
 * Il ne filtre qu'accompagné de `after`. Les deux sont donc toujours envoyés.
 */
async function countIncidents(after: string, before: string): Promise<number> {
  const payload = await fogosSearch({ after, before, limit: '1' });
  return payload.paginator?.totalItems ?? 0;
}

/**
 * Parcourt un intervalle page par page, pour les agrégats qui ont besoin du
 * détail de chaque occurrence (district, commune).
 */
async function collectIncidents(
  after: string,
  before: string
): Promise<Array<{ startedAt: number; district: string; municipality: string }>> {
  const collected: Array<{ startedAt: number; district: string; municipality: string }> = [];
  const pageSize = 1000;

  for (let page = 1; ; page += 1) {
    const payload = await fogosSearch({
      after,
      before,
      limit: String(pageSize),
      page: String(page),
    });
    const rows = payload.data ?? [];

    for (const row of rows) {
      const seconds = row.dateTime?.sec;
      if (!seconds) continue;
      collected.push({
        // L'API donne des SECONDES epoch, JavaScript raisonne en millisecondes.
        startedAt: seconds * 1000,
        district: (row.district ?? '').trim(),
        municipality: (row.concelho ?? '').trim(),
      });
    }

    if (rows.length < pageSize) break;

    const totalPages = payload.paginator?.totalPages ?? page;
    if (page >= totalPages) break;
  }

  return collected;
}

/**
 * Portugal — un seul balayage de l'année en cours, plus quelques décomptes.
 *
 * ⚠️ LA FORME DE CETTE FONCTION EST DICTÉE PAR LE QUOTA, pas par l'élégance.
 * api.fogos.pt, derrière Cloudflare, accepte environ cinq requêtes par fenêtre
 * de quinze secondes et refuse ensuite (429). Une courbe de référence mensuelle
 * sur trois ans demanderait 36 requêtes de plus ; elle a été essayée, et elle
 * échoue.
 *
 * On procède donc autrement :
 *   - la COURBE MENSUELLE de l'année en cours est déduite du balayage paginé,
 *     qu'on fait de toute façon pour la ventilation par district — zéro requête
 *     supplémentaire ;
 *   - la COMPARAISON avec les années précédentes se fait sur des totaux ANNUELS,
 *     soit une requête par année au lieu de douze.
 *
 * C'est moins fin qu'une courbe de référence, et c'est dit tel quel à l'écran
 * (`baseline` reste `null`). Mieux vaut une comparaison annuelle réelle qu'une
 * courbe mensuelle inventée.
 */
async function buildPortugalBlock(now: Date): Promise<HistoryBlock> {
  const currentYear = now.getUTCFullYear();

  // Balayage de l'année en cours : porte à la fois la courbe mensuelle, la
  // ventilation par district et le total.
  const yearStart = isoDay(new Date(Date.UTC(currentYear, 0, 1)));
  const tomorrow = isoDay(new Date(now.getTime() + MS_PER_DAY));
  const incidents = await collectIncidents(yearStart, tomorrow);

  const perMonth = new Array<number>(12).fill(0);
  for (const incident of incidents) {
    perMonth[new Date(incident.startedAt).getUTCMonth()] += 1;
  }

  // Les mois pas encore arrivés valent `null`, pas 0 : sinon la courbe pique à
  // zéro pour toute la fin de l'année et donne à voir un effondrement des feux.
  const currentMonth = now.getUTCMonth();

  const monthly: MonthlyCount[] = perMonth.map((count, index) => ({
    month: index + 1,
    count: index <= currentMonth ? count : null,
    // Pas de référence mensuelle : voir l'explication en tête de fonction.
    baseline: null,
  }));

  // Totaux annuels : une requête de décompte par année, sans rapatrier les
  // occurrences. Tolérant à l'échec — perdre la comparaison annuelle ne doit
  // pas faire perdre l'année en cours, qui est la donnée principale.
  const yearly: YearlyCount[] = [];
  const baselineYears: number[] = [];
  for (let offset = BASELINE_YEARS; offset >= 1; offset -= 1) {
    const year = currentYear - offset;
    try {
      const count = await countIncidents(
        isoDay(new Date(Date.UTC(year, 0, 1))),
        isoDay(new Date(Date.UTC(year + 1, 0, 1)))
      );
      yearly.push({ year, incidents: count, burnedHa: null, partial: false });
      baselineYears.push(year);
    } catch (error: unknown) {
      console.warn(`Total ${year} indisponible :`, error instanceof Error ? error.message : error);
    }
  }
  yearly.push({
    year: currentYear,
    incidents: incidents.length,
    burnedHa: null,
    // L'année en cours n'est pas comparable telle quelle à une année complète :
    // le drapeau évite de conclure « 2026 est une année calme » un 30 juillet.
    partial: true,
  });

  const perDistrict = new Map<string, number>();
  for (const incident of incidents) {
    if (!incident.district) continue;
    perDistrict.set(incident.district, (perDistrict.get(incident.district) ?? 0) + 1);
  }

  const regions: RegionStat[] = [...perDistrict.entries()]
    .map(([name, count]) => ({
      name,
      incidents: count,
      // L'archive portugaise ne porte pas de surface exploitable : `null` dit
      // « non publié », là où 0 aurait dit « rien n'a brûlé ».
      burnedHa: null,
    }))
    .sort((a, b) => b.incidents - a.incidents)
    .slice(0, TOP_REGIONS);

  const timestamps = incidents.map((incident) => incident.startedAt);

  return {
    source: 'anepc',
    coverage: 'Portugal',
    currentYear,
    baselineYears,
    rangeStart: timestamps.length ? Math.min(...timestamps) : Date.UTC(currentYear, 0, 1),
    rangeEnd: timestamps.length ? Math.max(...timestamps) : now.getTime(),
    totalIncidents: incidents.length,
    totalBurnedHa: null,
    monthly,
    yearly,
    regions,
    // Aucun classement d'incendies marquants : il se ferait sur la surface
    // brûlée, que cette archive ne publie pas. Une liste bâtie sur les effectifs
    // engagés classerait des feux urbains devant des feux de forêt.
    notable: [],
  };
}

// --- Castilla y León : archive de la Junta ---------------------------------

const JCYL_EXPORT =
  'https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/incendios-forestales/exports/json?lang=es&timezone=Europe%2FMadrid';

async function buildCastillaYLeonBlock(now: Date): Promise<HistoryBlock> {
  const response = await fetch(JCYL_EXPORT, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`JCyL a répondu ${response.status}`);

  const rows = (await response.json()) as JcylRecord[];
  // ⚠️ Sans ce dédoublonnage, un incendie de dix jours compterait pour vingt :
  // le portail publie un bulletin deux fois par jour. Voir `dedupeReports`.
  const fires = dedupeReports(rows);

  const currentYear = now.getUTCFullYear();

  interface Fire {
    startedAt: number;
    province: string;
    municipality: string;
    burnedHa: number | null;
  }

  /**
   * Nom de province brut → clé de comparaison, accents retirés.
   *
   * ⚠️ Le champ n'est pas propre à la source, et le laisser tel quel éclate le
   * classement par territoire : « ÁVILA » et « AVILA » y figurent comme deux
   * provinces distinctes (369 et 162 incendies au lieu de 531), et une ligne
   * « SEGOVIA,SEGOVIA » en crée une troisième à un seul incendie.
   */
  const provinceKey = (raw: string): string =>
    (raw.split(',')[0]?.trim() ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

  const rawProvinceOf = (record: JcylRecord): string =>
    (Array.isArray(record.provincia)
      ? (record.provincia[0] ?? '')
      : (record.provincia ?? '')
    ).trim();

  /**
   * Forme d'affichage retenue par clé.
   *
   * ⚠️ EN DEUX PASSES, et c'est indispensable. Une première version décidait la
   * forme canonique au fil de l'eau : les incendies rencontrés AVANT la première
   * occurrence accentuée gardaient « AVILA », les suivants recevaient « ÁVILA »,
   * et la province restait scindée en deux — le bogue même qu'on cherchait à
   * corriger. On choisit donc la forme après avoir tout parcouru.
   *
   * À clés égales, on garde la variante accentuée : « Ávila » est l'orthographe
   * correcte, ce n'est pas à nous de la dégrader.
   */
  const displayName = new Map<string, string>();
  for (const record of fires) {
    const candidate = rawProvinceOf(record).split(',')[0]?.trim() ?? '';
    const key = provinceKey(candidate);
    if (!key) continue;

    const current = displayName.get(key);
    if (!current || (current === key && candidate !== key)) displayName.set(key, candidate);
  }

  const parsed: Fire[] = [];
  for (const record of fires) {
    const startedAt = parseSpanishDateTime(record.fecha_de_inicio, record.hora_de_inicio);
    if (startedAt === null) continue;

    const key = provinceKey(rawProvinceOf(record));
    const province = key ? (displayName.get(key) ?? key) : '';

    parsed.push({
      startedAt,
      province,
      municipality: (record.termino_municipal ?? '').trim(),
      burnedHa: parseBurnedArea(record.tipo_y_has_de_superficie_afectada).total,
    });
  }

  const years = [...new Set(parsed.map((fire) => new Date(fire.startedAt).getUTCFullYear()))].sort();
  const baselineYears = years.filter((year) => year < currentYear).slice(-BASELINE_YEARS);

  /**
   * Mois que la source COUVRE réellement.
   *
   * ⚠️ Le « parte diario » n'est publié que pendant la campagne estivale : sur
   * cinq ans d'archive, les mois d'hiver ne contiennent aucune ligne. Les
   * compter 0 affirmerait qu'il ne brûle rien en Castille-et-León de novembre à
   * mai, ce qui est faux — c'est le bulletin qui s'arrête, pas les incendies.
   *
   * Un mois sans le moindre enregistrement sur TOUTE l'archive est donc déclaré
   * non couvert (`null`), tandis qu'un mois habituellement couvert mais vide
   * cette année reste un vrai 0.
   */
  const monthIsCovered = new Array<boolean>(12).fill(false);
  for (const fire of parsed) {
    monthIsCovered[new Date(fire.startedAt).getUTCMonth()] = true;
  }

  const currentMonth = now.getUTCMonth();

  const monthly: MonthlyCount[] = [];
  for (let month = 0; month < 12; month += 1) {
    const inMonth = (year: number) =>
      parsed.filter((fire) => {
        const date = new Date(fire.startedAt);
        return date.getUTCFullYear() === year && date.getUTCMonth() === month;
      }).length;

    const covered = monthIsCovered[month];
    const baselineCounts = covered ? baselineYears.map(inMonth) : [];

    monthly.push({
      month: month + 1,
      count: covered && month <= currentMonth ? inMonth(currentYear) : null,
      baseline: baselineCounts.length
        ? Math.round(baselineCounts.reduce((sum, v) => sum + v, 0) / baselineCounts.length)
        : null,
    });
  }

  // Totaux annuels : gratuits ici, tout l'historique est déjà en mémoire.
  const yearly: YearlyCount[] = years.map((year) => {
    const ofYear = parsed.filter((fire) => new Date(fire.startedAt).getUTCFullYear() === year);
    return {
      year,
      incidents: ofYear.length,
      burnedHa: Math.round(ofYear.reduce((sum, fire) => sum + (fire.burnedHa ?? 0), 0)),
      partial: year === currentYear,
    };
  });

  const perProvince = new Map<string, { incidents: number; burnedHa: number }>();
  for (const fire of parsed) {
    if (!fire.province) continue;
    const entry = perProvince.get(fire.province) ?? { incidents: 0, burnedHa: 0 };
    entry.incidents += 1;
    entry.burnedHa += fire.burnedHa ?? 0;
    perProvince.set(fire.province, entry);
  }

  const regions: RegionStat[] = [...perProvince.entries()]
    .map(([name, entry]) => ({
      name,
      incidents: entry.incidents,
      burnedHa: Math.round(entry.burnedHa),
    }))
    .sort((a, b) => (b.burnedHa ?? 0) - (a.burnedHa ?? 0))
    .slice(0, TOP_REGIONS);

  const notable: NotableFire[] = parsed
    .filter((fire): fire is Fire & { burnedHa: number } => fire.burnedHa !== null)
    .sort((a, b) => b.burnedHa - a.burnedHa)
    .slice(0, TOP_NOTABLE)
    .map((fire) => ({
      id: `jcyl-${fire.municipality}-${fire.startedAt}`,
      name: fire.municipality,
      location: fire.province,
      startedAt: fire.startedAt,
      burnedHa: Math.round(fire.burnedHa),
    }));

  const timestamps = parsed.map((fire) => fire.startedAt);
  const totalBurned = parsed.reduce((sum, fire) => sum + (fire.burnedHa ?? 0), 0);

  return {
    source: 'jcyl',
    coverage: 'Castilla y León',
    currentYear,
    baselineYears,
    rangeStart: Math.min(...timestamps),
    rangeEnd: Math.max(...timestamps),
    totalIncidents: parsed.length,
    totalBurnedHa: Math.round(totalBurned),
    monthly,
    yearly,
    regions,
    notable,
  };
}

async function main(): Promise<void> {
  const now = new Date();

  const [portugal, castilla] = await Promise.allSettled([
    buildPortugalBlock(now),
    buildCastillaYLeonBlock(now),
  ]);

  const blocks: HistoryBlock[] = [];
  for (const result of [portugal, castilla]) {
    if (result.status === 'fulfilled') blocks.push(result.value);
    else console.error('Bloc ignoré :', result.reason);
  }

  // Publier un historique vide donnerait une vue muette impossible à distinguer
  // d'une absence de feux. On préfère échouer et conserver le fichier précédent.
  if (blocks.length === 0) throw new Error('Aucune archive exploitable.');

  const payload: HistoryPayload = { generatedAt: Date.now(), blocks };

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(payload));

  for (const block of blocks) {
    console.log(
      `${block.coverage} : ${block.totalIncidents} occurrences · ` +
        `${block.totalBurnedHa === null ? 'surfaces non publiées' : `${block.totalBurnedHa} ha`} · ` +
        `référence ${block.baselineYears.join(', ') || '(aucune)'}`
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
