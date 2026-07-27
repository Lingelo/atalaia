/**
 * Registre unique des statuts d'incident.
 *
 * Remplace les trois `switch` dupliqués (InteractiveMap, IncidentListView,
 * IncidentDetailPanel) qui comparaient des chaînes portugaises accentuées et ne
 * couvraient que 4 des 8 statuts — les autres tombaient sur un rose par défaut.
 *
 * DÉCISION : on indexe sur `statusCode` (numérique, stable) et NON sur le libellé.
 * Un accent ou un renommage côté source ne doit pas casser la carte.
 *
 * DÉCISION : on IGNORE délibérément le champ `statusColor` de l'API, qui attribue
 * le même vert #6ABF59 à « Em Resolução » (les secours combattent encore) et à
 * « Vigilância » (le feu est éteint). Deux situations opposées, une seule couleur :
 * inexploitable. On impose donc notre propre échelle, reprise de la maquette.
 */

export interface StatusMeta {
  code: number;
  /**
   * Libellé BRUT tel que renvoyé par la source, en portugais.
   *
   * Ne pas l'afficher directement : passer par `t('status.<code>')`. Ce champ ne
   * sert que de repli de diagnostic pour un code inconnu du registre. C'est
   * précisément parce que l'indexation se fait sur `code` et non sur le texte que
   * les statuts sont traduisibles, contrairement aux toponymes.
   */
  label: string;
  /** Couleur imposée (voir décision ci-dessus). */
  color: string;
  /**
   * Le sinistre est-il encore combattu ? Pilote le compteur « ocorrências ativas »
   * et le tri par gravité.
   */
  ongoing: boolean;
  /** Rang de gravité, croissant. Sert au tri de la liste. */
  severity: number;
}

/**
 * Codes observés dans les réponses réelles (relevé du 27/07/2026 : 4, 5, 7, 8, 9).
 * Les codes 1, 2, 3, 6 et 10 existent au catalogue ANEPC mais n'ont pas été
 * observés ; leurs libellés ici sont donc à confirmer contre une réponse réelle
 * en pic d'activité avant d'être considérés comme sûrs.
 */
export const STATUS_REGISTRY: Record<number, StatusMeta> = {
  1: { code: 1, label: 'Despacho', color: '#f97316', ongoing: true, severity: 60 },
  2: { code: 2, label: 'Despacho de 1º Alerta', color: '#f97316', ongoing: true, severity: 65 },
  3: { code: 3, label: 'Chegada ao TO', color: '#f97316', ongoing: true, severity: 70 },
  4: { code: 4, label: 'Despacho de 1º Alerta', color: '#f97316', ongoing: true, severity: 65 },
  5: { code: 5, label: 'Em Curso', color: '#ef4444', ongoing: true, severity: 100 },
  6: { code: 6, label: 'Chegada ao TO', color: '#f97316', ongoing: true, severity: 70 },
  7: { code: 7, label: 'Em Resolução', color: '#fbbf24', ongoing: true, severity: 80 },
  8: { code: 8, label: 'Conclusão', color: '#10b981', ongoing: false, severity: 30 },
  9: { code: 9, label: 'Vigilância', color: '#3b82f6', ongoing: false, severity: 20 },
  10: { code: 10, label: 'Encerrada', color: '#6b7280', ongoing: false, severity: 10 },
};

/** Couleur de repli pour un statut inconnu — volontairement neutre, jamais alarmante. */
const UNKNOWN_COLOR = '#9ca3af';

/**
 * Résout un statut sans jamais échouer.
 *
 * Un code inconnu est traité comme ONGOING à dessein : sur une carte de sécurité
 * publique, mieux vaut afficher un feu qui ne brûle plus que masquer un feu actif
 * parce que la source a introduit un code qu'on n'avait pas prévu.
 */
export function resolveStatus(statusCode: number, fallbackLabel: string): StatusMeta {
  const known = STATUS_REGISTRY[statusCode];
  if (known) return known;

  return {
    code: statusCode,
    label: fallbackLabel || `Estado ${statusCode}`,
    color: UNKNOWN_COLOR,
    ongoing: true,
    severity: 50,
  };
}
