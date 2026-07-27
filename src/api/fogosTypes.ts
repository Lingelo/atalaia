/**
 * Formes brutes renvoyées par api.fogos.pt.
 *
 * Ces types décrivent ce que l'API envoie RÉELLEMENT, pas ce qu'on aimerait
 * recevoir. Tout ce qui a été observé absent ou null sur au moins un incident
 * est typé nullable — c'est volontaire : c'est ici qu'on absorbe l'imprévisibilité
 * de la source, pour que le reste de l'app manipule des données saines.
 *
 * Relevé de référence : 23 incidents actifs, 27/07/2026.
 */

/** Relevé de la station météo la plus proche. Absent sur ~30 % des incidents. */
export interface FogosWeather {
  stationId: number;
  stationLocation: string;
  /** Distance entre la station et le sinistre, en km. À afficher : sinon la donnée ment. */
  stationDistance: number;
  temperatura: number;
  humidade: number;
  intensidadeVento: number;
  intensidadeVentoKM: number;
  idDireccVento: number;
  direccVento: string;
  precAcumulada: number;
  radiacao: number;
  pressao: number;
  date: string;
}

/** Surface brûlée estimée par l'ICNF. Unité présumée : hectares (voir docs/stitch-brief.md). */
export interface FogosBurnArea {
  povoamento: number;
  agricola: number;
  mato: number;
  total: number;
}

export interface FogosIcnf {
  /** Peut être null même quand `icnf` existe — observé sur le plus gros feu actif. */
  burnArea: FogosBurnArea | null;
  altitude: number | null;
  incendio: boolean;
  fontealerta: string | null;
}

export interface FogosIncident {
  id: string;
  /** Seule source fiable pour l'heure de début : epoch en SECONDES. */
  dateTime: { sec: number };
  /** Format "DD-MM-YYYY" — non parsable par `new Date()`, utiliser `dateTime.sec`. */
  date: string;
  hour: string;

  location: string;
  district: string;
  concelho: string;
  freguesia: string;
  regiao: string | null;
  sub_regiao: string | null;
  detailLocation: string | null;
  localidade: string | null;

  lat: number;
  lng: number;
  coords: boolean;

  natureza: string;
  naturezaCode: string;

  status: string;
  statusCode: number;
  /** Hex SANS le croisillon (ex. "6ABF59"). Non utilisé : voir src/lib/status.ts. */
  statusColor: string;

  /** Opérationnels engagés. */
  man: number;
  /** Véhicules terrestres. */
  terrain: number;
  /** Moyens aériens. */
  aerial: number;

  active: boolean;
  important: boolean;

  icnf: FogosIcnf | null;
  weather: FogosWeather | null;
  /** Périmètre du feu au format KML. Présent sur une minorité d'incidents (2/23 au relevé). */
  kmlVost: string | null;
  kml: string | null;
}

export interface FogosActiveResponse {
  success: boolean;
  data: FogosIncident[];
}
