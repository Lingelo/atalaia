/**
 * Types de domaine consommés par l'UI.
 *
 * Distincts des types bruts de l'API (`src/api/fogosTypes.ts`) : la frontière est
 * `src/api/fogos.ts`, qui traduit l'un vers l'autre. L'UI ne doit jamais voir la
 * forme brute — c'est ce qui permet d'absorber un changement de la source en un
 * seul endroit.
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

export interface Incident {
  id: string;

  /** Freguesia — l'échelon le plus fin, affiché en titre. */
  title: string;
  /** "Distrito, Concelho" — le contexte, affiché en sous-titre. */
  locationName: string;
  district: string;
  municipality: string;

  /** Libellé portugais, pour affichage uniquement. Toute LOGIQUE passe par `statusCode`. */
  status: string;
  /** Clé de statut faisant autorité. Voir `src/lib/status.ts`. */
  statusCode: number;

  /**
   * Début du sinistre, en millisecondes epoch.
   *
   * Remplace l'ancien `timeAgo: string` de la maquette, qui était une chaîne figée
   * ("há 6 h") impossible à rafraîchir : au bout d'une heure d'onglet ouvert elle
   * mentait. Le formatage relatif se fait à l'affichage, via `formatTimeAgo`.
   */
  startedAt: number;

  operacionais: number;
  veiculos: number;
  meiosAereos: number;

  lat: number;
  lng: number;

  nature: string;
  altitude: number | null;
  alertSource: string | null;

  /** null quand l'ICNF n'a pas (encore) estimé la surface — cas fréquent. */
  burnedAreaHa: number | null;
  burnedBreakdown: BurnedBreakdown | null;

  /** Relevé de la station météo la plus proche. null sur ~30 % des incidents. */
  weather: FogosWeather | null;

  /**
   * Périmètre du feu, dérivé du KML. Rare (2 incidents sur 23 au relevé) :
   * la carte doit fonctionner sans.
   */
  polygonCoords?: Array<[number, number]>;

  /**
   * Chronologie des changements d'état.
   *
   * ⚠️ L'endpoint `/v2/incidents/active` ne fournit AUCUN historique : il ne
   * renvoie que l'état courant. Ce champ reste donc vide tant qu'on n'aura pas
   * mis en place la persistance qui échantillonne l'API dans le temps.
   */
  history: TimelineEvent[];

  /** État local d'abonnement (non persisté pour l'instant). */
  isFollowing?: boolean;
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
// ⚠️ Encore alimentés par des données de maquette (`src/data/mockData.ts`).
// Les brancher suppose d'ingérer l'historique (151 063 incidents) dans une base
// locale : l'endpoint de recherche est paginé et ne se requête pas à la volée.

export interface MonthlyStat {
  month: string;
  count2024: number;
  countAvg: number;
  burnedHa: number;
}

export interface TopMunicipality {
  name: string;
  ha: number;
  percentage: number;
}

export interface NotableRecord {
  id: string;
  name: string;
  location: string;
  year: number;
  ha: number;
  statusColor: 'primary' | 'outline' | 'tertiary';
}

export interface DistrictIntensity {
  district: string;
  riskLevel: number; // 1 à 4
  incidentsCount: number;
  burnedHa: number;
}

export type ViewTab = 'dashboard' | 'analytics' | 'watch-zones';
export type MapTileLayer = 'dark' | 'satellite' | 'terrain';
