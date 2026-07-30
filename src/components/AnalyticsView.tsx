import React, { useMemo, useState } from 'react';

import { useI18n } from '../i18n/context';
import { useHistory } from '../hooks/useHistory';
import { SOURCES, type HistoryBlock } from '../types';

/**
 * Vue Historique — entièrement alimentée par des ARCHIVES RÉELLES.
 *
 * Ce que cet écran affichait auparavant : « 64 201 occurrences », « 1.2M ha »,
 * « Serra da Estrela 28 000 ha », et une courbe dessinée à la main dans le SVG,
 * dont le tracé ne dépendait d'aucune donnée. Un bandeau orange prévenait que
 * tout était faux, ce qui n'excusait pas de l'afficher.
 *
 * Désormais chaque nombre provient de `public/data/history.json`, produit par
 * `scripts/build-history.ts` à partir de l'archive de fogos.pt (151 000
 * occurrences) et de celle de la Junta de Castilla y León (5 600 incendies).
 *
 * DEUX BLOCS SÉPARÉS, ET PAS UN TOTAL IBÉRIQUE : les deux archives ne mesurent
 * pas la même chose. Le Portugal publie des décomptes d'occurrences sans
 * surface exploitable ; la Castille publie les deux. Les additionner sous un
 * seul titre produirait un total dont personne ne pourrait dire ce qu'il compte.
 * Chaque bloc porte donc son territoire, sa période et sa source.
 */

/** Mois abrégés, dans la langue courante. Aucun libellé n'est codé en dur. */
function useMonthLabels(): string[] {
  const { intlTag } = useI18n();
  return useMemo(() => {
    const formatter = new Intl.DateTimeFormat(intlTag, { month: 'short' });
    return Array.from({ length: 12 }, (_, index) =>
      formatter.format(new Date(Date.UTC(2024, index, 1)))
    );
  }, [intlTag]);
}

/** Courbe mensuelle réelle, tracée à partir des décomptes. */
const MonthlyChart: React.FC<{ block: HistoryBlock }> = ({ block }) => {
  const { t, n } = useI18n();
  const months = useMonthLabels();
  const [hovered, setHovered] = useState<number | null>(null);

  const peak = Math.max(
    1,
    ...block.monthly.map((month) => Math.max(month.count ?? 0, month.baseline ?? 0))
  );

  const width = 1000;
  const height = 220;
  const step = width / 11;

  /**
   * Construit un tracé en SAUTANT les mois sans donnée.
   *
   * Un `null` interrompt la ligne (le point suivant reprend par un `M`) au lieu
   * d'être tracé à zéro. C'est ce qui distingue visuellement « il n'y a pas eu
   * de feu » de « on ne sait pas » : la courbe s'arrête, elle ne s'effondre pas.
   */
  const pathFrom = (values: Array<number | null>): string =>
    values
      .map((value, index) => {
        if (value === null) return null;
        const x = index * step;
        const y = height - (value / peak) * height;
        // `M` en début de segment : après une coupure, on repose le crayon.
        const command = index === 0 || values[index - 1] === null ? 'M' : 'L';
        return `${command} ${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .filter((segment): segment is string => segment !== null)
      .join(' ');

  const counts = block.monthly.map((month) => month.count);
  const line = pathFrom(counts);

  // L'aire n'est fermée que sur la plage réellement mesurée, pour ne pas
  // colorier une surface sous des mois dont on ignore la valeur.
  const measured = counts
    .map((value, index) => (value === null ? -1 : index))
    .filter((index) => index >= 0);
  const area =
    measured.length > 1
      ? `${line} L ${(measured[measured.length - 1] * step).toFixed(1)},${height} L ${(measured[0] * step).toFixed(1)},${height} Z`
      : '';

  const hasBaseline = block.monthly.some((month) => month.baseline !== null);
  const baselineLine = hasBaseline ? pathFrom(block.monthly.map((month) => month.baseline)) : null;

  return (
    <div className="bg-[#121415] col-span-12 lg:col-span-8 p-6 flex flex-col min-h-[380px]">
      <div className="flex flex-wrap justify-between items-baseline gap-2 mb-6">
        <h3 className="text-[20px] font-semibold text-[#e2e2e3]">
          {t('analytics.monthlyTitle', { year: block.currentYear })}
        </h3>
        <div className="flex items-center gap-4 text-[12px] text-[#e5bdb9]">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#ffb3ad] inline-block" />
            {block.currentYear}
          </span>
          {baselineLine && (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#7bd1fd] inline-block" />
              {/* Un intervalle, pas une énumération : « 2023–2025 » et non
                  « 2023–2024–2025 », qui se lisait comme trois dates isolées. */}
              {t('analytics.baseline', {
                years:
                  block.baselineYears.length > 1
                    ? `${block.baselineYears[0]}–${block.baselineYears[block.baselineYears.length - 1]}`
                    : String(block.baselineYears[0] ?? ''),
              })}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 relative flex flex-col justify-between pt-4 pb-6">
        <div className="w-full h-[220px] relative">
          <svg
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
            viewBox={`0 0 ${width} ${height}`}
          >
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffb3ad" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#121415" stopOpacity="0.05" />
              </linearGradient>
            </defs>

            {baselineLine && (
              <path d={baselineLine} fill="none" stroke="#7bd1fd" strokeWidth="2" strokeDasharray="6 5" />
            )}
            <path d={area} fill="url(#areaGrad)" />
            <path d={line} fill="none" stroke="#ffb3ad" strokeWidth="3" />
          </svg>

          <div className="absolute inset-0 flex justify-between items-end pointer-events-auto">
            {block.monthly.map((month, index) => (
              <div
                key={month.month}
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
                className="flex-1 h-full flex flex-col justify-end items-center group cursor-pointer relative"
              >
                {hovered === index && (
                  <div className="absolute -top-14 z-20 bg-[#1e2021] border border-[#ffb3ad] text-[#e2e2e3] text-xs p-2 rounded shadow-xl whitespace-nowrap text-center">
                    <div className="font-bold text-[#ffb3ad]">
                      {months[index]} {block.currentYear}
                    </div>
                    <div>
                      {t('analytics.occurrences')}:{' '}
                      <span className="font-bold tabular-nums">
                        {month.count === null ? t('analytics.noData') : n(month.count)}
                      </span>
                    </div>
                    {month.baseline !== null && (
                      <div className="text-[#7bd1fd]">
                        {t('analytics.baselineShort')}:{' '}
                        <span className="font-bold tabular-nums">{n(month.baseline)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between text-[12px] text-[#e5bdb9] font-medium pt-2 border-t border-[#333536]">
          {months.map((label) => (
            <span key={label} className="text-center flex-1">
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

const HistoryBlockView: React.FC<{ block: HistoryBlock }> = ({ block }) => {
  const { t, n, intlTag } = useI18n();
  const source = SOURCES[block.source];

  const formatDate = (ms: number) =>
    new Date(ms).toLocaleDateString(intlTag, { year: 'numeric', month: 'short' });

  const peakRegion = Math.max(1, ...block.regions.map((region) => region.incidents));
  const previousYears = block.yearly.filter((year) => !year.partial);
  const currentYearTotal = block.yearly.find((year) => year.partial);

  return (
    <section className="flex flex-col gap-4">
      {/* En-tête de bloc : sans lui, on ne saurait pas que ces chiffres décrivent
          un seul territoire, et on les lirait comme ibériques. */}
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#333536] pb-3">
        <div>
          <h3 className="font-['Inter'] text-[20px] font-semibold text-[#e2e2e3]">
            {block.coverage}
          </h3>
          <p className="font-['Inter'] text-[13px] text-[#e5bdb9]">
            {t('analytics.sourceLine', {
              source: source.name,
              from: formatDate(block.rangeStart),
              to: formatDate(block.rangeEnd),
            })}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-[1px] bg-[#333536] border border-[#333536] rounded overflow-hidden">
        {/* Tuiles de synthèse */}
        <div className="bg-[#121415] col-span-12 sm:col-span-6 lg:col-span-3 p-5 flex flex-col justify-center">
          <span className="text-[12px] font-semibold text-[#e5bdb9] uppercase tracking-widest mb-2">
            {t('analytics.totalOccurrences')}
          </span>
          <span className="text-[36px] font-bold text-[#e2e2e3] tabular-nums leading-none">
            {n(block.totalIncidents)}
          </span>
          <span className="text-[13px] text-[#ffb3ad] font-medium mt-2">
            {formatDate(block.rangeStart)} – {formatDate(block.rangeEnd)}
          </span>
        </div>

        <div className="bg-[#121415] col-span-12 sm:col-span-6 lg:col-span-3 p-5 flex flex-col justify-center">
          <span className="text-[12px] font-semibold text-[#e5bdb9] uppercase tracking-widest mb-2">
            {t('analytics.burnedArea')}
          </span>
          {/* `null` ne devient PAS « 0 ha » : l'archive portugaise ne publie
              aucune surface exploitable, ce qui est une absence de mesure et non
              une absence de dégâts. */}
          {block.totalBurnedHa === null ? (
            <>
              <span className="text-[24px] font-semibold text-[#5a5d5f] leading-none">—</span>
              <span className="text-[13px] text-[#e5bdb9] mt-2">
                {t('analytics.noBurnedData')}
              </span>
            </>
          ) : (
            <>
              <span className="text-[36px] font-bold text-[#e2e2e3] tabular-nums leading-none">
                {n(Math.round(block.totalBurnedHa))}
              </span>
              <span className="text-[13px] text-[#e5bdb9] mt-2">{t('analytics.hectares')}</span>
            </>
          )}
        </div>

        <div className="bg-[#121415] col-span-12 sm:col-span-6 lg:col-span-3 p-5 flex flex-col justify-center">
          <span className="text-[12px] font-semibold text-[#e5bdb9] uppercase tracking-widest mb-2">
            {t('analytics.thisYear', { year: block.currentYear })}
          </span>
          <span className="text-[36px] font-bold text-[#e2e2e3] tabular-nums leading-none">
            {currentYearTotal ? n(currentYearTotal.incidents) : '—'}
          </span>
          {/* L'année en cours est incomplète : le dire évite de la lire comme
              une année calme un 30 juillet. */}
          <span className="text-[13px] text-[#e5bdb9] mt-2">{t('analytics.yearToDate')}</span>
        </div>

        <div className="bg-[#121415] col-span-12 sm:col-span-6 lg:col-span-3 p-5 flex flex-col justify-center">
          <span className="text-[12px] font-semibold text-[#e5bdb9] uppercase tracking-widest mb-2">
            {t('analytics.previousYears')}
          </span>
          {previousYears.length === 0 ? (
            <span className="text-[24px] font-semibold text-[#5a5d5f] leading-none">—</span>
          ) : (
            <div className="flex flex-col gap-1">
              {previousYears.map((year) => (
                <div key={year.year} className="flex justify-between text-[14px]">
                  <span className="text-[#e5bdb9] tabular-nums">{year.year}</span>
                  <span className="text-[#e2e2e3] font-semibold tabular-nums">
                    {n(year.incidents)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <MonthlyChart block={block} />

        {/* Territoires */}
        <div className="bg-[#121415] col-span-12 lg:col-span-4 p-6 flex flex-col min-h-[380px]">
          <h3 className="text-[20px] font-semibold text-[#e2e2e3] mb-4">
            {t('analytics.byRegion')}
          </h3>

          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[300px] pr-1">
            {block.regions.map((region) => (
              <div
                key={region.name}
                className="p-2 rounded bg-[#16191C] border border-[#333536] hover:border-[#ffb3ad] transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold text-[#e2e2e3] truncate">
                    {region.name}
                  </span>
                  <span className="text-[13px] font-bold text-[#ffb3ad] tabular-nums shrink-0">
                    {region.burnedHa === null
                      ? t('analytics.records', { count: n(region.incidents) })
                      : `${n(region.burnedHa)} ha`}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 bg-[#1e2021] rounded overflow-hidden">
                  <div
                    className="h-full bg-[#ac8885]"
                    style={{ width: `${(region.incidents / peakRegion) * 100}%` }}
                  />
                </div>
                {region.burnedHa !== null && (
                  <span className="text-[12px] text-[#e5bdb9]">
                    {t('analytics.records', { count: n(region.incidents) })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Incendies marquants — uniquement là où une surface réelle existe. */}
        {block.notable.length > 0 && (
          <div className="bg-[#121415] col-span-12 p-6 flex flex-col">
            <h3 className="text-[20px] font-semibold text-[#e2e2e3] mb-4">
              {t('analytics.notableTitle')}
            </h3>

            <div className="flex flex-col divide-y divide-[#333536]">
              <div className="flex items-center py-2 text-[12px] font-semibold text-[#e5bdb9] uppercase tracking-wider">
                <div className="w-1 mr-3" />
                <div className="flex-1">{t('watch.locationName')}</div>
                <div className="w-28 text-right">{t('analytics.date')}</div>
                <div className="w-28 text-right">{t('analytics.hectares')}</div>
              </div>

              {block.notable.map((fire, index) => (
                <div key={fire.id} className="flex items-center py-3 px-1">
                  <div
                    className={`w-1 h-8 rounded mr-3 shrink-0 ${
                      index === 0 ? 'bg-[#ffb3ad]' : 'bg-[#ac8885]'
                    }`}
                  />
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="text-[15px] font-semibold text-[#e2e2e3] truncate">
                      {fire.name}
                    </div>
                    <div className="text-[13px] text-[#e5bdb9] truncate">{fire.location}</div>
                  </div>
                  <div className="w-28 text-right text-[13px] text-[#e5bdb9] tabular-nums">
                    {formatDate(fire.startedAt)}
                  </div>
                  <div className="w-28 text-right text-[15px] font-bold text-[#e2e2e3] tabular-nums">
                    {n(fire.burnedHa)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export const AnalyticsView: React.FC = () => {
  const { t, intlTag } = useI18n();
  const { history, isLoading, error } = useHistory(true);

  return (
    <div className="flex-grow p-4 md:p-8 flex flex-col gap-8 w-full max-w-[1440px] mx-auto overflow-y-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-[#333536]">
        <div>
          <h2 className="font-['Inter'] text-[28px] font-semibold text-[#e2e2e3]">
            {t('analytics.title')}
          </h2>
          <p className="font-['Inter'] text-[14px] text-[#e5bdb9]">{t('analytics.subtitle')}</p>
        </div>

        {history && (
          <p className="font-['Inter'] text-[12px] text-[#e5bdb9]/70">
            {t('analytics.generatedAt', {
              date: new Date(history.generatedAt).toLocaleString(intlTag, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            })}
          </p>
        )}
      </div>

      {isLoading && (
        <p className="text-[14px] text-[#e5bdb9] flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] animate-spin">
            progress_activity
          </span>
          {t('analytics.loading')}
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded border border-[#7f1d1d] bg-[#7f1d1d]/20 px-3 py-2.5">
          <span className="material-symbols-outlined text-[18px] text-[#ffb3ad] shrink-0">
            cloud_off
          </span>
          <p className="font-['Inter'] text-[13px] leading-snug text-[#e2e2e3]">{error}</p>
        </div>
      )}

      {history?.blocks.map((block) => <HistoryBlockView key={block.source} block={block} />)}

      {/* La couverture partielle est écrite sous les données plutôt qu'en
          avertissement au-dessus : ce ne sont plus des données fausses à
          désavouer, mais des données réelles dont il faut connaître l'étendue. */}
      {history && (
        <p className="font-['Inter'] text-[12px] leading-relaxed text-[#e5bdb9]/70 border-t border-[#333536] pt-4">
          {t('analytics.coverageNote')}
        </p>
      )}
    </div>
  );
};
