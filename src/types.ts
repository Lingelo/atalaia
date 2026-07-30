/**
 * Types de domaine consommés par l'UI.
 *
 * Distincts des types bruts des API (`src/api/*Types.ts`) : la frontière est le
 * module de chaque source, qui traduit l'un vers l'autre. L'UI ne doit jamais
 * voir la forme brute — c'est ce qui permet d'absorber le changement d'une
 * source en un seul endroit.
 */

import type { FogosWeather } from './api/fogosTypes';

export interface TimelineEvent {
  status: string;
  time: string;
  isCurrent?: boolean;
}

/** Ventilation de la surface brûlée, en hectares (valeurs absolues, pas des %). */
export interface BurnedBreakdown {
  povoamentoHa: number;
  matoHa: number;
  agricolaHa: number;
}

/**
 * Service qui publie l'incident.
 *
 * Porté sur CHAQUE incident, et non déduit du pays : l'Espagne est couverte par
 * trois services régionaux distincts, qui ne publient ni les mêmes champs ni à
 * la même cadence. Sans cette étiquette, l'interface ne pourrait pas dire d'où
 * vient un chiffre, ni pourquoi il manque ailleurs.
 */
export type IncidentSource = 'anepc' | 'infoca' | 'bombers' | 'jcyl';

/** Métadonnées d'une source, pour l'attribution affichée. */
export interface SourceMeta {
  id: IncidentSource;
  /** Nom du service, tel qu'il se nomme lui-même. Jamais traduit. */
  name: string;
  /** ISO 3166-1 alpha-2. */
  country: 'PT' | 'ES';
  /** Territoire réellement couvert — pas le pays entier, sauf pour l'ANEPC. */
  territory: string;
}

export const SOURCES: Record<IncidentSource, SourceMeta> = {
  anepc: { id: 'anepc', name: 'ANEPC (fogos.pt)', country: 'PT', territory: 'Portugal' },
  infoca: { id: 'infoca', name: 'Plan INFOCA', country: 'ES', territory: 'Andalucía' },
  bombers: {
    id: 'bombers',
    name: 'Bombers de la Generalitat',
    country: 'ES',
    territory: 'Catalunya',
  },
  jcyl: { id: 'jcyl', name: 'Junta de Castilla y León', country: 'ES', territory: 'Castilla y León' },
};

/**
 * Phase canonique d'un sinistre.
 *
 * Introduite parce que quatre services décrivent la même réalité avec quatre
 * vocabulaires : l'ANEPC publie un code numérique (5 = « Em Curso »),
 * l'INFOCA une chaîne espagnole (« ACTIVO »), les Bombers une phase catalane
 * (« Actiu »), la Junta de Castilla y León encore une autre (« CONTROLADO »).
 *
 * Toute LOGIQUE (couleur, tri, compteur « en cours ») passe par cette phase.
 * Les libellés d'origine restent disponibles pour l'affichage, mais ne sont
 * jamais comparés : un accent ou une faute de frappe amont — et il y en a,
 * « EXTINGUDO » est réellement présent dans les données de la Junta — ne doit
 * pas faire disparaître un feu de la carte.
 */
export type IncidentPhase =
  | 'dispatched'
  | 'active'
  | 'stabilised'
  | 'controlled'
  | 'extinguished'
  | 'surveillance'
  | 'closed'
  | 'unknown';

/**
 * Un poste de moyens tel que la source le publie.
 *
 * Existe parce que les services ne comptent pas la même chose. L'ANEPC publie
 * un EFFECTIF (nombre de personnes) ; l'INFOCA publie des GROUPES (« 6 grupos
 * de especialistas ») ; la Junta de Castilla y León publie une liste en texte
 * libre (« 3 Técnicos;15 A.M.;8 Autobombas »). Additionner des personnes et
 * des groupes donnerait un nombre qui ne veut rien dire.
 *
 * On conserve donc le détail publié, avec son unité, et on ne totalise que ce
 * qui est comparable (voir `personnel`, `vehicles`, `aircraft`).
 */
export interface ResourceEntry {
  /** Libellé d'origine, dans la langue du service. Non traduit : c'est une citation. */
  label: string;
  count: number;
  /** `people` : un effectif. `units` : des groupes, brigades ou engins. */
  unit: 'people' | 'units';
}

export interface Incident {
  id: string;

  /** Service qui publie cet incident. */
  source: IncidentSource;

  /** Échelon le plus fin connu (freguesia, término municipal, municipi). */
  title: string;
  /** Contexte administratif, affiché en sous-titre. */
  locationName: string;
  /** District (PT) ou provincia / comarca (ES). */
  district: string;
  municipality: string;

  /** Libellé d'origine, pour affichage seul. Toute LOGIQUE passe par `phase`. */
  status: string;
  /** Phase canonique. Voir `src/lib/status.ts`. */
  phase: IncidentPhase;
  /**
   * Code de statut ANEPC, quand la source en publie un.
   *
   * null pour les services espagnols, qui n'ont pas d'équivalent numérique.
   * Conservé pour l'affichage du libellé traduit côté portugais uniquement.
   */
  statusCode: number | null;

  /**
   * Début du sinistre, en millisecondes epoch.
   *
   * Remplace l'ancien `timeAgo: string` de la maquette, qui était une chaîne figée
   * ("há 6 h") impossible à rafraîchir : au bout d'une heure d'onglet ouvert elle
   * mentait. Le formatage relatif se fait à l'affichage, via `formatTimeAgo`.
   */
  startedAt: number;

  /**
   * Moyens engagés — `null` quand la source NE LES PUBLIE PAS.
   *
   * ⚠️ La distinction null / 0 porte tout le sens de ce modèle, et c'est la
   * raison pour laquelle ces champs ne sont pas de simples `number`.
   *
   * Les Bombers de la Generalitat publient un nombre de véhicules mais aucun
   * effectif ; l'INFOCA publie des groupes, pas des personnes. Écrire `0` là où
   * la donnée est absente afficherait « 0 opérationnel » sur des feux qui
   * mobilisent des centaines de personnes, et laisserait conclure que
   * l'Espagne brûle sans que personne n'intervienne. C'est un artefact de
   * modèle de données, pas une réalité — et c'est exactement l'erreur que
   * l'ancien mode « Europe » évitait en refusant de fusionner les sources.
   *
   * `null` s'affiche « — » et n'entre dans AUCUN total.
   */
  personnel: number | null;
  vehicles: number | null;
  aircraft: number | null;

  /**
   * `personnel` ne compte-t-il qu'une PARTIE des personnes présentes ?
   *
   * ⚠️ Deuxième garde-fou indispensable, distinct du `null` ci-dessus, et pour
   * une raison différente.
   *
   * L'ANEPC publie un effectif TOTAL (`man`) : tous les opérationnels engagés.
   * Les services espagnols, eux, ne publient que des postes NOMMÉS — l'INFOCA
   * dénombre ses « técnicos », la Junta de Castilla y León ses « técnicos » et
   * ses « agentes medioambientales ». Les brigades (ELIF, BRIF, BRICA,
   * cuadrillas) sont publiées en NOMBRE D'ÉQUIPES, jamais en personnes.
   *
   * Un incendie andalou mobilisant cinq groupes de spécialistes affiche donc
   * « 1 técnico ». Présenté à côté d'un « 94 opérationnels » portugais sans
   * réserve, ce 1 ferait conclure que l'Espagne laisse brûler ses forêts. Le
   * drapeau permet à l'interface d'écrire « ≥ 1 » et de renvoyer au détail des
   * moyens, au lieu d'un nombre faussement définitif.
   */
  personnelIsPartial: boolean;

  /**
   * Détail des moyens tel que publié, quand il est plus riche que les trois
   * totaux ci-dessus. Affiché tel quel dans le panneau de détail.
   */
  resources: ResourceEntry[];

  lat: number;
  lng: number;

  nature: string;
  altitude: number | null;
  alertSource: string | null;

  /** null quand le service n'a pas (encore) estimé la surface — cas fréquent. */
  burnedAreaHa: number | null;
  burnedBreakdown: BurnedBreakdown | null;

  /**
   * Niveau de gravité publié par le service (IGR en Castilla y León : 0 à 2).
   * null quand la source n'en publie pas.
   */
  severityLevel: string | null;

  /** Relevé de la station météo la plus proche. Publié par l'ANEPC seule. */
  weather: FogosWeather | null;

  /**
   * Périmètre du feu, dérivé du KML. Rare (2 incidents sur 23 au relevé) :
   * la carte doit fonctionner sans.
   */
  polygonCoords?: Array<[number, number]>;

  /**
   * Chronologie des changements d'état.
   *
   * ⚠️ Aucun des services interrogés ne publie d'historique sur son endpoint
   * temps réel : ils ne renvoient que l'état courant. Ce champ reste donc vide
   * tant qu'on n'aura pas mis en place la persistance qui les échantillonne.
   */
  history: TimelineEvent[];

  /** État local d'abonnement (voir `useWatchZones` pour ce qui est persisté). */
  isFollowing?: boolean;
}

/**
 * Détection thermique satellite (NASA FIRMS).
 *
 * Type délibérément DISJOINT de `Incident`. Le discriminant `kind` interdit de
 * les confondre à la compilation : une détection satellite n'a ni phase, ni
 * moyens engagés, ni commune. Les deux ne doivent jamais être fusionnés dans
 * une même liste ni dans un même total.
 */
export interface SatelliteDetection {
  kind: 'satellite';
  id: string;
  lat: number;
  lng: number;
  /** Heure de passage du satellite, pas de départ du feu. Latence typique : 3 h. */
  detectedAt: number;
  /** Puissance radiative du feu, en mégawatts. Seul indicateur d'intensité. */
  frpMw: number;
  confidence: 'low' | 'nominal' | 'high';
  /** Nombre de détections regroupées dans ce foyer : un foyer persistant en cumule. */
  passes: number;
  /** Satellites l'ayant vu (N, N20, N21). */
  satellites: string[];
  /**
   * Pays d'appartenance (ISO 3166-1 alpha-2), attribué au build par test
   * point-dans-polygone. `null` en mer, ou quand le point tombe hors des
   * frontières de la couche utilisée.
   *
   * Existe parce qu'une liste mondiale de 86 000 foyers n'est lisible que
   * regroupée. Calculé au build, jamais dans le navigateur : la couche de
   * frontières pèse 3 Mo.
   */
  countryCode: string | null;
}

export interface WatchZone {
  id: string;
  name: string;
  locationName: string;
  lat: number;
  lng: number;
  radiusKm: number;
  condition: 'all' | 'major';
  active: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

// --- Types de la vue Analytics ---------------------------------------------
//
// Alimentés par `public/data/history.json`, produit par `scripts/build-history.ts`
// à partir des archives RÉELLES des services (voir ce script pour le détail des
// requêtes). Plus aucune donnée inventée ici.
//
// Chaque bloc porte sa propre couverture, parce qu'elle diffère : l'archive
// portugaise donne des DÉCOMPTES d'occurrences mais presque aucune surface
// brûlée (2 valeurs sur 1 000 relevées), là où celle de Castilla y León donne
// de vraies surfaces. Un écran qui mélangerait les deux sous un seul titre
// laisserait croire à une couverture homogène qui n'existe pas.

/** Décompte réel d'occurrences pour un mois donné. */
export interface MonthlyCount {
  /** 1 à 12. Le libellé est produit à l'affichage, selon la langue. */
  month: number;
  /**
   * Occurrences du mois pour l'année en cours.
   *
   * ⚠️ `null` signifie « pas de donnée », et JAMAIS « aucun incendie ». Deux
   * situations distinctes le produisent, et toutes deux se liraient de travers
   * en 0 :
   *
   *   - le mois n'est pas encore arrivé (nous sommes en juillet) ; un 0 ferait
   *     plonger la courbe à zéro pour le reste de l'année, donnant l'image
   *     d'une saison qui s'effondre ;
   *   - la source ne publie pas ce mois-là. Le bulletin de Castilla y León ne
   *     paraît que pendant la campagne estivale : un 0 en janvier affirmerait
   *     qu'il n'y brûle rien en hiver, ce qui est faux.
   */
  count: number | null;
  /**
   * Moyenne du même mois sur les années de référence (voir `baselineYears`).
   * null quand aucune année de référence ne couvre ce mois.
   */
  baseline: number | null;
}

/** Total réel d'une année civile. */
export interface YearlyCount {
  year: number;
  incidents: number;
  /** null quand la source ne publie pas de surface exploitable. */
  burnedHa: number | null;
  /** L'année est-elle encore en cours ? Interdit de la comparer telle quelle. */
  partial: boolean;
}

/** Agrégat réel par territoire (district portugais, provincia espagnole). */
export interface RegionStat {
  name: string;
  incidents: number;
  /** null quand la source ne publie pas de surface exploitable pour ce territoire. */
  burnedHa: number | null;
}

/** Occurrence réelle marquante, retenue sur la surface brûlée publiée. */
export interface NotableFire {
  id: string;
  name: string;
  location: string;
  /** Date de début réelle, en millisecondes epoch. */
  startedAt: number;
  burnedHa: number;
}

/**
 * Bloc d'historique d'UN service, avec sa couverture explicite.
 *
 * `coverage` n'est pas décoratif : c'est ce qui empêche de lire « 3 950
 * occurrences en juillet » comme une valeur ibérique alors qu'elle ne décrit
 * qu'un pays, ou qu'une seule communauté autonome.
 */
export interface HistoryBlock {
  source: IncidentSource;
  /** Territoire couvert, tel que publié par le service. */
  coverage: string;
  /** Année en cours, celle des `count` de `monthly`. */
  currentYear: number;
  /** Années servant de référence pour `baseline`. Vide si l'archive est trop courte. */
  baselineYears: number[];
  /** Première et dernière date réellement présentes dans l'archive (epoch ms). */
  rangeStart: number;
  rangeEnd: number;
  /** Occurrences totales de l'archive exploitée. */
  totalIncidents: number;
  /** Surface brûlée totale, ou null si le service n'en publie pas d'exploitable. */
  totalBurnedHa: number | null;
  monthly: MonthlyCount[];
  /**
   * Totaux par année civile, pour situer l'année en cours.
   *
   * Séparé de `monthly` parce qu'il coûte infiniment moins cher à obtenir côté
   * portugais : un décompte par année (4 requêtes) là où une courbe de référence
   * mensuelle en demanderait 36, que le quota de l'API ne laisse pas passer.
   * Vide quand la source ne permet pas de remonter dans le temps.
   */
  yearly: YearlyCount[];
  regions: RegionStat[];
  notable: NotableFire[];
}

export interface HistoryPayload {
  /** Instant de production de l'agrégat, pour afficher son âge réel. */
  generatedAt: number;
  blocks: HistoryBlock[];
}

/**
 * Périmètre affiché.
 *
 * `portugal` / `spain` / `iberia` : données OPÉRATIONNELLES de terrain
 *   (services de protection civile). L'Espagne est couverte par trois services
 *   régionaux — Andalucía, Catalunya, Castilla y León — et non par un service
 *   national, qui n'existe pas. Le mode l'annonce plutôt que de le masquer.
 *
 * `world` : détections satellite NASA FIRMS, seule source réellement mondiale.
 *
 * Les deux familles restent séparées : une détection satellite n'est pas un
 * sinistre confirmé, et les mélanger dans un même total comparerait des
 * effectifs de pompiers à des points chauds vus de l'orbite.
 */
export type ViewScope = 'portugal' | 'spain' | 'iberia' | 'world';

/** Périmètres opérationnels, par opposition au périmètre satellite. */
export const OPERATIONAL_SCOPES = ['portugal', 'spain', 'iberia'] as const;

export function isOperationalScope(scope: ViewScope): boolean {
  return scope !== 'world';
}

export type ViewTab = 'dashboard' | 'analytics' | 'watch-zones';
export type MapTileLayer = 'dark' | 'satellite' | 'terrain';
