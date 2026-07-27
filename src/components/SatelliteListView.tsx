import React from 'react';

import type { SatelliteDetection } from '../types';
import { formatTimeAgo } from '../lib/time';
import { useI18n } from '../i18n/context';

interface SatelliteListViewProps {
  detections: SatelliteDetection[];
  isLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
}

/** Au-delà, la liste devient un annuaire illisible ; les foyers sont triés par puissance. */
const MAX_ROWS = 200;

/**
 * Liste des foyers satellite, pendant du mode Europe.
 *
 * Elle n'affiche NI effectif, NI statut, NI chronologie — parce que la donnée
 * n'en contient pas. Réutiliser les lignes du mode Portugal aurait rempli la
 * colonne de « 0 opérationnel », donnant l'impression fausse que ces feux ne
 * mobilisent personne. Ici on montre ce qu'on sait : puissance radiative,
 * nombre de passages satellite, heure de détection.
 */
export const SatelliteListView: React.FC<SatelliteListViewProps> = ({
  detections,
  isLoading,
  isOpen,
  onClose,
}) => {
  const { t, n, intlTag } = useI18n();
  const rows = detections.slice(0, MAX_ROWS);

  return (
    <aside
      aria-hidden={!isOpen}
      className={`absolute bottom-16 left-0 right-0 z-20 h-[72%] rounded-t-2xl overflow-hidden bg-[#16191C] border-t border-[#2D3034] flex flex-col transition-transform duration-300 ${
        isOpen ? 'translate-y-0' : 'translate-y-[calc(100%+4rem)] pointer-events-none'
      } md:static md:bottom-auto md:h-full md:w-[380px] lg:w-[400px] md:translate-y-0 md:pointer-events-auto md:rounded-none md:border-t-0 md:border-r md:shrink-0`}
    >
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#1e2021] border-b border-[#2D3034] shrink-0">
        <span className="font-['Inter'] text-[13px] text-[#e5bdb9] tabular-nums">
          {t('list.summaryDetections', { count: n(detections.length) })}
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

      <header className="px-4 py-3 border-b border-[#2D3034] bg-[#1e2021] shrink-0">
        <h2 className="font-['Inter'] text-[15px] font-bold text-[#e2e2e3] flex items-center gap-2">
          <span className="w-3 h-3 rounded-full border-2 border-[#8b5cf6]" />
          {t('satellite.title')}
        </h2>
        <p className="font-['Inter'] text-[11px] text-[#e5bdb9] mt-1 tabular-nums">
          {t('satellite.count', { count: n(detections.length) })}
        </p>
        {/* L'avertissement est en tête de liste, pas en note de bas de page : c'est
            la première chose à savoir sur ces données. */}
        <p className="font-['Inter'] text-[11px] leading-snug text-[#e5bdb9]/70 mt-2">
          {t('satellite.disclaimer')}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto divide-y divide-[#2D3034]">
        {isLoading && (
          <p className="p-4 text-[13px] text-[#e5bdb9]">{t('satellite.loading')}</p>
        )}

        {!isLoading &&
          rows.map((detection) => (
            <article key={detection.id} className="px-4 py-3 hover:bg-[#1a1c1d] transition-colors">
              <div className="flex justify-between items-baseline gap-2">
                <span className="font-['Inter'] text-[15px] font-semibold text-[#e2e2e3] tabular-nums">
                  {n(detection.frpMw, { maximumFractionDigits: 1 })} MW
                </span>
                <span className="font-['Inter'] text-[12px] text-[#e5bdb9] tabular-nums shrink-0">
                  {formatTimeAgo(detection.detectedAt, intlTag, t('time.justNow'))}
                </span>
              </div>
              <p className="font-['Inter'] text-[12px] text-[#e5bdb9] tabular-nums mt-0.5">
                {detection.lat.toFixed(3)}, {detection.lng.toFixed(3)} ·{' '}
                {detection.satellites.join(', ')} · {detection.passes}×
              </p>
            </article>
          ))}

        {!isLoading && detections.length > MAX_ROWS && (
          <p className="px-4 py-3 text-[12px] text-[#e5bdb9]/70 italic">
            {t('satellite.count', { count: n(detections.length) })}
          </p>
        )}
      </div>
    </aside>
  );
};
