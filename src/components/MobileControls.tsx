import React, { useState } from 'react';
import { Icon } from './Icon';
import { useI18n } from '../i18n/context';
import { ONGOING_FILTER, type ChipFilter } from '../lib/filters';
import { ScopeSwitcher } from './ScopeSwitcher';
import { SourceStatusBadge, hasScopeFailure } from './SourceStatusBadge';
import { formatTimeAgo } from '../lib/time';
import type { SourceReport } from '../api/spain/index';
import type { ViewScope } from '../types';
import type { TranslationKey } from '../i18n/pt';

/**
 * Commandes du mobile, repliées derrière UN bouton posé sur la carte.
 *
 * POURQUOI ce composant existe :
 *
 * L'en-tête desktop est `hidden md:flex`. Tout ce qu'il porte — périmètre,
 * couverture des services, fraîcheur, filtres — était donc purement absent sur
 * téléphone. On y regardait une carte sans pouvoir dire ce qu'elle couvrait, ni
 * si un service s'était tu, ni restreindre la vue sans ouvrir la liste qui
 * masque 72 % de cette même carte.
 *
 * POURQUOI UN SEUL BOUTON, et non la barre de commandes essayée d'abord :
 *
 * Cette barre alignait le sélecteur de périmètre, le badge de couverture, le
 * rafraîchissement et quatre filtres rapides. Mesurée à 360 px de large — la
 * largeur d'un téléphone courant, pas un cas limite — elle réclamait 418 px et
 * tronquait le bouton de rafraîchissement. Surtout, elle chargeait le haut de
 * l'écran d'une rangée de pastilles là où le SUJET est la carte. Sur un outil
 * qu'on ouvre pour voir où ça brûle, la commande doit s'effacer devant la
 * donnée.
 *
 * ⚠️ CE QUE CE REPLI NE DOIT PAS COÛTER :
 *
 * Le badge de couverture existe parce qu'un service injoignable retire son
 * territoire de la carte sans rien changer d'autre à l'écran — une panne
 * technique s'y lit alors comme une bonne nouvelle. L'enfouir derrière un appui
 * l'aurait vidé de son sens. Le bouton porte donc lui-même l'alerte : il passe
 * au rouge et change d'icône dès qu'un service du périmètre se tait, sans qu'on
 * ait à l'ouvrir. Le repli concerne le RÉGLAGE, jamais l'avertissement.
 *
 * ⚠️ `z-20` : au-dessus de la carte (`z-0`), mais SOUS le panneau de détail
 * (`z-30`). Sélectionner un sinistre doit primer sur le réglage de la vue.
 *
 * Le sélecteur de LANGUE n'y figure pas, délibérément : `detectLocale()` lit
 * `navigator.languages` et retient le choix en `localStorage`. Il se pose une
 * fois, et n'a pas à occuper une place ici.
 */
interface MobileControlsProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  chipFilter: ChipFilter;
  onChipFilterChange: (chip: ChipFilter) => void;
  /**
   * Phases présentes dans le PÉRIMÈTRE, avant application des filtres.
   *
   * ⚠️ Volontairement pas dérivé des incidents déjà filtrés : les options
   * disparaîtraient à mesure qu'on s'en sert, et le dernier choix restant
   * deviendrait une impasse.
   */
  availablePhases: string[];
  /** Ce que la carte montre en ce moment. Voir la note sur le décompte nul. */
  visibleCount: number;
  /** Un filtre restreint-il la vue ? Alimente la pastille du bouton. */
  isFiltered: boolean;
  scope: ViewScope;
  onChangeScope: (scope: ViewScope) => void;
  reports: SourceReport[];
  lastUpdatedAt: number | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}

/** Intitulé de section. Uniformise sans mériter un composant à part entière. */
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="font-['Inter'] text-[10px] font-bold uppercase tracking-wider text-[#e5bdb9]/70">
    {children}
  </p>
);

export const MobileControls: React.FC<MobileControlsProps> = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  chipFilter,
  onChipFilterChange,
  availablePhases,
  visibleCount,
  isFiltered,
  scope,
  onChangeScope,
  reports,
  lastUpdatedAt,
  isRefreshing,
  onRefresh,
}) => {
  const { t, intlTag } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const hasFailure = hasScopeFailure(reports, scope);

  const chips: [ChipFilter, string][] = [
    ['all', t('list.all')],
    ['> 100 Ops', t('list.chipOver100')],
    ['Aerial Assets', t('list.chipAerial')],
    ['Resolution', t('list.chipOngoing')],
  ];

  return (
    <div className="md:hidden absolute top-0 left-0 right-0 z-20 pointer-events-none">
      <div className="px-3 pt-3 pointer-events-auto">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          title={t('list.filters')}
          className={`relative h-10 w-10 rounded-full border flex items-center justify-center shadow-lg transition-colors ${
            hasFailure
              ? 'bg-[#7f1d1d] text-[#ffb3ad] border-[#ef4444]'
              : isOpen
                ? 'bg-[#e2e2e3] text-[#121415] border-white'
                : 'bg-[#16191C]/95 text-[#e5bdb9] border-[#3a3d3f]'
          }`}
        >
          <Icon name={hasFailure ? 'error' : 'tune'} className="text-[20px]" />
          {/* Pastille du filtre actif. Elle s'efface devant l'alerte de panne :
              deux signaux superposés sur un bouton de 40 px ne se lisent plus,
              et « un service est muet » prime sur « une vue est restreinte ». */}
          {isFiltered && !isOpen && !hasFailure && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#ffb3ad] border-2 border-[#16191C]" />
          )}
        </button>
      </div>

      {isOpen && (
        <div className="mx-3 mt-2 p-3 rounded-xl bg-[#16191C] border border-[#2D3034] shadow-2xl pointer-events-auto space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Le périmètre vient EN TÊTE : il dit de quoi la carte parle, et
              restreindre une vue dont on ignore l'étendue n'a pas de sens.
              Même ordre que dans l'en-tête desktop. */}
          <div>
            <SectionLabel>{t('scope.label')}</SectionLabel>
            <div className="flex items-center gap-2 flex-wrap mt-1.5">
              <ScopeSwitcher scope={scope} onChangeScope={onChangeScope} />
              <SourceStatusBadge reports={reports} scope={scope} />
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                title={t('stats.refreshNow')}
                className="h-[30px] px-2.5 rounded border border-[#333536] bg-[#282a2b] text-[#ffb3ad] text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-60"
              >
                <Icon
                  name={isRefreshing ? 'progress_activity' : 'refresh'}
                  className={`text-[15px] ${isRefreshing ? 'animate-spin' : ''}`}
                />
                {/* L'âge de la DONNÉE, pas l'heure d'ouverture de la page. */}
                {!isRefreshing && lastUpdatedAt && (
                  <span className="tabular-nums whitespace-nowrap">
                    {formatTimeAgo(lastUpdatedAt, intlTag, t('time.justNow'))}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="border-t border-[#2D3034] pt-3">
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-0 h-full flex items-center">
                <Icon name="search" className="text-[18px] text-[#e5bdb9]" />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={t('list.searchPlaceholder')}
                className="w-full bg-[#1e2021] border border-[#333536] text-[#e2e2e3] pl-9 pr-3 py-2 text-sm rounded focus:outline-none focus:border-[#ffb3ad] placeholder:text-[#e5bdb9]/60"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar mt-2">
              {chips.map(([chip, label]) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => onChipFilterChange(chip)}
                  className={`h-8 px-3 rounded-full text-xs whitespace-nowrap flex items-center border transition-colors ${
                    chipFilter === chip
                      ? 'bg-[#e2e2e3] text-[#121415] font-bold border-white'
                      : 'bg-[#1e2021] text-[#e5bdb9] border-[#333536]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[#2D3034] pt-3">
            <div className="flex justify-between items-start mb-1.5">
              <SectionLabel>{t('list.filterByStatus')}</SectionLabel>
              {isFiltered && (
                <button
                  type="button"
                  onClick={() => {
                    onSearchChange('');
                    onStatusFilterChange('all');
                    onChipFilterChange('all');
                  }}
                  className="text-[#ffb3ad] underline text-[11px] leading-none"
                >
                  {t('list.clear')}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {[
                { code: ONGOING_FILTER, label: t('list.chipOngoing') },
                { code: 'all', label: t('list.allStatuses') },
                ...availablePhases.map((phase) => ({
                  code: phase,
                  label: t(`phase.${phase}` as TranslationKey),
                })),
              ].map(({ code, label }) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => onStatusFilterChange(code)}
                  className={`px-2 py-1.5 rounded text-left transition-colors ${
                    statusFilter === code
                      ? 'bg-[#ffb3ad] text-[#680009] font-bold'
                      : 'bg-[#1e2021] text-[#e2e2e3]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/*
            ⚠️ Le décompte est affiché ICI, et pas seulement sur le bouton de la
            liste : sur une carte d'incendies, zéro marqueur se lit spontanément
            « rien ne brûle ». Le rappeler à côté du filtre qui les a écartés
            rattache l'écran vide à sa cause. Même principe que le badge de
            couverture pour les services muets.
          */}
          <p className="text-[11px] text-[#e5bdb9] tabular-nums">
            {t('list.open', { count: visibleCount })}
          </p>
        </div>
      )}
    </div>
  );
};
