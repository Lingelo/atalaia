/**
 * Catalogne — Bombers de la Generalitat.
 *
 * La source la plus FRAÎCHE des trois : la vue publie les actuacions en cours,
 * et contenait des interventions vieilles de dix minutes au relevé du
 * 30/07/2026. C'est du temps réel, pas un bulletin quotidien.
 *
 * C'est aussi la plus PAUVRE en moyens engagés, et il faut le dire plutôt que
 * de le combler. Voir les deux avertissements ci-dessous.
 *
 * Une note du code précédent affirmait que « la Catalogne ne publie ni
 * coordonnées ni effectifs et accuse six jours de retard ». La première moitié
 * est fausse — cette vue publie des coordonnées et se met à jour à la minute —
 * et c'est ce qui rend le mode Espagne possible. La seconde moitié tient : les
 * effectifs, eux, ne sont effectivement pas publiés.
 */

import type { Incident } from '../../types';
import { phaseFromSpanishLabel } from '../../lib/status.ts';
import { esriDateLiteral, queryEsriLayer } from '../arcgis.ts';

/**
 * Vue « actuacions urgents avec phase d'incendie ».
 *
 * Trouvée via la configuration de l'application ArcGIS Experience référencée par
 * interior.gencat.cat. Il existe une seconde vue (`..._PRO_VW`) qui ne renvoie
 * QUE des identifiants et une date d'édition, sans commune ni phase : elle est
 * inutilisable, c'est bien celle-ci qu'il faut.
 */
export const BOMBERS_LAYER =
  'https://services7.arcgis.com/ZCqVt1fRXwwK6GF4/arcgis/rest/services/ACTUACIONS_URGENTS_online_PRO_AMB_FASE_VIEW/FeatureServer/0';

const OUT_FIELDS = [
  'ESRI_OID',
  'ACT_DAT_INICI',
  'TAL_COD_ALARMA1',
  'TAL_DESC_ALARMA2',
  'COM_FASE',
  'MUNICIPI_SIG',
  'MUNICIPI_DPX',
  'ACT_NUM_VEH',
].join(',');

export interface BombersAttributes {
  ESRI_OID: number;
  /** Epoch en millisecondes, heure de début de l'actuació. */
  ACT_DAT_INICI: number | null;
  /** Code de première alarme. « IV » = incendi de vegetació. */
  TAL_COD_ALARMA1: string | null;
  /** Sous-type : forestal, agrícola ou urbana. */
  TAL_DESC_ALARMA2: string | null;
  /** Phase de l'incendie, en catalan. Absente sur environ la moitié des lignes. */
  COM_FASE: string | null;
  MUNICIPI_SIG: string | null;
  MUNICIPI_DPX: string | null;
  ACT_NUM_VEH: number | null;
}

/**
 * Nombre de véhicules — mais seulement s'il est strictement positif.
 *
 * ⚠️ Ce n'est pas une précaution de style. Au relevé du 30/07/2026, `ACT_NUM_VEH`
 * valait 0 sur les 33 lignes de la vue, y compris sur des incendies forestaux
 * en cours. Or une actuació des Bombers mobilise par définition au moins un
 * véhicule : un zéro généralisé décrit un champ NON ALIMENTÉ dans cette vue
 * publique, pas une absence de moyens.
 *
 * On renvoie donc `null` (« non publié », affiché « — ») au lieu de `0`, qui
 * afficherait « 0 véhicule » sur toute la Catalogne et laisserait conclure que
 * personne n'intervient. Si le champ se met à être alimenté un jour, les valeurs
 * positives passeront sans changement de code.
 */
function vehicles(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

export function toIncident(attributes: BombersAttributes, lat: number, lng: number): Incident {
  const municipality = (attributes.MUNICIPI_SIG ?? attributes.MUNICIPI_DPX ?? '').trim();
  // Le libellé catalan est cité tel quel : c'est ce que le service publie.
  const status = (attributes.COM_FASE ?? '').trim();

  return {
    id: `bombers-${attributes.ESRI_OID}`,
    source: 'bombers',

    title: municipality || 'Catalunya',
    locationName: 'Catalunya',
    district: 'Catalunya',
    municipality,

    status,
    // Phase absente sur la moitié des lignes : `phaseFromSpanishLabel('')`
    // renvoie alors `unknown`, que le registre traite comme ENCORE EN COURS.
    // C'est le bon défaut ici — la vue ne contient que des actuacions ouvertes.
    phase: phaseFromSpanishLabel(status),
    statusCode: null,

    startedAt: attributes.ACT_DAT_INICI ?? Date.now(),

    // ⚠️ Les Bombers ne publient AUCUN effectif sur cette vue. `null`, jamais 0 :
    // voir la note sur `personnel` dans types.ts.
    personnel: null,
    vehicles: vehicles(attributes.ACT_NUM_VEH),
    aircraft: null,
    // Rien de publié n'est pas un décompte partiel : c'est une absence, déjà
    // portée par le `null` ci-dessus.
    personnelIsPartial: false,
    resources: [],

    severityLevel: null,

    lat,
    lng,

    nature: (attributes.TAL_DESC_ALARMA2 ?? '').trim(),
    altitude: null,
    alertSource: null,

    burnedAreaHa: null,
    burnedBreakdown: null,

    weather: null,
    history: [],
  };
}

/**
 * Récupère les incendies de végétation en cours en Catalogne.
 *
 * @param sinceMs borne basse sur l'heure de début. La vue conserve quelques
 *   interventions de plusieurs semaines dont la phase est déjà « Extingit » ;
 *   sans borne elles s'afficheraient au même rang qu'un départ de ce matin.
 */
export async function fetchCatalunyaIncidents(
  sinceMs: number,
  signal?: AbortSignal
): Promise<Incident[]> {
  const features = await queryEsriLayer<BombersAttributes>(
    BOMBERS_LAYER,
    {
      // `TAL_COD_ALARMA1 = 'IV'` : incendis de vegetació uniquement. La vue n'a
      // contenu que ce code au relevé, mais elle s'appelle « actuacions urgents »
      // et rien ne garantit qu'un accident de circulation n'y entrera jamais.
      where: `TAL_COD_ALARMA1 = 'IV' AND ACT_DAT_INICI >= ${esriDateLiteral(sinceMs)}`,
      outFields: OUT_FIELDS,
      orderByFields: 'ACT_DAT_INICI DESC',
      resultRecordCount: 2000,
    },
    signal
  );

  return features.map(({ attributes, lat, lng }) => toIncident(attributes, lat, lng));
}
