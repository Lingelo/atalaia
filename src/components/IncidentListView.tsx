import React, { useState } from 'react';
import { Icon, type IconName } from './Icon';
import { Incident, SOURCES } from '../types';
import { formatDateTime, formatTimeAgo } from '../lib/time';
import { resolvePhase } from '../lib/status';
import { useI18n } from '../i18n/context';
import { useIsDesktop } from '../hooks/useIsDesktop';
import type { TranslationKey } from '../i18n/pt';
import { ONGOING_FILTER } from '../lib/filters';

interface IncidentListViewProps {
  incidents: Incident[];
  selectedIncidentId?: string | null;
  onSelectIncident: (incident: Incident) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  /* Le filtre rapide n'est plus reçu ici : il a migré vers `MobileFilterBar`.
     `App` en reste le propriétaire, et la liste en subit toujours l'effet —
     elle consomme `visibleIncidents`, déjà filtré. */
  /** Mobile uniquement : la liste est-elle dépliée ? Ignoré à partir de `md`. */
  isOpen: boolean;
  onClose: () => void;
  /**
   * Desktop uniquement : la colonne est-elle repliée ?
   *
   * Distinct de `isOpen`, qui ne gouverne que la feuille mobile. Les deux
   * mécaniques répondent à des gestes différents — glisser une feuille du bas,
   * ou rendre de la largeur à la carte — et les confondre reviendrait à masquer
   * la liste sur téléphone quand on la replie sur écran large.
   */
  isCollapsed: boolean;
  totalStats: {
    activeCount: number;
    /** `null` quand aucun service du périmètre ne publie la valeur. */
    personnel: number | null;
    vehicles: number | null;
    aircraft: number | null;
    personnelIsPartial: boolean;
  };
}

/**
 * Un chiffre de moyens engagés, ou l'aveu qu'on ne l'a pas.
 *
 * ⚠️ C'est ici que se joue la lisibilité du mode Espagne. Les Bombers de la
 * Generalitat ne publient aucun effectif : afficher « 0 » sur chaque ligne
 * catalane donnerait à voir des incendies que personne ne combat. Un tiret gris
 * dit la seule chose vraie — la donnée n'est pas publiée.
 *
 * Le « ≥ » marque un décompte partiel : les services espagnols dénombrent des
 * techniciens et des agents, mais publient les brigades en ÉQUIPES dont
 * l'effectif reste inconnu. Le nombre est donc un plancher, pas un total.
 */
const Metric: React.FC<{
  icon: IconName;
  value: number | null;
  title: string;
  partial?: boolean;
}> = ({ icon, value, title, partial = false }) => {
  const dimmed = value === null || value === 0;

  return (
    <div className="flex items-center gap-1" title={title}>
      <Icon name={icon} className={`text-[16px] ${dimmed ? 'opacity-40' : ''}`} />
      {value === null ? (
        <span className="opacity-40">—</span>
      ) : (
        <span className={dimmed ? 'opacity-40' : 'text-[#e2e2e3] font-semibold'}>
          {partial && value > 0 ? `≥${value}` : value}
        </span>
      )}
    </div>
  );
};

export const IncidentListView: React.FC<IncidentListViewProps> = ({
  incidents,
  selectedIncidentId,
  onSelectIncident,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  isOpen,
  onClose,
  isCollapsed,
  totalStats,
}) => {
  const { t, n, intlTag } = useI18n();
  const isDesktop = useIsDesktop();
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  /**
   * Libellé traduit d'un statut, indexé sur la PHASE canonique.
   *
   * Quatre services publient leurs états en quatre langues ; traduire la phase
   * plutôt que le texte source est ce qui permet à un utilisateur francophone de
   * lire « Maîtrisé » sur un feu catalan comme sur un feu portugais. Le libellé
   * d'origine reste affiché en second, parce que c'est lui qui fait foi.
   */
  const statusLabel = (incident: Incident) => t(`phase.${incident.phase}` as TranslationKey);

  // Couleurs de statut : registre unique (src/lib/status.ts), appliqué en style
  // inline. Tailwind ne peut pas générer `bg-[${color}]` à l'exécution — son
  // scanner lit le source à la compilation, pas les valeurs calculées.
  const getStatusBadgeStyle = (incident: Incident): React.CSSProperties => {
    const { color } = resolvePhase(incident.phase);
    return {
      borderColor: color,
      // 26/255 ≈ 15 % d'opacité, comme la maquette.
      backgroundColor: `${color}26`,
      color,
    };
  };

  // Les incidents arrivent DÉJÀ filtrés : le prédicat vit dans
  // `src/lib/filters.ts` et s'applique en amont, dans `App`, pour que la carte
  // affiche exactement le même jeu. Refiltrer ici ferait diverger les deux vues
  // à la première divergence de code.

  // Tri par gravité décroissante, puis par ancienneté. Un tri purement
  // chronologique enterrerait un feu majeur sous des départs mineurs plus récents.
  const sortedIncidents = [...incidents].sort((a, b) => {
    const severityDelta = resolvePhase(b.phase).severity - resolvePhase(a.phase).severity;
    if (severityDelta !== 0) return severityDelta;

    // Pondération des moyens, `null` comptant pour 0 dans le seul but de
    // classer. Un incident aux moyens non publiés se retrouve donc plus bas à
    // gravité égale — c'est un défaut assumé du tri, pas un chiffre affiché.
    const weight = (inc: Incident) =>
      (inc.personnel ?? 0) + (inc.vehicles ?? 0) * 3 + (inc.aircraft ?? 0) * 20;
    const resourcesDelta = weight(b) - weight(a);
    if (resourcesDelta !== 0) return resourcesDelta;

    return b.startedAt - a.startedAt;
  });

  // Phases réellement présentes, pour que le filtre n'expose que des états
  // qu'on peut effectivement sélectionner.
  const availablePhases = Array.from(new Set(incidents.map((inc) => inc.phase))).sort(
    (a, b) => resolvePhase(b).severity - resolvePhase(a).severity
  );

  return (
    // Sur desktop la colonne est toujours visible : la masquer aux lecteurs
    // d'écran parce que la feuille MOBILE est fermée les priverait de toute la
    // liste. Voir `useIsDesktop`.
    <aside
      aria-hidden={(!isDesktop && !isOpen) || (isDesktop && isCollapsed)}
      className={`absolute bottom-16 left-0 right-0 z-20 h-[72%] rounded-t-2xl overflow-hidden bg-[#16191C] border-t border-[#2D3034] flex flex-col transition-transform duration-300 ${
        isOpen ? 'translate-y-0' : 'translate-y-[calc(100%+4rem)] pointer-events-none'
      } md:static md:bottom-auto md:h-full md:translate-y-0 md:rounded-none md:border-t-0 md:shrink-0 md:transition-[width] md:duration-300 ${
        // Repliée, la colonne ne fait plus AUCUNE largeur — elle ne se contente
        // pas de glisser hors champ. C'est ce qui rend la place à la carte, qui
        // est la raison d'être du bouton.
        isCollapsed
          ? 'md:w-0 md:border-r-0 md:pointer-events-none'
          : 'md:w-[380px] lg:w-[400px] md:border-r md:pointer-events-auto'
      }`}
    >
      {/* Barre de fermeture, mobile uniquement. Le résumé rappelle ce que la
          liste contient, le bouton dit explicitement ce qu'il fait. */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#1e2021] border-b border-[#2D3034] shrink-0">
        <span className="font-['Inter'] text-[13px] text-[#e5bdb9] tabular-nums">
          {t('list.summary', {
            active: totalStats.activeCount,
            personnel:
              totalStats.personnel === null
                ? '—'
                : `${totalStats.personnelIsPartial ? '≥' : ''}${n(totalStats.personnel)}`,
          })}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 px-3 py-1.5 -mr-2 rounded text-[#e2e2e3] hover:bg-[#333536] transition-colors"
        >
          <Icon name="keyboard_arrow_down" className="text-[20px]" />
          <span className="font-['Inter'] text-[13px] font-semibold">{t('list.close')}</span>
        </button>
      </div>

      {/* Recherche et filtres — DESKTOP uniquement.
          Sur mobile, `MobileFilterBar` porte exactement les mêmes commandes,
          en haut de la carte et visible en permanence. Les garder ici aussi
          donnerait deux boutons « Filtres » pilotant le même état, à deux
          endroits, dont l'un n'est atteignable qu'en recouvrant la carte. */}
      <div className="hidden md:flex p-3 border-b border-[#2D3034] bg-[#16191C] flex-col gap-2">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            {/* ⚠️ Centrage CALCULÉ, et non un `top` en dur. La glyphe Material
                occupe une boîte de 24 px quelle que soit la taille de police
                demandée : à `top-2.5` elle débordait de 4 px sous un champ de
                30 px, et pendait 7 px trop bas. `leading-none` colle la boîte à
                la glyphe, la translation la recentre quelle que soit la hauteur
                du champ.

                `pointer-events-none` : sans lui, cliquer la loupe — le geste le
                plus naturel — ne donnait pas le focus au champ. */}
            <span className="pointer-events-none absolute left-2.5 top-0 h-full flex items-center">
              <Icon name="search" className="leading-none text-[#e5bdb9] text-[18px]" />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('list.searchPlaceholder')}
              /* `h-full` : le champ s'étire à la hauteur de la ligne, comme le
                 bouton Filtres à côté. Sans lui il faisait 30 px contre 38 —
                 deux commandes voisines de hauteurs différentes, et une loupe
                 qui se centrait sur le conteneur plutôt que sur le champ. */
              className="w-full h-full bg-[#1e2021] border border-[#333536] text-[#e2e2e3] pl-9 pr-3 py-1.5 text-xs rounded focus:outline-none focus:border-[#ffb3ad] placeholder:text-[#e5bdb9]/60"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className={`px-3 py-1.5 border rounded text-xs font-semibold flex items-center gap-1 transition-colors ${
              statusFilter !== 'all' || showFilterDropdown
                ? 'bg-[#e2e2e3] text-[#121415] border-white'
                : 'border-[#494c4f] text-[#e5bdb9] hover:bg-[#2D3034]'
            }`}
          >
            <Icon name="tune" className="text-[16px]" />
            {t('list.filters')}
          </button>
        </div>

        {/* Filter Popup / Options */}
        {showFilterDropdown && (
          <div className="mt-1 p-2 bg-[#1e2021] border border-[#333536] rounded space-y-2 text-xs">
            <div className="flex justify-between items-center text-[#e5bdb9] font-semibold">
              <span>{t('list.filterByStatus')}</span>
              {statusFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => onStatusFilterChange('all')}
                  className="text-[#ffb3ad] underline text-[11px]"
                >
                  {t('list.clear')}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                // « En cours » vient en TÊTE parce que c'est le filtre actif au
                // chargement : l'utilisateur doit pouvoir constater ce qui le
                // restreint, et le lever, sans avoir à le deviner.
                { code: ONGOING_FILTER, label: t('list.chipOngoing') },
                { code: 'all', label: t('list.all') },
                ...availablePhases.map((phase) => ({
                  code: phase,
                  label: t(`phase.${phase}` as TranslationKey),
                })),
              ].map(({ code: st, label }) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => onStatusFilterChange(st)}
                  className={`px-2 py-1 rounded text-left transition-colors ${
                    statusFilter === st
                      ? 'bg-[#ffb3ad] text-[#680009] font-bold'
                      : 'bg-[#16191C] text-[#e2e2e3] hover:bg-[#282a2b]'
                  }`}
                >
                  {st === 'all' ? t('list.allStatuses') : label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ⚠️ Les filtres rapides ne sont plus ici. Ils étaient `md:hidden`,
            donc réservés au mobile — c'est-à-dire au seul cas où cette feuille
            recouvre 72 % de la carte qu'ils sont censés restreindre. Ils vivent
            désormais dans `MobileFilterBar`, posée en haut de la carte et
            visible même feuille ouverte. Ils pilotent le même `chipFilter` :
            c'est un déménagement, pas un doublon. */}
      </div>

      {/* Incident List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#2D3034]">
        {sortedIncidents.map((inc) => {
          const isSelected = inc.id === selectedIncidentId;
          const statusColor = resolvePhase(inc.phase).color;
          const badgeStyle = getStatusBadgeStyle(inc);

          return (
            <article
              key={inc.id}
              onClick={() => onSelectIncident(inc)}
              className={`relative pl-4 pr-4 py-3.5 hover:bg-[#1a1c1d] transition-colors cursor-pointer group ${
                isSelected ? 'bg-[#1e2021] border-l-4 border-l-[#ffb3ad]' : ''
              }`}
            >
              {!isSelected && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{ backgroundColor: statusColor }}
                />
              )}

              <div className="flex justify-between items-start mb-1.5">
                <div>
                  <h2 className="font-['Inter'] text-[15px] font-semibold text-[#e2e2e3] leading-tight group-hover:text-white">
                    {inc.title}
                  </h2>
                  <p className="font-['Inter'] text-[13px] text-[#e5bdb9] leading-tight">
                    {inc.locationName}
                  </p>
                </div>
                <span
                  className="font-['Inter'] text-[12px] text-[#e5bdb9] tabular-nums shrink-0 ml-2"
                  title={formatDateTime(inc.startedAt, intlTag)}
                >
                  {formatTimeAgo(inc.startedAt, intlTag, t('time.justNow'))}
                </span>
              </div>

              <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                <div
                  className="px-2 py-0.5 border rounded text-[10px] font-bold uppercase tracking-wider"
                  style={badgeStyle}
                >
                  {statusLabel(inc)}
                </div>
                {/* Territoire de la source. En mode péninsule, la liste mêle
                    quatre services : sans cette étiquette, rien ne dirait
                    pourquoi une ligne andalouse n'affiche pas d'effectif. */}
                <span className="px-2 py-0.5 rounded bg-[#282a2b] text-[10px] font-semibold text-[#e5bdb9] uppercase tracking-wider">
                  {SOURCES[inc.source].territory}
                </span>
                {inc.severityLevel && (
                  <span className="px-2 py-0.5 rounded bg-[#282a2b] text-[10px] font-semibold text-[#e5bdb9] uppercase tracking-wider">
                    {t('detail.severityLevel', { level: inc.severityLevel })}
                  </span>
                )}
              </div>

              <div className="flex gap-4 text-[13px] tabular-nums text-[#e5bdb9]">
                <Metric
                  icon="group"
                  value={inc.personnel}
                  partial={inc.personnelIsPartial}
                  title={t('detail.personnel')}
                />
                <Metric icon="local_fire_department" value={inc.vehicles} title={t('detail.vehicles')} />
                <Metric icon="flight" value={inc.aircraft} title={t('detail.aircraft')} />
              </div>
            </article>
          );
        })}

        {sortedIncidents.length === 0 && (
          <div className="p-8 text-center text-[#e5bdb9] text-sm">
            {t('list.empty')}
          </div>
        )}
      </div>
    </aside>
  );
};
