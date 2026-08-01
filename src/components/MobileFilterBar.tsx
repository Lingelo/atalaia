import React, { useState } from 'react';
import { Icon } from './Icon';
import { useI18n } from '../i18n/context';
import { ONGOING_FILTER, type ChipFilter } from '../lib/filters';
import type { TranslationKey } from '../i18n/pt';

/**
 * Filtres du mobile, posés SUR la carte.
 *
 * POURQUOI ce composant existe, alors que les filtres étaient déjà écrits :
 *
 * Ils vivaient uniquement dans la feuille de liste, laquelle occupe 72 % de la
 * hauteur. Restreindre la carte imposait donc de la recouvrir — on filtrait à
 * l'aveugle, puis on refermait pour constater le résultat. Le paradoxe était
 * complet : `src/lib/filters.ts` a précisément été extrait pour que le prédicat
 * gouverne les DEUX vues, et sur téléphone sa seule porte d'entrée en masquait
 * une. L'état, lui, n'a pas bougé d'un pouce : il vit toujours dans `App`, et
 * cette barre n'est qu'une commande de plus branchée dessus.
 *
 * POURQUOI EN HAUT, et non près des autres commandes de carte :
 *
 * - Le haut de l'écran est LIBRE sur mobile — l'en-tête est `hidden md:flex`.
 * - La feuille de liste est ancrée en bas sur 72 % : la barre reste donc
 *   visible quand elle est ouverte. Un seul jeu de filtres, jamais caché,
 *   qu'on lise la carte ou la liste.
 * - Le bas est déjà disputé : barre d'onglets fixe, pile de commandes de la
 *   carte, bouton d'ouverture de la liste. On vient justement de déplacer ces
 *   commandes parce qu'elles s'y recouvraient.
 *
 * ⚠️ `z-20` : au-dessus de la carte (`z-0`), mais SOUS le panneau de détail
 * (`z-30`). Sélectionner un sinistre doit primer sur le réglage des filtres,
 * pas cohabiter avec lui.
 */
interface MobileFilterBarProps {
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
   * disparaîtraient au fur et à mesure qu'on s'en sert, et on ne pourrait plus
   * revenir en arrière depuis un choix devenu le seul restant.
   */
  availablePhases: string[];
  /** Ce que la carte montre en ce moment. Voir la note sur le décompte nul. */
  visibleCount: number;
  /** Un filtre restreint-il la vue ? Alimente la pastille du bouton. */
  isFiltered: boolean;
}

export const MobileFilterBar: React.FC<MobileFilterBarProps> = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  chipFilter,
  onChipFilterChange,
  availablePhases,
  visibleCount,
  isFiltered,
}) => {
  const { t } = useI18n();
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const chips: [ChipFilter, string][] = [
    ['all', t('list.all')],
    ['> 100 Ops', t('list.chipOver100')],
    ['Aerial Assets', t('list.chipAerial')],
    ['Resolution', t('list.chipOngoing')],
  ];

  return (
    <div className="md:hidden absolute top-0 left-0 right-0 z-20 pointer-events-none">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 pointer-events-auto">
        {/* Bouton du panneau complet. La pastille dit qu'un filtre est actif
            SANS avoir à ouvrir : c'est la contrepartie exigée par le filtre
            « en cours » posé au chargement, que l'utilisateur n'a pas choisi. */}
        <button
          type="button"
          onClick={() => setIsPanelOpen((open) => !open)}
          aria-expanded={isPanelOpen}
          title={t('list.filters')}
          className={`relative shrink-0 h-9 w-9 rounded-full border flex items-center justify-center shadow-lg transition-colors ${
            isPanelOpen
              ? 'bg-[#e2e2e3] text-[#121415] border-white'
              : 'bg-[#16191C]/95 text-[#e5bdb9] border-[#3a3d3f]'
          }`}
        >
          <Icon name="tune" className="text-[18px]" />
          {isFiltered && !isPanelOpen && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#ffb3ad] border-2 border-[#16191C]" />
          )}
        </button>

        {/* Filtres rapides. Ils étaient déjà dans la feuille, en `md:hidden` :
            ils ont DÉMÉNAGÉ ici plutôt que d'être dupliqués. */}
        <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar">
          {chips.map(([chip, label]) => (
            <button
              key={chip}
              type="button"
              onClick={() => onChipFilterChange(chip)}
              className={`h-9 px-3.5 rounded-full text-xs whitespace-nowrap flex items-center shadow-lg border transition-colors ${
                chipFilter === chip
                  ? 'bg-[#e2e2e3] text-[#121415] font-bold border-white'
                  : 'bg-[#16191C]/95 text-[#e5bdb9] border-[#3a3d3f]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isPanelOpen && (
        <div className="mx-3 mb-2 p-3 rounded-xl bg-[#16191C] border border-[#2D3034] shadow-2xl pointer-events-auto space-y-3">
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

          <div>
            <div className="flex justify-between items-center text-[#e5bdb9] font-semibold text-xs mb-1.5">
              <span>{t('list.filterByStatus')}</span>
              {isFiltered && (
                <button
                  type="button"
                  onClick={() => {
                    onSearchChange('');
                    onStatusFilterChange('all');
                    onChipFilterChange('all');
                  }}
                  className="text-[#ffb3ad] underline text-[11px]"
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
            ⚠️ Le décompte est affiché DANS le panneau, et pas seulement sur le
            bouton de la liste : sur une carte d'incendies, zéro marqueur se lit
            spontanément « rien ne brûle ». Dire « 0 ocorrências » à côté du
            filtre qui les a écartés rattache l'écran vide à sa cause. C'est le
            même principe que `SourceStatusBadge` pour les services muets.
          */}
          <p className="text-[11px] text-[#e5bdb9] tabular-nums">
            {t('list.open', { count: visibleCount })}
          </p>
        </div>
      )}
    </div>
  );
};
