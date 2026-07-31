/**
 * Filtres de la liste des sinistres.
 *
 * POURQUOI ce module existe, alors que la logique tenait dans `IncidentListView` :
 *
 * Le filtrage y était appliqué au RENDU de la liste, sur une copie locale. La
 * carte, elle, recevait les incidents du périmètre entier. Chercher « Chaves »
 * ou ne garder que les feux aériens réduisait donc la colonne de gauche, pendant
 * que la carte continuait d'afficher tout le reste.
 *
 * C'est une incohérence coûteuse sur une carte de sécurité publique : les deux
 * moitiés de l'écran affirment en même temps deux réalités différentes, et rien
 * n'indique laquelle fait foi. Le filtre devient alors un piège — on croit avoir
 * restreint la vue, on n'a restreint qu'une liste.
 *
 * Le prédicat vit désormais ici, appliqué UNE fois en amont dans `App`, et les
 * deux vues consomment le même tableau.
 */

import type { Incident } from '../types';
import { resolvePhase } from './status.ts';

/**
 * Filtre rapide, réservé au mobile, où la place manque pour le menu complet.
 *
 * Les valeurs sont celles d'origine, en anglais : elles servent de clés, jamais
 * d'étiquettes. Ce que l'utilisateur lit passe par `t()`.
 */
export type ChipFilter = 'all' | '> 100 Ops' | 'Aerial Assets' | 'Resolution';

/**
 * Filtre de statut valant pour TOUTES les phases encore combattues.
 *
 * Ce n'est pas une phase — c'est le groupe de celles dont `ongoing` est vrai
 * (voir `src/lib/status.ts`). Il existe parce que c'est la question que se pose
 * réellement quelqu'un qui ouvre la carte : « qu'est-ce qui brûle en ce moment ? »
 * Y répondre demandait sinon de cocher quatre phases à la main.
 */
export const ONGOING_FILTER = 'ongoing';

export interface IncidentFilters {
  searchTerm: string;
  /** Phase canonique, `ongoing`, ou `all`. Voir `src/lib/status.ts`. */
  statusFilter: string;
  chipFilter: ChipFilter;
}

/**
 * Filtres au chargement.
 *
 * ⚠️ On démarre sur `ongoing`, PAS sur `all`. Les services publient des
 * sinistres plusieurs jours après leur extinction ; une liste non filtrée
 * s'ouvre donc sur des feux terminés, mêlés aux feux en cours, sans que rien ne
 * les distingue au premier coup d'œil. Le défaut doit répondre à la question la
 * plus fréquente, pas exposer l'archive.
 *
 * En contrepartie, ce filtre DOIT rester visible et réversible dans le menu :
 * un tri actif que l'utilisateur n'a pas choisi et qu'il ne peut pas voir est
 * un mensonge par omission — il croirait que la carte est vide.
 */
export const DEFAULT_FILTERS: IncidentFilters = {
  searchTerm: '',
  statusFilter: ONGOING_FILTER,
  chipFilter: 'all',
};

/** Un filtre est-il actif ? Sert à signaler que la carte est restreinte. */
export function hasActiveFilters(filters: IncidentFilters): boolean {
  return (
    filters.searchTerm.trim() !== '' ||
    filters.statusFilter !== 'all' ||
    filters.chipFilter !== 'all'
  );
}

/** Le statut passe-t-il le filtre ? `ongoing` désigne un GROUPE de phases. */
function matchesStatus(incident: Incident, statusFilter: string): boolean {
  if (statusFilter === 'all') return true;
  if (statusFilter === ONGOING_FILTER) return resolvePhase(incident.phase).ongoing;
  return incident.phase === statusFilter;
}

function matchesSearch(incident: Incident, term: string): boolean {
  if (term === '') return true;

  const needle = term.toLowerCase();
  return (
    incident.title.toLowerCase().includes(needle) ||
    incident.locationName.toLowerCase().includes(needle) ||
    incident.district.toLowerCase().includes(needle) ||
    incident.municipality.toLowerCase().includes(needle)
  );
}

function matchesChip(incident: Incident, chip: ChipFilter): boolean {
  switch (chip) {
    // `?? 0` seulement ICI : un service qui ne publie pas ses effectifs ne peut
    // pas satisfaire un filtre « plus de 100 opérationnels ». C'est un filtre,
    // pas un total — il restreint, il n'affirme rien.
    case '> 100 Ops':
      return (incident.personnel ?? 0) > 100;
    case 'Aerial Assets':
      return (incident.aircraft ?? 0) > 0;
    case 'Resolution':
      return resolvePhase(incident.phase).ongoing;
    case 'all':
    default:
      return true;
  }
}

export function filterIncidents(incidents: Incident[], filters: IncidentFilters): Incident[] {
  return incidents.filter(
    (incident) =>
      matchesSearch(incident, filters.searchTerm) &&
      matchesStatus(incident, filters.statusFilter) &&
      matchesChip(incident, filters.chipFilter)
  );
}
