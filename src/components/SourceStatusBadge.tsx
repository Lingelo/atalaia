import React, { useState } from 'react';

import { SOURCES, type ViewScope } from '../types';
import type { SourceReport } from '../api/spain/index';
import { useI18n } from '../i18n/context';

interface SourceStatusBadgeProps {
  reports: SourceReport[];
  scope: ViewScope;
}

/**
 * Couverture réelle du périmètre affiché.
 *
 * POURQUOI cet élément existe, alors qu'il n'affiche aucune donnée d'incendie :
 *
 * L'Espagne n'a pas de service national d'incendies interrogeable. Trois
 * communautés autonomes publient — Andalousie, Catalogne, Castille-et-León — et
 * les quatorze autres non. Sans cette mention, une carte vide au-dessus de la
 * Galice se lirait « il n'y brûle rien », alors qu'elle signifie « on ne sait
 * pas ». C'est la confusion la plus dangereuse que puisse produire cette
 * application, et la seule qu'aucun soin apporté aux données ne corrige : elle
 * se règle en le disant.
 *
 * Le badge sert aussi de témoin de panne. Un service injoignable retire son
 * territoire de la carte sans rien changer d'autre à l'écran : c'est ici, et
 * nulle part ailleurs, que la différence se voit.
 */
export const SourceStatusBadge: React.FC<SourceStatusBadgeProps> = ({ reports, scope }) => {
  const { t, n } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  // Le périmètre mondial ne repose sur aucun de ces services : il n'a rien à
  // qualifier ici, l'avertissement satellite est porté par sa propre liste.
  if (scope === 'world' || reports.length === 0) return null;

  const relevant = reports.filter((report) => {
    if (scope === 'iberia') return true;
    const country = SOURCES[report.source].country;
    return scope === 'portugal' ? country === 'PT' : country === 'ES';
  });

  if (relevant.length === 0) return null;

  const failing = relevant.filter((report) => !report.ok);
  const hasFailure = failing.length > 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className={`px-2.5 py-1.5 rounded text-[11px] font-semibold flex items-center gap-1.5 border transition-colors ${
          hasFailure
            ? 'bg-[#7f1d1d]/30 text-[#ffb3ad] border-[#7f1d1d]'
            : 'bg-[#282a2b] text-[#e5bdb9] border-[#333536] hover:bg-[#333536]'
        }`}
        title={t('sources.title')}
      >
        <span className="material-symbols-outlined text-[15px]">
          {hasFailure ? 'error' : 'database'}
        </span>
        <span className="tabular-nums">
          {t('sources.count', {
            ok: relevant.length - failing.length,
            total: relevant.length,
          })}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[300px] rounded border border-[#2D3034] bg-[#16191C] shadow-2xl p-3 z-[500] text-left">
          <h3 className="font-['Inter'] text-[12px] font-bold text-[#e2e2e3] uppercase tracking-wider mb-2">
            {t('sources.title')}
          </h3>

          <ul className="flex flex-col gap-2">
            {relevant.map((report) => {
              const meta = SOURCES[report.source];
              return (
                <li key={report.source} className="flex items-start gap-2">
                  <span
                    className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                      report.ok ? 'bg-[#10b981]' : 'bg-[#ef4444]'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-['Inter'] text-[12px] text-[#e2e2e3] font-semibold">
                      {meta.territory}
                    </p>
                    <p className="font-['Inter'] text-[11px] text-[#e5bdb9] truncate">
                      {meta.name} ·{' '}
                      {report.ok
                        ? t('sources.incidents', { count: n(report.count) })
                        : t('sources.unavailable')}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* La phrase la plus importante du composant : elle nomme ce qui
              n'est PAS couvert. Sans elle, la liste ci-dessus se lirait comme
              un inventaire complet de l'Espagne. */}
          <p className="font-['Inter'] text-[11px] leading-snug text-[#e5bdb9]/80 mt-3 pt-3 border-t border-[#2D3034]">
            {t('sources.partialCoverage')}
          </p>
        </div>
      )}
    </div>
  );
};
