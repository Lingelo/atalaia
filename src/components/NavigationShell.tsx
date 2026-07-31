import React from 'react';
import { ViewTab, ViewScope } from '../types';
import { formatTimeAgo } from '../lib/time';
import { useI18n } from '../i18n/context';
import { ScopeSwitcher } from './ScopeSwitcher';
import { SourceStatusBadge } from './SourceStatusBadge';
import { LocaleSwitcher } from './LocaleSwitcher';
import type { SourceReport } from '../api/spain/index';

interface NavigationShellProps {
  activeTab: ViewTab;
  onChangeTab: (tab: ViewTab) => void;
  totalStats: {
    activeCount: number;
    /**
     * `null` quand AUCUN service du périmètre ne publie la valeur. Affiché
     * « — » plutôt que 0 : voir la note sur `personnel` dans types.ts.
     */
    personnel: number | null;
    vehicles: number | null;
    aircraft: number | null;
    /** Le total d'effectifs est-il un plancher plutôt qu'un total établi ? */
    personnelIsPartial: boolean;
  };
  /** État des services interrogés, pour le badge de couverture. */
  reports: SourceReport[];
  /** Date du dernier chargement réussi, ou null tant qu'il n'y en a pas eu. */
  lastUpdatedAt: number | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  scope: ViewScope;
  onChangeScope: (scope: ViewScope) => void;
  /** Libellés des quatre tuiles : ils diffèrent selon le périmètre affiché. */
  statLabels: [string, string, string, string];
}

export const NavigationShell: React.FC<NavigationShellProps> = ({
  activeTab,
  onChangeTab,
  totalStats,
  lastUpdatedAt,
  isRefreshing,
  onRefresh,
  scope,
  onChangeScope,
  statLabels,
  reports,
}) => {
  const { t, n, intlTag } = useI18n();

  /**
   * Rend une tuile de statistique.
   *
   * `null` devient « — », jamais 0. Sur un bandeau qui surplombe une carte
   * d'incendies, « 0 opérationnel » est une affirmation ; « — » est un aveu
   * d'ignorance. Seul le second est vrai quand le service ne publie rien.
   *
   * Le préfixe « ≥ » signale un total qui sous-compte, parce que les services
   * espagnols publient des brigades dont l'effectif reste inconnu.
   */
  const Stat: React.FC<{ value: number | null; label: string; partial?: boolean }> = ({
    value,
    label,
    partial = false,
  }) => (
    <div className="hidden lg:flex px-3 py-2 flex-col justify-center items-start shrink-0">
      <span className="font-['Inter'] text-[24px] leading-none text-[#e2e2e3] font-bold tabular-nums tracking-tight">
        {value === null ? (
          <span className="text-[#5a5d5f]">—</span>
        ) : (
          <>
            {partial && <span className="text-[#e5bdb9] text-[16px] mr-0.5">≥</span>}
            {n(value)}
          </>
        )}
      </span>
      <span className="font-['Inter'] text-[11px] text-[#e5bdb9] uppercase tracking-wider mt-1">
        {label}
      </span>
    </div>
  );

  return (
    <>
      {/* Barre de commandes desktop : onglets, périmètre, chiffres, fraîcheur.
          Un seul groupe plutôt que plusieurs encarts flottants, qui se
          disputeraient les coins de la carte avec la légende satellite (en haut
          à gauche) et les commandes de zoom (en bas à droite). */}
      {/* `overflow-x-auto` est un filet de sécurité, pas une décoration : la
          barre porte le nom, trois onglets, quatre périmètres, le sélecteur de
          langue, quatre tuiles et deux boutons. Sur un écran de portable étroit,
          mieux vaut qu'elle défile que de voir le bouton d'actualisation
          disparaître hors de l'écran, hors d'atteinte. */}
      {/* ⚠️ `relative` est REQUIS pour que le `z-[400]` ci-dessous existe : un
          z-index n'a aucun effet sur un élément `static`. Sans lui, la barre se
          faisait recouvrir par la carte, qui la suit dans le document. */}
      <header className="hidden md:flex relative shrink-0 z-[400] bg-[#16191C] border-b border-[#2D3034] divide-x divide-[#2D3034] items-stretch overflow-x-auto">
        {/* Nom de l'application. Il vivait dans l'en-tête de la liste des
            sinistres, donc invisible dès qu'on quittait la carte. */}
        <div className="px-4 flex items-center gap-2 shrink-0">
          <span className="material-symbols-outlined text-[#ffb3ad] text-[22px]">
            local_fire_department
          </span>
          <span className="hidden xl:inline font-['Inter'] text-[17px] font-bold tracking-tight text-[#e2e2e3]">
            {t('app.name')}
          </span>
        </div>
        {/* Onglets.
            ⚠️ Ils vivaient auparavant DANS la liste des sinistres, laquelle
            n'est rendue que sur l'onglet carte : passer sur Historique ou
            Alertes faisait donc disparaître la navigation elle-même, et il ne
            restait aucun moyen de revenir à la carte sur desktop — seule la
            barre du bas, `md:hidden`, permettait encore de circuler. Les
            onglets appartiennent au cadre de l'application, pas à l'un de ses
            écrans. */}
        <div className="px-2 py-2.5 flex items-center gap-1 shrink-0">
          {(
            [
              ['dashboard', 'map', t('nav.map')],
              ['watch-zones', 'notifications_active', t('nav.alerts')],
            ] as const
          ).map(([tab, icon, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => onChangeTab(tab)}
              aria-pressed={activeTab === tab}
              title={label}
              className={`px-2.5 py-1 rounded text-[12px] font-semibold flex items-center gap-1.5 transition-colors ${
                activeTab === tab
                  ? 'bg-[#ffb3ad] text-[#680009]'
                  : 'text-[#e5bdb9] hover:text-[#e2e2e3] hover:bg-[#282a2b]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{icon}</span>
              <span className="hidden 2xl:inline">{label}</span>
            </button>
          ))}
        </div>
        {/* Le sélecteur ouvre la barre : il dit CE QUE les chiffres décrivent,
            donc il doit être lu avant eux. */}
        <div className="px-3 py-2.5 flex items-center shrink-0">
          <ScopeSwitcher scope={scope} onChangeScope={onChangeScope} />
        </div>

        <Stat value={totalStats.activeCount} label={statLabels[0]} />
        <Stat
          value={totalStats.personnel}
          label={statLabels[1]}
          partial={totalStats.personnelIsPartial}
        />
        <Stat value={totalStats.vehicles} label={statLabels[2]} />
        <Stat value={totalStats.aircraft} label={statLabels[3]} />

        {/* Couverture réelle des services. Placé DANS la barre de statistiques
            parce qu'il qualifie ces chiffres : un total ibérique amputé de la
            Catalogne n'est pas le même total. */}
        <div className="px-3 py-2.5 flex items-center justify-center shrink-0">
          <SourceStatusBadge reports={reports} scope={scope} />
        </div>

        {/* Fraîcheur des données + rafraîchissement manuel */}
        <div className="px-4 py-2.5 flex items-center justify-center shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all bg-[#282a2b] text-[#ffb3ad] hover:bg-[#333536] border border-[#333536] disabled:opacity-60"
            title={t('stats.refreshNow')}
          >
            <span
              className={`material-symbols-outlined text-[16px] ${isRefreshing ? 'animate-spin' : ''}`}
            >
              {isRefreshing ? 'progress_activity' : 'refresh'}
            </span>
            {isRefreshing
              ? t('stats.refreshing')
              : lastUpdatedAt
                ? t('stats.updated', { time: formatTimeAgo(lastUpdatedAt, intlTag, t('time.justNow')) })
                : t('stats.refresh')}
          </button>
        </div>

        {/* Réglage posé une fois, donc placé en dernier : voir LocaleSwitcher. */}
        <div className="px-3 py-2.5 flex items-center justify-center shrink-0">
          <LocaleSwitcher />
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Fixed at bottom for small viewports) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#16191C] border-t border-[#2D3034] z-[500] flex justify-around items-center px-2">
        <button
          type="button"
          onClick={() => onChangeTab('dashboard')}
          className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
            activeTab === 'dashboard' ? 'text-[#ffb3ad]' : 'text-[#e5bdb9] hover:text-[#e2e2e3]'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">map</span>
          <span className="font-['Inter'] text-[11px] font-semibold mt-0.5">{t('nav.map')}</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeTab('watch-zones')}
          className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
            activeTab === 'watch-zones' ? 'text-[#ffb3ad]' : 'text-[#e5bdb9] hover:text-[#e2e2e3]'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">notifications_active</span>
          <span className="font-['Inter'] text-[11px] font-semibold mt-0.5">{t('nav.alerts')}</span>
        </button>
      </nav>
    </>
  );
};
