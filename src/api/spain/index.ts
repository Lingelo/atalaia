/**
 * Espagne — agrégation des services régionaux.
 *
 * POURQUOI trois sources et non une : il N'EXISTE PAS de flux national espagnol
 * d'incendies en temps réel. La compétence est régionale, et chaque communauté
 * autonome publie — ou non — comme elle l'entend. Les trois retenues sont celles
 * qui publient des coordonnées exploitables :
 *
 *   - Andalucía (Plan INFOCA)          : moyens détaillés, position, état
 *   - Catalunya (Bombers)              : actuacions en cours, à la minute
 *   - Castilla y León (Junta)          : surface brûlée, niveau IGR, moyens
 *
 * ⚠️ LA COUVERTURE N'EST DONC PAS NATIONALE, et l'interface doit le dire. Ces
 * trois communautés concentrent l'essentiel de l'activité de la péninsule, mais
 * un feu en Galice, en Extremadure ou à Valence n'apparaîtra pas. Annoncer
 * « Espagne » sans cette réserve laisserait croire à une carte complète, et un
 * silence sur la carte serait alors lu comme « pas de feu » au lieu de
 * « pas de donnée ». C'est le sens de `SourceReport`, remonté jusqu'au bandeau.
 */

import type { Incident, IncidentSource } from '../../types';
import { fetchAndaluciaIncidents } from './andalucia.ts';
import { fetchCatalunyaIncidents } from './catalunya.ts';
import { fetchCastillaYLeonIncidents } from './castillayleon.ts';

/**
 * Fenêtre d'observation, en jours.
 *
 * Les services espagnols publient un HISTORIQUE de saison, là où l'endpoint
 * portugais ne renvoie que les sinistres en cours. Sans borne, la carte
 * espagnole se couvrirait de plusieurs centaines de feux éteints depuis des
 * mois, et paraîtrait absurdement plus active que la portugaise.
 *
 * Sept jours plutôt qu'un : un grand incendie reste en surveillance plusieurs
 * jours après avoir cessé de progresser, et le faire disparaître à minuit
 * donnerait l'impression qu'il a été réglé.
 */
export const SPAIN_WINDOW_DAYS = 7;

/**
 * Résultat d'interrogation d'UN service.
 *
 * Le champ `ok` existe pour que l'interface distingue « aucun feu » de « service
 * injoignable ». Sur une carte d'incendies, confondre les deux est la panne la
 * plus dangereuse possible : elle transforme une avarie technique en bonne
 * nouvelle.
 */
export interface SourceReport {
  source: IncidentSource;
  ok: boolean;
  count: number;
  /** Message d'erreur amont, conservé pour le diagnostic. */
  error?: string;
}

export interface RegionalIncidents {
  incidents: Incident[];
  reports: SourceReport[];
}

type Fetcher = (sinceMs: number, signal?: AbortSignal) => Promise<Incident[]>;

const SPANISH_FETCHERS: Array<[IncidentSource, Fetcher]> = [
  ['infoca', fetchAndaluciaIncidents],
  ['bombers', fetchCatalunyaIncidents],
  ['jcyl', fetchCastillaYLeonIncidents],
];

/**
 * Interroge les trois services en parallèle.
 *
 * `allSettled` et non `all` : si l'INFOCA est en maintenance, on affiche la
 * Catalogne et la Castille plutôt que de perdre toute l'Espagne. L'échec est
 * remonté dans `reports`, jamais avalé — un service muet dont personne ne
 * signale l'absence est pire qu'une erreur visible.
 */
export async function fetchSpainIncidents(
  now: number = Date.now(),
  signal?: AbortSignal
): Promise<RegionalIncidents> {
  const sinceMs = now - SPAIN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const settled = await Promise.allSettled(
    SPANISH_FETCHERS.map(([, fetcher]) => fetcher(sinceMs, signal))
  );

  const incidents: Incident[] = [];
  const reports: SourceReport[] = [];

  settled.forEach((result, index) => {
    const source = SPANISH_FETCHERS[index][0];

    if (result.status === 'fulfilled') {
      incidents.push(...result.value);
      reports.push({ source, ok: true, count: result.value.length });
    } else {
      reports.push({
        source,
        ok: false,
        count: 0,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  });

  return { incidents, reports };
}
