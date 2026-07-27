import React from 'react';
import { ViewTab, ViewScope } from '../types';
import { formatTimeAgo } from '../lib/time';
import { useI18n } from '../i18n/context';
import { ScopeSwitcher } from './ScopeSwitcher';

interface NavigationShellProps {
  activeTab: ViewTab;
  onChangeTab: (tab: ViewTab) => void;
  totalStats: {
    activeCount: number;
    operacionais: number;
    veiculos: number;
    meiosAereos: number;
  };
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
}) => {
  const { t, n, intlTag } = useI18n();
  return (
    <>
      {/* Desktop Top Right Stat Bar (Floats above map on Level 2) */}
      <div className="hidden lg:flex fixed top-4 right-6 z-[400] bg-[#16191C]/95 border border-[#2D3034] rounded shadow-2xl backdrop-blur-md divide-x divide-[#2D3034] items-stretch">
        {/* Le sélecteur ouvre la barre : il dit CE QUE les chiffres décrivent,
            donc il doit être lu avant eux. */}
        <div className="px-3 py-2.5 flex items-center">
          <ScopeSwitcher scope={scope} onChangeScope={onChangeScope} />
        </div>

        <div className="px-5 py-2.5 flex flex-col justify-center items-start">
          <span className="font-['Inter'] text-[24px] leading-none text-[#e2e2e3] font-bold tabular-nums tracking-tight">
            {n(totalStats.activeCount)}
          </span>
          <span className="font-['Inter'] text-[11px] text-[#e5bdb9] uppercase tracking-wider mt-1">
            {statLabels[0]}
          </span>
        </div>

        <div className="px-5 py-2.5 flex flex-col justify-center items-start">
          <span className="font-['Inter'] text-[24px] leading-none text-[#e2e2e3] font-bold tabular-nums tracking-tight">
            {n(totalStats.operacionais)}
          </span>
          <span className="font-['Inter'] text-[11px] text-[#e5bdb9] uppercase tracking-wider mt-1">
            {statLabels[1]}
          </span>
        </div>

        <div className="px-5 py-2.5 flex flex-col justify-center items-start">
          <span className="font-['Inter'] text-[24px] leading-none text-[#e2e2e3] font-bold tabular-nums tracking-tight">
            {n(totalStats.veiculos)}
          </span>
          <span className="font-['Inter'] text-[11px] text-[#e5bdb9] uppercase tracking-wider mt-1">
            {statLabels[2]}
          </span>
        </div>

        <div className="px-5 py-2.5 flex flex-col justify-center items-start">
          <span className="font-['Inter'] text-[24px] leading-none text-[#e2e2e3] font-bold tabular-nums tracking-tight">
            {n(totalStats.meiosAereos)}
          </span>
          <span className="font-['Inter'] text-[11px] text-[#e5bdb9] uppercase tracking-wider mt-1">
            {statLabels[3]}
          </span>
        </div>

        {/* Fraîcheur des données + rafraîchissement manuel */}
        <div className="px-4 py-2.5 flex items-center justify-center">
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
              {isRefreshing ? 'progressbar' : 'refresh'}
            </span>
            {isRefreshing
              ? t('stats.refreshing')
              : lastUpdatedAt
                ? t('stats.updated', { time: formatTimeAgo(lastUpdatedAt, intlTag, t('time.justNow')) })
                : t('stats.refresh')}
          </button>
        </div>
      </div>

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
          onClick={() => onChangeTab('analytics')}
          className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${
            activeTab === 'analytics' ? 'text-[#ffb3ad]' : 'text-[#e5bdb9] hover:text-[#e2e2e3]'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">analytics</span>
          <span className="font-['Inter'] text-[11px] font-semibold mt-0.5">{t('nav.stats')}</span>
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
