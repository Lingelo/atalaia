/**
 * Andalousie — Plan INFOCA (Junta de Andalucía).
 *
 * La meilleure source espagnole trouvée : elle publie, par incendie, la commune,
 * la province, l'état, la date, l'heure, la position, et le détail des moyens
 * engagés catégorie par catégorie. C'est le pendant le plus proche de ce que
 * l'ANEPC publie pour le Portugal.
 *
 * COMMENT ce point d'accès a été trouvé, parce que ce n'est pas documenté :
 * la page « Incendios en tiempo real » de la Junta intègre un tableau de bord
 * ArcGIS ; l'élément de portail de ce tableau de bord référence une carte web,
 * qui référence à son tour la couche ci-dessous. Elle répond sans jeton.
 *
 * ⚠️ CE QUE LES CHIFFRES COMPTENT — à ne pas confondre avec les effectifs
 * portugais. `TECNICOS` est un nombre de PERSONNES. `GRUPOS_ESPECIALISTAS`,
 * `BRICAS`, `UMIF`, `GRUPOS_APOYO` et `UNASIF_ACO` sont des nombres de GROUPES,
 * de brigades ou d'unités — chacun rassemblant plusieurs personnes, en nombre
 * non publié. Les additionner pour produire un « effectif » donnerait un chiffre
 * qui ne veut rien dire et sous-estimerait massivement la mobilisation réelle.
 *
 * On expose donc `personnel` = TECNICOS seulement, et on publie le reste dans
 * `resources`, avec l'unité `units`. Le panneau de détail affiche le détail tel
 * quel ; les totaux nationaux n'agrègent que ce qui est comparable.
 */

import type { Incident, ResourceEntry } from '../../types';
import { phaseFromSpanishLabel } from '../../lib/status.ts';
import { combineDateAndTime, esriDateLiteral, queryEsriLayer } from '../arcgis.ts';

/**
 * Couche « Incidentes » du service INFOCA.
 *
 * L'URL passe par `utility.arcgis.com`, qui est le relais du portail : c'est
 * bien l'adresse publique servie au tableau de bord, et non un point d'accès
 * interne deviné.
 */
export const INFOCA_LAYER =
  'https://utility.arcgis.com/usrsvcs/servers/d6d1c0079ddd4c7f8876d58e13fcf1ac/rest/services/INFOCA/AN_INCIDENTES_PRO/FeatureServer/2';

const OUT_FIELDS = [
  'OID_ENTERO',
  'TERMINO_MUNICIPAL',
  'PROVINCIA',
  'TIPO_INCIDENTE',
  'ESTADO',
  'FECHA',
  'HORA',
  'GRUPOS_ESPECIALISTAS',
  'BRICAS',
  'VEHICULOS',
  'TECNICOS',
  'MEDIOS_AEREOS',
  'UMIF',
  'GRUPOS_APOYO',
  'UNASIF_ACO',
].join(',');

export interface InfocaAttributes {
  OID_ENTERO: number;
  TERMINO_MUNICIPAL: string | null;
  PROVINCIA: string | null;
  TIPO_INCIDENTE: string | null;
  ESTADO: string | null;
  /** Epoch en millisecondes, mais à MINUIT : l'heure est dans `HORA`. */
  FECHA: number | null;
  HORA: string | null;
  GRUPOS_ESPECIALISTAS: number | null;
  BRICAS: number | null;
  VEHICULOS: number | null;
  TECNICOS: number | null;
  MEDIOS_AEREOS: number | null;
  UMIF: number | null;
  GRUPOS_APOYO: number | null;
  UNASIF_ACO: number | null;
}

/**
 * Postes publiés en GROUPES, avec leur libellé d'origine.
 *
 * Les libellés restent en espagnol : ce sont des noms de dispositifs (une
 * « BRICA » est une brigade précise du Plan INFOCA), pas du vocabulaire courant
 * à traduire. Les traduire inventerait des équivalences qui n'existent pas.
 */
const UNIT_FIELDS: Array<[keyof InfocaAttributes, string]> = [
  ['GRUPOS_ESPECIALISTAS', 'Grupos de especialistas'],
  ['BRICAS', 'BRICA (brigadas)'],
  ['UMIF', 'UMIF (unidades móviles)'],
  ['GRUPOS_APOYO', 'Grupos de apoyo'],
  ['UNASIF_ACO', 'UNASIF / ACO'],
];

/** Une valeur numérique publiée, ou null quand le champ est absent. */
function count(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function toIncident(attributes: InfocaAttributes, lat: number, lng: number): Incident {
  const municipality = (attributes.TERMINO_MUNICIPAL ?? '').trim();
  const province = (attributes.PROVINCIA ?? '').trim();
  const status = (attributes.ESTADO ?? '').trim();

  const resources: ResourceEntry[] = [];
  for (const [field, label] of UNIT_FIELDS) {
    const value = count(attributes[field] as number | null);
    if (value !== null && value > 0) resources.push({ label, count: value, unit: 'units' });
  }
  const technicians = count(attributes.TECNICOS);
  if (technicians !== null && technicians > 0) {
    resources.push({ label: 'Técnicos', count: technicians, unit: 'people' });
  }

  return {
    id: `infoca-${attributes.OID_ENTERO}`,
    source: 'infoca',

    title: municipality || province,
    locationName: province,
    district: province,
    municipality,

    status,
    phase: phaseFromSpanishLabel(status),
    // Pas d'équivalent numérique côté espagnol : la logique passe par `phase`.
    statusCode: null,

    startedAt: combineDateAndTime(attributes.FECHA, attributes.HORA) ?? Date.now(),

    // Seul poste publié en PERSONNES par l'INFOCA — et un poste étroit : les
    // « técnicos » encadrent, ils ne constituent pas l'effectif engagé, qui
    // tient dans les groupes ci-dessus. D'où le drapeau `partial` : un incendie
    // à « 0 técnicos ; 2 grupos de especialistas » mobilise bel et bien du
    // monde, et le nombre seul le nierait.
    personnel: technicians,
    personnelIsPartial: true,
    // Ces deux-là, en revanche, sont de vrais décomptes d'engins et d'aéronefs,
    // directement comparables à `terrain` et `aerial` côté portugais.
    vehicles: count(attributes.VEHICULOS),
    aircraft: count(attributes.MEDIOS_AEREOS),
    resources,

    severityLevel: null,

    lat,
    lng,

    // La couche ne contient qu'un seul type d'incident, cité tel quel.
    nature: (attributes.TIPO_INCIDENTE ?? '').trim(),
    altitude: null,
    alertSource: null,

    // L'INFOCA ne publie pas de surface brûlée sur cette couche.
    burnedAreaHa: null,
    burnedBreakdown: null,

    weather: null,
    history: [],
  };
}

/**
 * Récupère les incendies publiés par l'INFOCA.
 *
 * @param sinceMs borne basse sur la date de début. La couche conserve la saison
 *   entière (655 entités au relevé du 30/07/2026), dont l'essentiel est éteint
 *   depuis des semaines : sans borne, la carte se couvrirait de feux clos.
 */
export async function fetchAndaluciaIncidents(
  sinceMs: number,
  signal?: AbortSignal
): Promise<Incident[]> {
  const features = await queryEsriLayer<InfocaAttributes>(
    INFOCA_LAYER,
    {
      // Filtre côté serveur plutôt que côté client : la couche dépasse le
      // plafond de transfert, et un filtrage local ne verrait qu'une tranche
      // arbitraire des 655 entités de la saison.
      where: `FECHA >= ${esriDateLiteral(sinceMs)}`,
      outFields: OUT_FIELDS,
      orderByFields: 'FECHA DESC',
      resultRecordCount: 2000,
    },
    signal
  );

  return features.map(({ attributes, lat, lng }) => toIncident(attributes, lat, lng));
}
