import React, { useMemo, useState } from 'react';
import { Incident } from '../types';
import { formatDateTime } from '../lib/time';
import { resolvePhase } from '../lib/status';
import { useI18n } from '../i18n/context';
import type { TranslationKey } from '../i18n/pt';

/**
 * Convertit la ventilation ICNF (hectares absolus) en parts affichables.
 *
 * Retourne null si la donnée est absente OU si le total est nul : une barre
 * empilée à 0 % de partout n'informe pas, elle décore.
 */
function useBurnedAreaParts(incident: Incident, labels: [string, string, string]) {
  return useMemo(() => {
    const breakdown = incident.burnedBreakdown;
    const totalHa = incident.burnedAreaHa;
    if (!breakdown || totalHa === null || totalHa <= 0) return null;

    const toPct = (ha: number) => Math.round((ha / totalHa) * 100);

    return {
      totalHa,
      parts: [
        { label: labels[0], pct: toPct(breakdown.povoamentoHa), barClass: 'bg-[#ffb3ad]' },
        { label: labels[1], pct: toPct(breakdown.matoHa), barClass: 'bg-[#0079a1]' },
        { label: labels[2], pct: toPct(breakdown.agricolaHa), barClass: 'bg-[#ac8885]' },
      ],
    };
  }, [incident.burnedBreakdown, incident.burnedAreaHa, labels]);
}

interface IncidentDetailPanelProps {
  incident: Incident;
  onClose: () => void;
  onFocusOnMap: (incident: Incident) => void;
  onToggleFollow?: (incidentId: string) => void;
}

/**
 * Une grande tuile de moyens engagés, ou « — » si le service ne publie rien.
 *
 * Voir `Metric` dans IncidentListView pour le raisonnement : afficher « 0 »
 * là où la donnée est absente ferait passer une lacune de publication pour une
 * absence de secours.
 */
const BigMetric: React.FC<{
  value: number | null;
  label: string;
  partial?: boolean;
  className?: string;
}> = ({ value, label, partial = false, className = '' }) => (
  <div className={`flex flex-col p-3 min-w-0 ${className}`}>
    <span className="font-['Inter'] text-[24px] md:text-[32px] font-bold text-[#e2e2e3] tabular-nums leading-none">
      {value === null ? (
        <span className="text-[#5a5d5f]">—</span>
      ) : (
        <>
          {partial && value > 0 && (
            <span className="text-[#e5bdb9] text-[18px] md:text-[22px] mr-0.5">≥</span>
          )}
          {value}
        </>
      )}
    </span>
    <span className="font-['Inter'] text-[10px] md:text-[11px] font-semibold text-[#e5bdb9] uppercase tracking-wide leading-tight break-words mt-2">
      {label}
    </span>
  </div>
);

export const IncidentDetailPanel: React.FC<IncidentDetailPanelProps> = ({
  incident,
  onClose,
  onFocusOnMap,
  onToggleFollow,
}) => {
  const { t, n, intlTag } = useI18n();
  const [copied, setCopied] = useState(false);

  const burnedLabels = useMemo<[string, string, string]>(
    () => [t('detail.forestStand'), t('detail.scrub'), t('detail.agricultural')],
    [t]
  );
  const burned = useBurnedAreaParts(incident, burnedLabels);

  const translateNature = (nature: string): string => {
    const normalised = nature.toLowerCase();
    if (normalised.includes('mato')) return t('nature.mato');
    if (normalised.includes('povoamento')) return t('nature.povoamento');
    if (normalised.includes('agrícola') || normalised.includes('agricola'))
      return t('nature.agricola');
    return nature;
  };

  const meta = resolvePhase(incident.phase);
  const statusLabel = t(`phase.${incident.phase}` as TranslationKey);

  // Couleur de statut : registre unique (src/lib/status.ts). Auparavant ce
  // composant colorait « Em Resolução » en cyan alors que la carte et la liste le
  // peignaient en ambre — même statut, deux couleurs selon l'écran.
  const statusColor = meta.color;

  const handleShare = () => {
    const text = t('detail.shareText', {
      title: incident.title,
      location: incident.locationName,
      status: statusLabel,
      personnel: incident.personnel === null ? '—' : incident.personnel,
    });
    if (navigator.share) {
      navigator.share({ title: incident.title, text: text, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text + ' ' + window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    // `bottom-16` sur mobile : sans ça le panneau descend sous la barre d'onglets
    // fixe (h-16) et sa dernière action, « Seguir esta zona », devient inatteignable.
    <aside className="w-full md:w-[460px] bg-[#16191C] border-l border-[#5c403d]/40 flex flex-col absolute md:relative right-0 top-0 bottom-16 md:bottom-0 md:h-full z-30 shadow-[-8px_0_24px_rgba(0,0,0,0.6)] transform translate-x-0 transition-all duration-300">
      {/* Mobile Handle (drag indicator on mobile) */}
      <div className="md:hidden w-full flex justify-center pt-2 pb-1 bg-[#16191C]">
        <div className="w-8 h-1 bg-[#2D3034] rounded-full" />
      </div>

      {/* Panel Header */}
      <header className="p-4 border-b border-[#333536] flex flex-col gap-2 shrink-0 bg-[#16191C]">
        <div className="flex justify-between items-start">
          {/* Status Pill */}
          <div
            className="inline-flex items-center px-2 py-1 rounded border"
            style={{ borderColor: statusColor, backgroundColor: `${statusColor}26` }}
          >
            <span
              className="font-['Inter'] text-[12px] font-semibold uppercase tracking-wider"
              style={{ color: statusColor }}
            >
              {statusLabel}
            </span>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('detail.close')}
            className="p-1 text-[#e5bdb9] hover:text-[#e2e2e3] hover:bg-[#333536] rounded transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div>
          {/* Titre : la freguesia, l'échelon le plus fin. Le sous-titre porte le
              contexte « Concelho, Distrito ». Auparavant les deux lignes disaient
              la même chose à l'envers (« Coimbra, Soure » / « Soure, Coimbra »). */}
          <h1 className="font-['Inter'] text-[28px] font-semibold text-[#e2e2e3] leading-tight">
            {incident.title}
          </h1>
          <p className="font-['Inter'] text-[14px] text-[#e5bdb9]">
            {incident.municipality}, {incident.district}
          </p>
        </div>
      </header>

      {/* Scrollable Panel Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        {/* Stat Trio */}
        <section className="grid grid-cols-3 gap-0 border border-[#333536] rounded bg-[#121415]/60">
          <BigMetric
            value={incident.personnel}
            label={t('detail.personnel')}
            partial={incident.personnelIsPartial}
            className="border-r border-[#333536]"
          />
          <BigMetric
            value={incident.vehicles}
            label={t('detail.vehicles')}
            className="border-r border-[#333536]"
          />
          <BigMetric value={incident.aircraft} label={t('detail.aircraft')} />
        </section>

        {/* Effectif partiel : la note explique le « ≥ » plutôt que de le laisser
            deviner. Sans elle, le symbole passerait pour une coquille. */}
        {incident.personnelIsPartial && incident.personnel !== null && (
          <p className="font-['Inter'] text-[12px] leading-snug text-[#e5bdb9]/80 -mt-4 italic">
            {t('detail.partialPersonnel')}
          </p>
        )}

        {/* Détail des moyens tel que le service le publie.
            Les libellés restent dans leur langue d'origine : « BRICA » et
            « ELIF » sont des noms de dispositifs, pas du vocabulaire à traduire.
            Ce bloc est ce qui rend le « ≥ » ci-dessus vérifiable — on voit les
            équipes qui ne sont pas comptées en personnes. */}
        {incident.resources.length > 0 && (
          <section>
            <h2 className="font-['Inter'] text-[12px] font-semibold text-[#e5bdb9] uppercase tracking-wider mb-3">
              {t('detail.resources')}
            </h2>
            <ul className="flex flex-wrap gap-1.5">
              {incident.resources.map((entry) => (
                <li
                  key={entry.label}
                  className="px-2 py-1 rounded border border-[#333536] bg-[#121415]/60 text-[12px] text-[#e2e2e3]"
                >
                  <span className="font-semibold tabular-nums">{entry.count}</span>{' '}
                  <span className="text-[#e5bdb9]">{entry.label}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Condições no local.
            L'humidité et le vent gouvernent la propagation : ils passent en gros,
            la température et la pluie en second rang. La provenance est affichée
            sans détour — le relevé vient d'une station distante de plusieurs
            kilomètres, le prétendre mesuré sur place serait mentir. */}
        <section>
          <h2 className="font-['Inter'] text-[12px] font-semibold text-[#e5bdb9] uppercase tracking-wider mb-3">
            {t('detail.conditions')}
          </h2>

          {incident.weather ? (
            <>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="rounded border border-[#333536] bg-[#121415]/60 p-3">
                  <span className="font-['Inter'] text-[24px] font-bold text-[#e2e2e3] tabular-nums leading-none">
                    {Math.round(incident.weather.humidade)}
                    <span className="text-[14px] font-normal text-[#e5bdb9]"> %</span>
                  </span>
                  <p className="font-['Inter'] text-[10px] font-semibold text-[#e5bdb9] uppercase tracking-wide mt-2">
                    {t('detail.humidity')}
                  </p>
                </div>
                <div className="rounded border border-[#333536] bg-[#121415]/60 p-3">
                  <span className="font-['Inter'] text-[24px] font-bold text-[#e2e2e3] tabular-nums leading-none">
                    {Math.round(incident.weather.intensidadeVentoKM)}
                    <span className="text-[14px] font-normal text-[#e5bdb9]"> km/h</span>
                  </span>
                  <p className="font-['Inter'] text-[10px] font-semibold text-[#e5bdb9] uppercase tracking-wide mt-2">
                    {t('detail.wind', { direction: incident.weather.direccVento })}
                  </p>
                </div>
              </div>

              <ul className="text-[13px] flex gap-4 mb-2">
                <li className="text-[#e5bdb9]">
                  {t('detail.temperature')}{' '}
                  <span className="text-[#e2e2e3] font-medium tabular-nums">
                    {n(incident.weather.temperatura, {
                      maximumFractionDigits: 1,
                    })}{' '}
                    °C
                  </span>
                </li>
                <li className="text-[#e5bdb9]">
                  {t('detail.precipitation')}{' '}
                  <span className="text-[#e2e2e3] font-medium tabular-nums">
                    {incident.weather.precAcumulada} mm
                  </span>
                </li>
              </ul>

              <p className="font-['Inter'] text-[12px] text-[#e5bdb9]/80 italic">
                {t('detail.weatherSource', {
                  station: incident.weather.stationLocation,
                  distance: Math.round(incident.weather.stationDistance),
                  time: formatDateTime(Date.parse(incident.weather.date), intlTag),
                })}
              </p>
            </>
          ) : (
            <p className="font-['Inter'] text-[13px] text-[#e5bdb9] italic">
              {t('detail.noWeather')}
            </p>
          )}
        </section>

        {/* Vertical Timeline: Histórico de Estado */}
        <section>
          <h2 className="font-['Inter'] text-[12px] font-semibold text-[#e5bdb9] uppercase tracking-wider mb-4">
            {t('detail.statusHistory')}
          </h2>
          <div className="relative pl-6 space-y-5 before:absolute before:inset-y-0 before:left-[11px] before:w-[1px] before:bg-[#333536]">
            {incident.history && incident.history.length > 0 ? (
              incident.history.map((evt, idx) => {
                const isCurrent = evt.isCurrent || idx === 0;
                return (
                  <div key={idx} className="relative">
                    <div
                      className="absolute left-[-29px] top-1.5 w-[9px] h-[9px] rounded-full border-2 border-[#16191C]"
                      style={{ backgroundColor: isCurrent ? statusColor : '#333536' }}
                    />
                    <div className="flex justify-between items-baseline">
                      <span
                        className={`font-['Inter'] text-[15px] ${isCurrent ? 'font-bold' : 'text-[#e2e2e3]'}`}
                        style={isCurrent ? { color: statusColor } : undefined}
                      >
                        {evt.status}
                      </span>
                      <span className="font-['Inter'] text-[14px] text-[#e5bdb9] tabular-nums">
                        {evt.time}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-[#e5bdb9]">{t('detail.noHistory')}</div>
            )}
          </div>
        </section>

        <hr className="border-t border-[#333536]" />

        {/* Área Ardida Estimada */}
        <section>
          <h2 className="font-['Inter'] text-[12px] font-semibold text-[#e5bdb9] uppercase tracking-wider mb-3">
            {t('detail.burnedArea')}
          </h2>
          {burned ? (
            <>
              <div className="mb-2 flex justify-between items-baseline">
                <span className="font-['Inter'] text-[24px] font-semibold text-[#e2e2e3] tabular-nums">
                  {n(burned.totalHa, { maximumFractionDigits: 1 })}{' '}
                  <span className="font-['Inter'] text-[14px] font-normal text-[#e5bdb9]">ha</span>
                </span>
              </div>

              {/* Barre empilée. Les parts sont calculées à partir des valeurs absolues
                  de l'ICNF, l'API ne fournissant pas de pourcentages. */}
              <div className="h-4 w-full flex rounded overflow-hidden mb-3 bg-[#121415]">
                {burned.parts.map((part) => (
                  <div
                    key={part.label}
                    className={`${part.barClass} h-full`}
                    style={{ width: `${part.pct}%` }}
                    title={`${part.label} (${part.pct} %)`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {burned.parts.map((part) => (
                  <div key={part.label} className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded ${part.barClass}`} />
                    <span className="font-['Inter'] text-[13px] text-[#e5bdb9]">
                      {part.label} ({part.pct} %)
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* L'ICNF n'estime pas systématiquement la surface — c'était même le cas
               du plus gros feu actif au relevé. Afficher 0 ha serait un mensonge. */
            <p className="font-['Inter'] text-[13px] text-[#e5bdb9] italic">
              {t('detail.noBurnedArea')}
            </p>
          )}
        </section>

        <hr className="border-t border-[#333536]" />

        {/* Detalhes Técnicos */}
        <section>
          <h2 className="font-['Inter'] text-[12px] font-semibold text-[#e5bdb9] uppercase tracking-wider mb-3">
            {t('detail.technical')}
          </h2>
          <ul className="flex flex-col text-[14px]">
            <li className="flex justify-between py-2 border-b border-[#333536]/50">
              <span className="text-[#e5bdb9]">{t('detail.nature')}</span>
              {/* La `natureza` arrive en portugais depuis la source. Trois valeurs
                  seulement, donc une table suffit ; toute autre valeur est
                  affichée telle quelle plutôt que masquée. */}
              <span className="text-[#e2e2e3] font-medium">{translateNature(incident.nature)}</span>
            </li>
            <li className="flex justify-between py-2 border-b border-[#333536]/50">
              <span className="text-[#e5bdb9]">{t('detail.altitude')}</span>
              <span className="text-[#e2e2e3] font-medium tabular-nums">
                {incident.altitude === null ? '—' : `${Math.round(incident.altitude)} m`}
              </span>
            </li>
            <li className="flex justify-between py-2 border-b border-[#333536]/50">
              <span className="text-[#e5bdb9]">{t('detail.alertSource')}</span>
              <span className="text-[#e2e2e3] font-medium">{incident.alertSource ?? '—'}</span>
            </li>
            <li className="flex justify-between py-2 border-b border-[#333536]/50">
              <span className="text-[#e5bdb9]">{t('detail.start')}</span>
              <span className="text-[#e2e2e3] font-medium tabular-nums">
                {formatDateTime(incident.startedAt, intlTag)}
              </span>
            </li>
          </ul>
        </section>
      </div>

      {/* Panel Footer */}
      <footer className="p-4 border-t border-[#333536] bg-[#16191C] flex flex-col gap-2 shrink-0">
        {copied && (
          <div className="bg-[#10b981]/20 border border-[#10b981] text-[#10b981] text-xs px-3 py-1.5 rounded text-center mb-1">
            Link/Detalhes copiados para a área de transferência!
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="flex-1 py-2.5 px-3 bg-[#282a2b] hover:bg-[#333536] text-[#e2e2e3] font-['Inter'] text-[14px] rounded flex items-center justify-center gap-2 transition-colors border border-[#333536]"
          >
            <span className="material-symbols-outlined text-[18px]">share</span>
            {t('detail.share')}
          </button>
          <button
            type="button"
            onClick={() => onFocusOnMap(incident)}
            className="flex-1 py-2.5 px-3 bg-[#282a2b] hover:bg-[#333536] text-[#e2e2e3] font-['Inter'] text-[14px] rounded flex items-center justify-center gap-2 transition-colors border border-[#333536]"
          >
            <span className="material-symbols-outlined text-[18px]">my_location</span>
            {t('detail.viewOnMap')}
          </button>
        </div>
        <button
          type="button"
          onClick={() => onToggleFollow && onToggleFollow(incident.id)}
          className={`w-full py-3 px-4 rounded font-['Inter'] text-[14px] font-bold flex items-center justify-center gap-2 transition-colors mt-1 ${
            incident.isFollowing
              ? 'bg-[#d8262c] text-white hover:bg-[#be0b1d]'
              : 'bg-white text-black hover:bg-gray-200'
          }`}
        >
          <span className="material-symbols-outlined text-[18px] material-symbols-filled">
            {incident.isFollowing ? 'notifications_active' : 'notifications'}
          </span>
          {incident.isFollowing ? t('detail.following') : t('detail.follow')}
        </button>
      </footer>
    </aside>
  );
};
