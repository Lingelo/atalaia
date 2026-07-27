/**
 * Formatage des durées et des dates, dépendant de la langue.
 *
 * L'amplitude réelle à couvrir est large : au relevé du 27/07/2026, un feu venait
 * de se déclarer (40 min) tandis qu'un autre était en vigilância depuis 25 jours.
 * Un formateur qui ne gère que les heures produit « há 600 h ».
 *
 * `Intl.RelativeTimeFormat` est utilisé plutôt qu'une table de chaînes : il
 * connaît les accords de chaque langue (« il y a 1 jour » / « il y a 2 jours »,
 * « 1 day ago »), ce qu'un dictionnaire plat gérerait mal.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatTimeAgo(
  startedAt: number,
  intlTag: string,
  justNowLabel: string,
  now: number = Date.now()
): string {
  const elapsed = now - startedAt;
  const rtf = new Intl.RelativeTimeFormat(intlTag, { numeric: 'auto', style: 'short' });

  // Le libellé du « moins d'une minute » est fourni plutôt que délégué à
  // RelativeTimeFormat : `format(0, 'minute')` produit « cette minute-ci », qui
  // décrit un instant présent, pas un événement tout juste passé.
  //
  // Une horloge client décalée peut produire un delta négatif : on ne rend jamais
  // « il y a -3 min », qui donnerait l'impression d'un bug plutôt que d'un feu.
  if (elapsed < MINUTE) return justNowLabel;

  if (elapsed < HOUR) return rtf.format(-Math.floor(elapsed / MINUTE), 'minute');
  if (elapsed < DAY) return rtf.format(-Math.floor(elapsed / HOUR), 'hour');
  return rtf.format(-Math.floor(elapsed / DAY), 'day');
}

/** Date et heure absolues, pour les blocs de détail où la précision prime. */
export function formatDateTime(startedAt: number, intlTag: string): string {
  return new Date(startedAt).toLocaleString(intlTag, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
