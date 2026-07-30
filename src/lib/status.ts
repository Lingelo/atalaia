/**
 * Registre unique des phases de sinistre, et traduction depuis chaque source.
 *
 * DÉCISION : on indexe la logique sur une PHASE canonique (`IncidentPhase`) et
 * non sur le libellé publié. Quatre services décrivent la même réalité avec
 * quatre vocabulaires ; comparer des chaînes accentuées à travers quatre
 * langues casserait au premier renommage amont. Et il y a de quoi se méfier :
 * l'archive de la Junta de Castilla y León contient réellement « EXTINGUDO »
 * et « CONTROLADO (24/06/2022 21:00) » — une comparaison stricte les aurait
 * classés en statut inconnu.
 *
 * DÉCISION : on IGNORE délibérément le champ `statusColor` de l'API portugaise,
 * qui attribue le même vert #6ABF59 à « Em Resolução » (les secours combattent
 * encore) et à « Vigilância » (le feu est éteint). Deux situations opposées,
 * une seule couleur : inexploitable. On impose donc notre propre échelle.
 */

import type { IncidentPhase } from '../types';

export interface PhaseMeta {
  phase: IncidentPhase;
  /** Couleur imposée (voir décision ci-dessus). */
  color: string;
  /**
   * Le sinistre est-il encore combattu ? Pilote le compteur « occurrences
   * actives » et le tri par gravité.
   */
  ongoing: boolean;
  /** Rang de gravité, croissant. Sert au tri de la liste. */
  severity: number;
}

export const PHASE_REGISTRY: Record<IncidentPhase, PhaseMeta> = {
  dispatched: { phase: 'dispatched', color: '#f97316', ongoing: true, severity: 70 },
  active: { phase: 'active', color: '#ef4444', ongoing: true, severity: 100 },
  /** Le feu ne progresse plus mais n'est pas maîtrisé : toujours en intervention. */
  stabilised: { phase: 'stabilised', color: '#fbbf24', ongoing: true, severity: 85 },
  controlled: { phase: 'controlled', color: '#eab308', ongoing: true, severity: 80 },
  extinguished: { phase: 'extinguished', color: '#10b981', ongoing: false, severity: 30 },
  surveillance: { phase: 'surveillance', color: '#3b82f6', ongoing: false, severity: 20 },
  closed: { phase: 'closed', color: '#6b7280', ongoing: false, severity: 10 },
  /**
   * Phase inconnue traitée comme ONGOING à dessein : sur une carte de sécurité
   * publique, mieux vaut afficher un feu qui ne brûle plus que masquer un feu
   * actif parce qu'un service a introduit un libellé qu'on n'avait pas prévu.
   */
  unknown: { phase: 'unknown', color: '#9ca3af', ongoing: true, severity: 50 },
};

export function resolvePhase(phase: IncidentPhase): PhaseMeta {
  return PHASE_REGISTRY[phase] ?? PHASE_REGISTRY.unknown;
}

// --- Portugal : ANEPC via fogos.pt -----------------------------------------

/**
 * Libellés portugais par code, tels que publiés.
 *
 * Codes observés dans les réponses réelles (relevés du 27/07/2026 et du
 * 30/07/2026 : 4, 5, 7, 8, 9). Les codes 1, 2, 3, 6 et 10 existent au catalogue
 * ANEPC mais n'ont pas été observés ; leurs libellés sont donc à confirmer
 * contre une réponse réelle en pic d'activité.
 */
export const ANEPC_LABELS: Record<number, string> = {
  1: 'Despacho',
  2: 'Despacho de 1º Alerta',
  3: 'Chegada ao TO',
  4: 'Despacho de 1º Alerta',
  5: 'Em Curso',
  6: 'Chegada ao TO',
  7: 'Em Resolução',
  8: 'Conclusão',
  9: 'Vigilância',
  10: 'Encerrada',
};

const ANEPC_PHASES: Record<number, IncidentPhase> = {
  1: 'dispatched',
  2: 'dispatched',
  3: 'dispatched',
  4: 'dispatched',
  5: 'active',
  6: 'dispatched',
  7: 'controlled',
  8: 'extinguished',
  9: 'surveillance',
  10: 'closed',
};

export function phaseFromAnepcCode(statusCode: number): IncidentPhase {
  return ANEPC_PHASES[statusCode] ?? 'unknown';
}

// --- Espagne ---------------------------------------------------------------

/**
 * Normalise un libellé amont avant comparaison : accents retirés, casse et
 * espaces uniformisés.
 *
 * Nécessaire, et pas seulement prudent : les archives espagnoles contiennent
 * des libellés suffixés d'une date (« EXTINGUIDO (02/08/2022 18:45 ») et au
 * moins une faute de frappe (« EXTINGUDO »). On compare donc par PRÉFIXE sur
 * une forme normalisée, jamais par égalité stricte.
 */
function normalise(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

/**
 * Phases espagnoles, par préfixe normalisé.
 *
 * Couvre les trois vocabulaires rencontrés : castillan de l'INFOCA et de la
 * Junta de Castilla y León, catalan des Bombers.
 *
 * L'ordre compte, et il n'est pas alphabétique : les préfixes les plus longs
 * passent AVANT les plus courts qui les contiennent, sans quoi « VIGILANCIA
 * ACTIVA » ne serait jamais atteint. « EXTINGU » attrape d'un seul tenant
 * « EXTINGUIDO », « EXTINGUDO » et « EXTINGUINT ».
 */
const SPANISH_PREFIXES: Array<[string, IncidentPhase]> = [
  ['VIGILANCIA', 'surveillance'],
  ['ACTIVO', 'active'],
  ['ACTIU', 'active'],
  ['EN CURSO', 'active'],
  ['EN PERIMETRACION', 'active'],
  ['ESTABILIZADO', 'stabilised'],
  ['ESTABILITZAT', 'stabilised'],
  ['CONTROLADO', 'controlled'],
  ['CONTROLAT', 'controlled'],
  ['EXTINGU', 'extinguished'],
  ['EXTINGI', 'extinguished'],
  ['APAGAT', 'extinguished'],
  ['REVISIO', 'surveillance'],
  ['TANCAT', 'closed'],
  ['CERRADO', 'closed'],
];

export function phaseFromSpanishLabel(label: string | null | undefined): IncidentPhase {
  if (!label) return 'unknown';
  const value = normalise(label);
  for (const [prefix, phase] of SPANISH_PREFIXES) {
    if (value.startsWith(prefix)) return phase;
  }
  return 'unknown';
}
