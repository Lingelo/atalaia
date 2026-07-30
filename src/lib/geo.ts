/**
 * Calculs géographiques.
 *
 * Écrit à la main plutôt qu'ajouté en dépendance : le besoin tient en une
 * fonction, et le projet a déjà été débarrassé de neuf paquets inutilisés.
 */

/** Rayon volumétrique moyen de la Terre, en kilomètres (UAI). */
const EARTH_RADIUS_KM = 6371.0088;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Distance orthodromique entre deux points, en kilomètres (formule de haversine).
 *
 * Haversine plutôt qu'une approximation plane : aux latitudes ibériques, un
 * degré de longitude vaut environ 78 km contre 111 km pour un degré de latitude.
 * Traiter les deux comme équivalents surestimerait de 40 % les distances est-ouest,
 * et une zone de surveillance de 10 km n'alerterait pas sur un feu à 9 km à l'est.
 *
 * L'écart à un modèle ellipsoïdal (Vincenty) est de l'ordre de 0,3 %, soit 30 m
 * sur 10 km : sans objet pour un rayon d'alerte que l'utilisateur choisit au
 * kilomètre près.
 */
export function distanceKm(
  latA: number,
  lngA: number,
  latB: number,
  lngB: number
): number {
  const dLat = toRadians(latB - latA);
  const dLng = toRadians(lngB - lngA);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * L'instant donné tombe-t-il dans la plage d'heures silencieuses ?
 *
 * Les plages traversent minuit dans le cas courant (23:00 → 07:00) : la
 * comparaison doit donc être une UNION quand le début est postérieur à la fin,
 * et une intersection sinon. Un test naïf `start <= now && now <= end`
 * n'alerterait jamais la nuit — c'est-à-dire précisément quand on dort et qu'on
 * a le plus besoin d'être réveillé.
 *
 * @param minutesOfDay minutes écoulées depuis minuit, heure locale.
 */
export function isWithinQuietHours(minutesOfDay: number, start: string, end: string): boolean {
  const parse = (value: string): number | null => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
  };

  const from = parse(start);
  const to = parse(end);
  // Plage illisible : on préfère alerter que se taire.
  if (from === null || to === null) return false;
  // Début et fin confondus : plage vide, pas une plage de 24 h.
  if (from === to) return false;

  return from < to
    ? minutesOfDay >= from && minutesOfDay < to
    : minutesOfDay >= from || minutesOfDay < to;
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}
