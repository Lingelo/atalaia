import React, { useState } from 'react';
import { Incident, ViewTab } from '../types';

interface IncidentListViewProps {
  incidents: Incident[];
  selectedIncidentId?: string | null;
  onSelectIncident: (incident: Incident) => void;
  activeTab: ViewTab;
  onChangeTab: (tab: ViewTab) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  isMobileSheetExpanded?: boolean;
  onToggleMobileSheet?: () => void;
  totalStats: {
    activeCount: number;
    operacionais: number;
    veiculos: number;
    meiosAereos: number;
  };
}

export const IncidentListView: React.FC<IncidentListViewProps> = ({
  incidents,
  selectedIncidentId,
  onSelectIncident,
  activeTab,
  onChangeTab,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  isMobileSheetExpanded = false,
  onToggleMobileSheet,
  totalStats,
}) => {
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [activeChipFilter, setActiveChipFilter] = useState<string>('all');

  // Status color helper for status bar line
  const getStatusLineColor = (status: Incident['status']) => {
    switch (status) {
      case 'Em Resolução':
        return 'bg-[#fbbf24]'; // Amber
      case 'Em Curso':
        return 'bg-[#ef4444]'; // Red
      case 'Vigilância':
        return 'bg-[#3b82f6]'; // Blue
      case 'Conclusão':
        return 'bg-[#10b981]'; // Green
      default:
        return 'bg-[#ffb3ad]';
    }
  };

  const getStatusBadgeStyle = (status: Incident['status']) => {
    switch (status) {
      case 'Em Resolução':
        return 'border-[#fbbf24] bg-[#fbbf24]/15 text-[#fbbf24]';
      case 'Em Curso':
        return 'border-[#ef4444] bg-[#ef4444]/15 text-[#ef4444]';
      case 'Vigilância':
        return 'border-[#3b82f6] bg-[#3b82f6]/15 text-[#3b82f6]';
      case 'Conclusão':
        return 'border-[#10b981] bg-[#10b981]/15 text-[#10b981]';
      default:
        return 'border-[#ffb3ad] bg-[#ffb3ad]/15 text-[#ffb3ad]';
    }
  };

  // Filter incidents based on search, dropdown, and mobile chip filter
  const filteredIncidents = incidents.filter((inc) => {
    const matchesSearch =
      searchTerm === '' ||
      inc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.locationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.district.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.municipality.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || inc.status === statusFilter;

    let matchesChip = true;
    if (activeChipFilter === '> 100 Ops') {
      matchesChip = inc.operacionais > 100;
    } else if (activeChipFilter === 'Aerial Assets') {
      matchesChip = inc.meiosAereos > 0;
    } else if (activeChipFilter === 'Resolution') {
      matchesChip = inc.status === 'Em Resolução';
    }

    return matchesSearch && matchesStatus && matchesChip;
  });

  return (
    <aside className="w-full md:w-[380px] lg:w-[400px] h-full bg-[#16191C] border-r border-[#2D3034] flex flex-col pointer-events-auto z-20 shrink-0">
      {/* Top Header Bar inside Sidebar */}
      <header className="h-16 flex justify-between items-center px-4 border-b border-[#2D3034] bg-[#1e2021]">
        <div className="flex items-center gap-2">
          <span class="material-symbols-outlined text-[#ffb3ad] text-2xl">menu</span>
          <h1 className="font-['Inter'] text-[20px] font-bold tracking-tight text-[#e2e2e3]">
            FOGO.PT
          </h1>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#333536] transition-colors text-[#e5bdb9]"
            title="Pesquisar / Filtrar"
          >
            <span class="material-symbols-outlined text-[20px]">search</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeTab('watch-zones')}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#333536] transition-colors text-[#e5bdb9]"
            title="Alertas & Zonas"
          >
            <span class="material-symbols-outlined text-[20px]">notifications</span>
          </button>
        </div>
      </header>

      {/* Navigation Tabs (Segmented Control style) */}
      <nav className="flex border-b border-[#2D3034] bg-[#16191C] px-2 pt-2">
        <button
          type="button"
          onClick={() => onChangeTab('dashboard')}
          className={`flex-1 pb-2 border-b-2 font-['Inter'] text-[12px] font-bold uppercase tracking-wider transition-colors ${
            activeTab === 'dashboard'
              ? 'border-[#ffb3ad] text-[#ffb3ad]'
              : 'border-transparent text-[#e5bdb9] hover:text-[#e2e2e3]'
          }`}
        >
          Dashboard
        </button>
        <button
          type="button"
          onClick={() => onChangeTab('analytics')}
          className={`flex-1 pb-2 border-b-2 font-['Inter'] text-[12px] font-bold uppercase tracking-wider transition-colors ${
            activeTab === 'analytics'
              ? 'border-[#ffb3ad] text-[#ffb3ad]'
              : 'border-transparent text-[#e5bdb9] hover:text-[#e2e2e3]'
          }`}
        >
          Analytics
        </button>
        <button
          type="button"
          onClick={() => onChangeTab('watch-zones')}
          className={`flex-1 pb-2 border-b-2 font-['Inter'] text-[12px] font-bold uppercase tracking-wider transition-colors ${
            activeTab === 'watch-zones'
              ? 'border-[#ffb3ad] text-[#ffb3ad]'
              : 'border-transparent text-[#e5bdb9] hover:text-[#e2e2e3]'
          }`}
        >
          Watch Zones
        </button>
      </nav>

      {/* Search Input and Filters Toggle Bar */}
      <div className="p-3 border-b border-[#2D3034] bg-[#16191C] flex flex-col gap-2">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span class="material-symbols-outlined absolute left-2.5 top-2.5 text-[#e5bdb9] text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Pesquisar ocorrência..."
              className="w-full bg-[#1e2021] border border-[#333536] text-[#e2e2e3] pl-9 pr-3 py-1.5 text-xs rounded focus:outline-none focus:border-[#ffb3ad] placeholder:text-[#e5bdb9]/60"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className={`px-3 py-1.5 border rounded text-xs font-semibold flex items-center gap-1 transition-colors ${
              statusFilter !== 'all' || showFilterDropdown
                ? 'bg-[#e2e2e3] text-[#121415] border-white'
                : 'border-[#494c4f] text-[#e5bdb9] hover:bg-[#2D3034]'
            }`}
          >
            <span class="material-symbols-outlined text-[16px]">tune</span>
            Filtros
          </button>
        </div>

        {/* Filter Popup / Options */}
        {showFilterDropdown && (
          <div className="mt-1 p-2 bg-[#1e2021] border border-[#333536] rounded space-y-2 text-xs">
            <div className="flex justify-between items-center text-[#e5bdb9] font-semibold">
              <span>Filtrar por Estado</span>
              {statusFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => onStatusFilterChange('all')}
                  className="text-[#ffb3ad] underline text-[11px]"
                >
                  Limpar
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {['all', 'Em Curso', 'Em Resolução', 'Vigilância', 'Conclusão'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => onStatusFilterChange(st)}
                  className={`px-2 py-1 rounded text-left transition-colors ${
                    statusFilter === st
                      ? 'bg-[#ffb3ad] text-[#680009] font-bold'
                      : 'bg-[#16191C] text-[#e2e2e3] hover:bg-[#282a2b]'
                  }`}
                >
                  {st === 'all' ? 'Todos os estados' : st}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mobile Quick Chips */}
        <div className="md:hidden flex gap-2 overflow-x-auto no-scrollbar pt-1">
          {['all', '> 100 Ops', 'Aerial Assets', 'Resolution'].map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setActiveChipFilter(chip)}
              className={`h-7 px-3 rounded text-xs whitespace-nowrap flex items-center transition-colors ${
                activeChipFilter === chip
                  ? 'bg-[#e2e2e3] text-[#121415] font-bold'
                  : 'bg-transparent border border-[#333536] text-[#e5bdb9]'
              }`}
            >
              {chip === 'all' ? 'Todos' : chip}
            </button>
          ))}
        </div>
      </div>

      {/* Incident List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#2D3034]">
        {filteredIncidents.map((inc) => {
          const isSelected = inc.id === selectedIncidentId;
          const statusLineColor = getStatusLineColor(inc.status);
          const badgeStyle = getStatusBadgeStyle(inc.status);

          return (
            <article
              key={inc.id}
              onClick={() => onSelectIncident(inc)}
              className={`relative pl-4 pr-4 py-3.5 hover:bg-[#1a1c1d] transition-colors cursor-pointer group ${
                isSelected ? 'bg-[#1e2021] border-l-4 border-l-[#ffb3ad]' : ''
              }`}
            >
              {!isSelected && (
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusLineColor}`} />
              )}

              <div className="flex justify-between items-start mb-1.5">
                <div>
                  <h2 className="font-['Inter'] text-[15px] font-semibold text-[#e2e2e3] leading-tight group-hover:text-white">
                    {inc.title}
                  </h2>
                  <p className="font-['Inter'] text-[13px] text-[#e5bdb9] leading-tight">
                    {inc.locationName}
                  </p>
                </div>
                <span className="font-['Inter'] text-[12px] text-[#e5bdb9] tabular-nums shrink-0 ml-2">
                  {inc.timeAgo}
                </span>
              </div>

              <div className="flex items-center gap-2 mb-2.5">
                <div
                  className={`px-2 py-0.5 border rounded text-[10px] font-bold uppercase tracking-wider ${badgeStyle}`}
                >
                  {inc.status}
                </div>
              </div>

              <div className="flex gap-4 text-[13px] tabular-nums text-[#e5bdb9]">
                <div className="flex items-center gap-1" title="Operacionais no terreno">
                  <span class="material-symbols-outlined text-[16px]">group</span>
                  <span className="text-[#e2e2e3] font-semibold">{inc.operacionais}</span>
                </div>
                <div className="flex items-center gap-1" title="Veículos de combate">
                  <span class="material-symbols-outlined text-[16px]">local_fire_department</span>
                  <span className="text-[#e2e2e3] font-semibold">{inc.veiculos}</span>
                </div>
                <div className="flex items-center gap-1" title="Meios Aéreos">
                  <span
                    class={`material-symbols-outlined text-[16px] ${
                      inc.meiosAereos === 0 ? 'opacity-40' : ''
                    }`}
                  >
                    flight
                  </span>
                  <span
                    className={
                      inc.meiosAereos === 0 ? 'opacity-40' : 'text-[#e2e2e3] font-semibold'
                    }
                  >
                    {inc.meiosAereos}
                  </span>
                </div>
              </div>
            </article>
          );
        })}

        {filteredIncidents.length === 0 && (
          <div className="p-8 text-center text-[#e5bdb9] text-sm">
            Nenhuma ocorrência encontrada para os filtros selecionados.
          </div>
        )}
      </div>
    </aside>
  );
};
