/**
 * Filtrage et totalisation par périmètre.
 *
 * Extrait de `App.tsx` parce que les règles de totalisation portent une décision
 * éditoriale qui mérite d'être lisible ailleurs que dans un composant : ce qui
 * s'additionne, ce qui ne s'additionne pas, et ce qu'on affiche quand on ne sait
 * pas.
 */

import { SOURCES, type Incident, type ViewScope } from '../types';
import { resolvePhase } from './status.ts';

/** Les incidents du périmètre demandé. */
export function filterByScope(incidents: Incident[], scope: ViewScope): Incident[] {
  if (scope === 'iberia') return incidents;

  const country = scope === 'portugal' ? 'PT' : 'ES';
  return incidents.filter((incident) => SOURCES[incident.source].country === country);
}

/**
 * Total d'une colonne de moyens.
 *
 * ⚠️ Les `null` sont IGNORÉS, jamais traités comme des zéros — c'est toute la
 * question. Un service qui ne publie pas ses effectifs ne doit pas tirer le
 * total vers le bas comme s'il n'avait envoyé personne.
 *
 * @returns `null` si AUCUN incident ne publie cette valeur : il n'y a alors rien
 *   à afficher, et « 0 » serait une affirmation qu'on ne peut pas soutenir.
 */
function sumPublished(values: Array<number | null>): number | null {
  let total = 0;
  let published = false;

  for (const value of values) {
    if (value === null) continue;
    total += value;
    published = true;
  }

  return published ? total : null;
}

export interface ScopeStats {
  /** Sinistres encore combattus, selon la phase canonique. */
  activeCount: number;
  personnel: number | null;
  vehicles: number | null;
  aircraft: number | null;
  /**
   * Le total d'effectifs sous-compte-t-il ?
   *
   * Vrai dès qu'un incident du périmètre publie un décompte partiel (services
   * espagnols) ou ne publie rien. L'interface préfixe alors le nombre d'un « ≥ »
   * plutôt que de le présenter comme un total établi.
   */
  personnelIsPartial: boolean;
}

export function computeStats(incidents: Incident[]): ScopeStats {
  const ongoing = incidents.filter((incident) => resolvePhase(incident.phase).ongoing);

  return {
    activeCount: ongoing.length,
    personnel: sumPublished(ongoing.map((incident) => incident.personnel)),
    vehicles: sumPublished(ongoing.map((incident) => incident.vehicles)),
    aircraft: sumPublished(ongoing.map((incident) => incident.aircraft)),
    personnelIsPartial: ongoing.some(
      (incident) => incident.personnelIsPartial || incident.personnel === null
    ),
  };
}
