/**
 * Point d'entrée unique des incidents opérationnels, Portugal et Espagne.
 *
 * ⚠️ NE PAS IMPORTER depuis les scripts de build : ce module lit
 * `import.meta.env`, qui n'existe que sous Vite. Les scripts appellent
 * directement `fogos.ts` et `spain/index.ts`, qui n'en dépendent pas.
 *
 * DEUX CHEMINS D'ACCÈS, dictés par le CORS et non par un choix d'architecture :
 *
 *   - api.fogos.pt ne renvoie pas d'en-tête `Access-Control-Allow-Origin` sur
 *     les GET (vérifié : le HEAD en renvoie un, le GET non — voir
 *     scripts/build-incidents.ts). Le navigateur ne peut donc pas l'appeler
 *     depuis un site statique : on passe par le jeu précalculé, ou par le proxy
 *     de développement.
 *
 *   - Les trois services espagnols, eux, renvoient bien l'en-tête (vérifié le
 *     30/07/2026 sur un vrai GET avec `Origin`). Ils sont donc interrogeables
 *     directement par le navigateur.
 *
 * Malgré cette asymétrie, la PRODUCTION lit tout depuis le jeu précalculé. Ce
 * n'est pas de la paresse : si l'Espagne était en direct et le Portugal vieux de
 * vingt minutes, un même bandeau « actualisé à l'instant » couvrirait deux
 * fraîcheurs différentes. Une seule date pour un seul jeu de données.
 */

import type { Incident } from '../types';
import { fetchActiveIncidents } from './fogos.ts';
import { fetchSpainIncidents, type SourceReport } from './spain/index.ts';

export interface OperationalPayload {
  /**
   * Instant où la donnée a été produite — PAS celui du téléchargement.
   *
   * Sans cette distinction, l'interface afficherait « actualisé à l'instant »
   * pour une donnée vieille d'une demi-heure. Sur une carte d'incendies, faire
   * passer une information périmée pour fraîche est le pire des mensonges.
   */
  generatedAt: number;
  incidents: Incident[];
  /** État de chaque service interrogé. Voir `SourceReport`. */
  reports: SourceReport[];
}

/** Jeu précalculé publié par `npm run build:incidents`. */
function prebuiltUrl(): string {
  return `${import.meta.env.BASE_URL}data/incidents.json`;
}

function runtimeProxy(): string {
  return import.meta.env.VITE_FOGOS_PROXY ?? '';
}

/**
 * Interroge les quatre services en direct.
 *
 * Le Portugal et l'Espagne sont lancés en parallèle, et l'échec du premier ne
 * fait pas tomber la seconde : chaque service a son entrée dans `reports`. Un
 * pays muet doit se voir, jamais se confondre avec un pays sans feu.
 */
export async function fetchLiveIncidents(signal?: AbortSignal): Promise<OperationalPayload> {
  const [portugal, spain] = await Promise.allSettled([
    fetchActiveIncidents(signal),
    fetchSpainIncidents(Date.now(), signal),
  ]);

  // Une annulation volontaire n'est pas une panne : on la laisse remonter pour
  // que le hook la distingue d'une erreur à afficher.
  for (const result of [portugal, spain]) {
    if (result.status === 'rejected') {
      const cause: unknown = result.reason;
      if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    }
  }

  const incidents: Incident[] = [];
  const reports: SourceReport[] = [];

  if (portugal.status === 'fulfilled') {
    incidents.push(...portugal.value.incidents);
    reports.push({ source: 'anepc', ok: true, count: portugal.value.incidents.length });
  } else {
    reports.push({
      source: 'anepc',
      ok: false,
      count: 0,
      error: portugal.reason instanceof Error ? portugal.reason.message : String(portugal.reason),
    });
  }

  if (spain.status === 'fulfilled') {
    incidents.push(...spain.value.incidents);
    reports.push(...spain.value.reports);
  } else {
    // `fetchSpainIncidents` avale déjà les échecs individuels : n'arriver ici
    // signifie que l'agrégation elle-même a échoué, ce qui vaut pour les trois.
    const error = spain.reason instanceof Error ? spain.reason.message : String(spain.reason);
    reports.push(
      { source: 'infoca', ok: false, count: 0, error },
      { source: 'bombers', ok: false, count: 0, error },
      { source: 'jcyl', ok: false, count: 0, error }
    );
  }

  return { generatedAt: Date.now(), incidents, reports };
}

export async function fetchOperationalIncidents(
  signal?: AbortSignal
): Promise<OperationalPayload> {
  // Site statique sans proxy : on lit le jeu précalculé, qui porte sa date.
  if (!import.meta.env.DEV && !runtimeProxy()) {
    const response = await fetch(prebuiltUrl(), { signal, cache: 'no-cache' });
    if (!response.ok) throw new Error('Sem ligação ao serviço de incêndios.');
    return (await response.json()) as OperationalPayload;
  }

  return fetchLiveIncidents(signal);
}
