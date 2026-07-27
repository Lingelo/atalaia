import React, { useState } from 'react';
import { Incident } from '../types';

interface IncidentDetailPanelProps {
  incident: Incident;
  onClose: () => void;
  onFocusOnMap: (incident: Incident) => void;
  onToggleFollow?: (incidentId: string) => void;
}

export const IncidentDetailPanel: React.FC<IncidentDetailPanelProps> = ({
  incident,
  onClose,
  onFocusOnMap,
  onToggleFollow,
}) => {
  const [copied, setCopied] = useState(false);

  // Status color styles helper
  const getStatusBadgeStyle = (status: Incident['status']) => {
    switch (status) {
      case 'Em Resolução':
        return {
          bg: 'bg-[#7bd1fd]/15',
          border: 'border-[#7bd1fd]',
          text: 'text-[#7bd1fd]',
        };
      case 'Em Curso':
        return {
          bg: 'bg-[#ef4444]/15',
          border: 'border-[#ef4444]',
          text: 'text-[#ef4444]',
        };
      case 'Vigilância':
        return {
          bg: 'bg-[#3b82f6]/15',
          border: 'border-[#3b82f6]',
          text: 'text-[#3b82f6]',
        };
      case 'Conclusão':
        return {
          bg: 'bg-[#10b981]/15',
          border: 'border-[#10b981]',
          text: 'text-[#10b981]',
        };
      default:
        return {
          bg: 'bg-[#ffb3ad]/15',
          border: 'border-[#ffb3ad]',
          text: 'text-[#ffb3ad]',
        };
    }
  };

  const badgeStyle = getStatusBadgeStyle(incident.status);

  const handleShare = () => {
    const text = `Incêndio em ${incident.title} (${incident.locationName}) - Status: ${incident.status} - Operacionais: ${incident.operacionais}`;
    if (navigator.share) {
      navigator.share({ title: incident.title, text: text, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text + ' ' + window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <aside className="w-full md:w-[460px] h-full bg-[#16191C] border-l border-[#5c403d]/40 flex flex-col absolute md:relative right-0 top-0 bottom-0 z-30 shadow-[-8px_0_24px_rgba(0,0,0,0.6)] transform translate-x-0 transition-all duration-300">
      {/* Mobile Handle (drag indicator on mobile) */}
      <div className="md:hidden w-full flex justify-center pt-2 pb-1 bg-[#16191C]">
        <div className="w-8 h-1 bg-[#2D3034] rounded-full" />
      </div>

      {/* Panel Header */}
      <header className="p-4 border-b border-[#333536] flex flex-col gap-2 shrink-0 bg-[#16191C]">
        <div className="flex justify-between items-start">
          {/* Status Pill */}
          <div className={`inline-flex items-center px-2 py-1 rounded border ${badgeStyle.border} ${badgeStyle.bg}`}>
            <span className={`${badgeStyle.text} font-['Inter'] text-[12px] font-semibold uppercase tracking-wider`}>
              {incident.status}
            </span>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel"
            className="p-1 text-[#e5bdb9] hover:text-[#e2e2e3] hover:bg-[#333536] rounded transition-colors"
          >
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div>
          <h1 className="font-['Inter'] text-[28px] font-semibold text-[#e2e2e3] leading-tight">
            {incident.locationName || incident.title}
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
          <div className="flex flex-col p-3 border-r border-[#333536]">
            <span className="font-['Inter'] text-[32px] font-bold text-[#e2e2e3] tabular-nums leading-none">
              {incident.operacionais}
            </span>
            <span className="font-['Inter'] text-[11px] font-semibold text-[#e5bdb9] uppercase tracking-wider mt-2">
              Operacionais
            </span>
          </div>
          <div className="flex flex-col p-3 border-r border-[#333536]">
            <span className="font-['Inter'] text-[32px] font-bold text-[#e2e2e3] tabular-nums leading-none">
              {incident.veiculos}
            </span>
            <span className="font-['Inter'] text-[11px] font-semibold text-[#e5bdb9] uppercase tracking-wider mt-2">
              Veículos
            </span>
          </div>
          <div className="flex flex-col p-3">
            <span className="font-['Inter'] text-[32px] font-bold text-[#e2e2e3] tabular-nums leading-none">
              {incident.meiosAereos}
            </span>
            <span className="font-['Inter'] text-[11px] font-semibold text-[#e5bdb9] uppercase tracking-wider mt-2">
              Meios Aéreos
            </span>
          </div>
        </section>

        {/* Vertical Timeline: Histórico de Estado */}
        <section>
          <h2 className="font-['Inter'] text-[12px] font-semibold text-[#e5bdb9] uppercase tracking-wider mb-4">
            Histórico de Estado
          </h2>
          <div className="relative pl-6 space-y-5 before:absolute before:inset-y-0 before:left-[11px] before:w-[1px] before:bg-[#333536]">
            {incident.history && incident.history.length > 0 ? (
              incident.history.map((evt, idx) => {
                const isCurrent = evt.isCurrent || idx === 0;
                return (
                  <div key={idx} className="relative">
                    <div
                      className={`absolute left-[-29px] top-1.5 w-[9px] h-[9px] rounded-full border-2 border-[#16191C] ${
                        isCurrent ? badgeStyle.bg.replace('/15', '') : 'bg-[#333536]'
                      }`}
                    />
                    <div className="flex justify-between items-baseline">
                      <span
                        className={`font-['Inter'] text-[15px] ${
                          isCurrent ? `${badgeStyle.text} font-bold` : 'text-[#e2e2e3]'
                        }`}
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
              <div className="text-sm text-[#e5bdb9]">Histórico indisponível</div>
            )}
          </div>
        </section>

        <hr className="border-t border-[#333536]" />

        {/* Área Ardida Estimada */}
        <section>
          <h2 className="font-['Inter'] text-[12px] font-semibold text-[#e5bdb9] uppercase tracking-wider mb-3">
            Área Ardida Estimada
          </h2>
          <div className="mb-2 flex justify-between items-baseline">
            <span className="font-['Inter'] text-[24px] font-semibold text-[#e2e2e3] tabular-nums">
              {incident.burnedAreaHa.toLocaleString()}{' '}
              <span className="font-['Inter'] text-[14px] font-normal text-[#e5bdb9]">ha</span>
            </span>
          </div>

          {/* Stacked Multi-color Bar */}
          <div className="h-4 w-full flex rounded overflow-hidden mb-3 bg-[#121415]">
            <div
              className="bg-[#ffb3ad] h-full"
              style={{ width: `${incident.burnedBreakdown.forestPct}%` }}
              title={`Povoamento florestal (${incident.burnedBreakdown.forestPct}%)`}
            />
            <div
              className="bg-[#0079a1] h-full"
              style={{ width: `${incident.burnedBreakdown.matoPct}%` }}
              title={`Mato (${incident.burnedBreakdown.matoPct}%)`}
            />
            <div
              className="bg-[#ac8885] h-full"
              style={{ width: `${incident.burnedBreakdown.agricolaPct}%` }}
              title={`Agrícola (${incident.burnedBreakdown.agricolaPct}%)`}
            />
          </div>

          {/* Legend */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded bg-[#ffb3ad]" />
              <span className="font-['Inter'] text-[13px] text-[#e5bdb9]">
                Povoamento florestal ({incident.burnedBreakdown.forestPct}%)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded bg-[#0079a1]" />
              <span className="font-['Inter'] text-[13px] text-[#e5bdb9]">
                Mato ({incident.burnedBreakdown.matoPct}%)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded bg-[#ac8885]" />
              <span className="font-['Inter'] text-[13px] text-[#e5bdb9]">
                Agrícola ({incident.burnedBreakdown.agricolaPct}%)
              </span>
            </div>
          </div>
        </section>

        <hr className="border-t border-[#333536]" />

        {/* Detalhes Técnicos */}
        <section>
          <h2 className="font-['Inter'] text-[12px] font-semibold text-[#e5bdb9] uppercase tracking-wider mb-3">
            Detalhes Técnicos
          </h2>
          <ul className="flex flex-col text-[14px]">
            <li className="flex justify-between py-2 border-b border-[#333536]/50">
              <span className="text-[#e5bdb9]">Natureza</span>
              <span className="text-[#e2e2e3] font-medium">{incident.nature}</span>
            </li>
            <li className="flex justify-between py-2 border-b border-[#333536]/50">
              <span className="text-[#e5bdb9]">Altitude Estimada</span>
              <span className="text-[#e2e2e3] font-medium tabular-nums">{incident.altitude} m</span>
            </li>
            <li className="flex justify-between py-2 border-b border-[#333536]/50">
              <span className="text-[#e5bdb9]">Fonte de Alerta</span>
              <span className="text-[#e2e2e3] font-medium">{incident.alertSource}</span>
            </li>
            <li className="flex justify-between py-2 border-b border-[#333536]/50">
              <span className="text-[#e5bdb9]">Início</span>
              <span className="text-[#e2e2e3] font-medium tabular-nums">{incident.startTime}</span>
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
            <span class="material-symbols-outlined text-[18px]">share</span>
            Partilhar
          </button>
          <button
            type="button"
            onClick={() => onFocusOnMap(incident)}
            className="flex-1 py-2.5 px-3 bg-[#282a2b] hover:bg-[#333536] text-[#e2e2e3] font-['Inter'] text-[14px] rounded flex items-center justify-center gap-2 transition-colors border border-[#333536]"
          >
            <span class="material-symbols-outlined text-[18px]">my_location</span>
            Ver no mapa
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
          <span class="material-symbols-outlined text-[18px] material-symbols-filled">
            {incident.isFollowing ? 'notifications_active' : 'notifications'}
          </span>
          {incident.isFollowing ? 'A seguir esta zona' : 'Seguir esta zona'}
        </button>
      </footer>
    </aside>
  );
};
