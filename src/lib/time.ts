/**
 * Formatage du temps relatif, en portugais.
 *
 * L'amplitude réelle à couvrir est large : au relevé du 27/07/2026, un feu venait
 * de se déclarer (40 min) tandis qu'un autre était en vigilância depuis 25 jours.
 * Un formateur qui ne gère que les heures produit "há 600 h".
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatTimeAgo(startedAt: number, now: number = Date.now()): string {
  const elapsed = now - startedAt;

  // Une horloge client décalée peut produire un delta négatif : on ne rend jamais
  // "há -3 min", qui donnerait l'impression d'un bug plutôt que d'un feu.
  if (elapsed < MINUTE) return 'agora';

  if (elapsed < HOUR) return `há ${Math.floor(elapsed / MINUTE)} min`;
  if (elapsed < DAY) return `há ${Math.floor(elapsed / HOUR)} h`;
  return `há ${Math.floor(elapsed / DAY)} d`;
}

/** Date et heure absolues, pour les blocs de détail où la précision prime. */
export function formatDateTime(startedAt: number): string {
  return new Date(startedAt).toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
