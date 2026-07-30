import React, { useState } from 'react';
import { Incident, SOURCES } from '../types';
import { formatDateTime, formatTimeAgo } from '../lib/time';
import { resolvePhase } from '../lib/status';
import { useI18n } from '../i18n/context';
import { useIsDesktop } from '../hooks/useIsDesktop';
import type { TranslationKey } from '../i18n/pt';

interface IncidentListViewProps {
  incidents: Incident[];
  selectedIncidentId?: string | null;
  onSelectIncident: (incident: Incident) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  /** Mobile uniquement : la liste est-elle dépliée ? Ignoré à partir de `md`. */
  isOpen: boolean;
  onClose: () => void;
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
  icon: string;
  value: number | null;
  title: string;
  partial?: boolean;
}> = ({ icon, value, title, partial = false }) => {
  const dimmed = value === null || value === 0;

  return (
    <div className="flex items-center gap-1" title={title}>
      <span className={`material-symbols-outlined text-[16px] ${dimmed ? 'opacity-40' : ''}`}>
        {icon}
      </span>
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
  totalStats,
}) => {
  const { t, n, intlTag } = useI18n();
  const isDesktop = useIsDesktop();
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [activeChipFilter, setActiveChipFilter] = useState<string>('all');

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

  // Filter incidents based on search, dropdown, and mobile chip filter
  const filteredIncidents = incidents.filter((inc) => {
    const matchesSearch =
      searchTerm === '' ||
      inc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.locationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.district.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.municipality.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || inc.phase === statusFilter;

    let matchesChip = true;
    if (activeChipFilter === '> 100 Ops') {
      // `?? 0` seulement ICI : un service qui ne publie pas ses effectifs ne
      // peut pas satisfaire un filtre « plus de 100 opérationnels ». C'est un
      // filtre, pas un total — il restreint, il n'affirme rien.
      matchesChip = (inc.personnel ?? 0) > 100;
    } else if (activeChipFilter === 'Aerial Assets') {
      matchesChip = (inc.aircraft ?? 0) > 0;
    } else if (activeChipFilter === 'Resolution') {
      matchesChip = resolvePhase(inc.phase).ongoing;
    }

    return matchesSearch && matchesStatus && matchesChip;
  });

  // Tri par gravité décroissante, puis par ancienneté. Un tri purement
  // chronologique enterrerait un feu majeur sous des départs mineurs plus récents.
  const sortedIncidents = [...filteredIncidents].sort((a, b) => {
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
      aria-hidden={!isDesktop && !isOpen}
      className={`absolute bottom-16 left-0 right-0 z-20 h-[72%] rounded-t-2xl overflow-hidden bg-[#16191C] border-t border-[#2D3034] flex flex-col transition-transform duration-300 ${
        isOpen ? 'translate-y-0' : 'translate-y-[calc(100%+4rem)] pointer-events-none'
      } md:static md:bottom-auto md:h-full md:w-[380px] lg:w-[400px] md:translate-y-0 md:pointer-events-auto md:rounded-none md:border-t-0 md:border-r md:shrink-0`}
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
          <span className="material-symbols-outlined text-[20px]">keyboard_arrow_down</span>
          <span className="font-['Inter'] text-[13px] font-semibold">{t('list.close')}</span>
        </button>
      </div>

      {/* Search Input and Filters Toggle Bar */}
      <div className="p-3 border-b border-[#2D3034] bg-[#16191C] flex flex-col gap-2">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-[#e5bdb9] text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('list.searchPlaceholder')}
              className="w-full bg-[#1e2021] border border-[#333536] text-[#e2e2e3] pl-9 pr-3 py-1.5 text-xs rounded focus:outline-none focus:border-[#ffb3ad] placeholder:text-[#e5bdb9]/60"
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
            <span className="material-symbols-outlined text-[16px]">tune</span>
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

        {/* Mobile Quick Chips */}
        <div className="md:hidden flex gap-2 overflow-x-auto no-scrollbar pt-1">
          {(
            [
              ['all', t('list.all')],
              ['> 100 Ops', t('list.chipOver100')],
              ['Aerial Assets', t('list.chipAerial')],
              ['Resolution', t('list.chipOngoing')],
            ] as const
          ).map(([chip, chipLabel]) => (
            <button
              key={chip}
              type="button"
              onClick={() => setActiveChipFilter(chip)}
              className={`h-7 px-3 rounded text-xs whitespace-nowrap flex items-center transition-colors ${
                activeChipFilter === chip
                  ? 'bg-[#e2e2e3] text-[#121415] font-bold'
                  : 'bg-transparent border border-[#333536] text-[#e5bdb9]'
              }`}
            >
              {chipLabel}
            </button>
          ))}
        </div>
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
