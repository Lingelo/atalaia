import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);

  /**
   * Position du panneau, mesurée sur le bouton.
   *
   * ⚠️ POURQUOI ce calcul, là où un simple `absolute` suffirait normalement :
   * la barre du haut porte `overflow-x-auto`, pour rester utilisable sur un
   * écran étroit. Or CSS interdit de mélanger les axes — dès qu'un axe n'est
   * plus `visible`, l'autre passe de `visible` à `auto`. La barre CLIPPE donc
   * verticalement, et un panneau en `absolute` y disparaissait purement et
   * simplement : on cliquait, et la carte restait à l'écran.
   *
   * Un élément `fixed` échappe au découpage de ses ancêtres. Il faut en revanche
   * lui donner ses coordonnées, d'où la mesure.
   */
  useLayoutEffect(() => {
    if (!isOpen) return;

    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setAnchor({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    };

    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [isOpen]);

  // Fermeture au clic extérieur : sans elle, un panneau ouvert par curiosité
  // reste posé sur la carte, qu'il masque en partie.
  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if ((target as Element)?.closest?.('[data-source-panel]')) return;
      setIsOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen]);

  if (reports.length === 0) return null;

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
        ref={buttonRef}
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

      {isOpen && anchor && (
        <div
          data-source-panel
          style={{ top: anchor.top, right: anchor.right }}
          className="fixed w-[300px] max-w-[calc(100vw-2rem)] rounded border border-[#2D3034] bg-[#16191C] shadow-2xl p-3 z-[900] text-left"
        >
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
