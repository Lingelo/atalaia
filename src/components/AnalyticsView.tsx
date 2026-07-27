import React, { useState } from 'react';
import {
  MONTHLY_HISTORICAL_STATS,
  TOP_MUNICIPALITIES,
  NOTABLE_HISTORICAL_RECORDS,
  DISTRICT_INTENSITY,
} from '../data/mockData';

export const AnalyticsView: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [districtFilter, setDistrictFilter] = useState<string>('Todos');
  const [natureFilter, setNatureFilter] = useState<string>('Florestal');
  const [metricTab, setMetricTab] = useState<'occurrences' | 'burned' | 'assets'>('occurrences');
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

  const districtsList = ['Todos', 'Faro', 'Viseu', 'Castelo Branco', 'Guarda', 'Coimbra', 'Vila Real', 'Porto', 'Santarém'];
  const naturesList = ['Todos', 'Florestal', 'Mato', 'Agrícola'];

  return (
    <div className="flex-grow p-4 md:p-8 flex flex-col gap-6 w-full max-w-[1440px] mx-auto overflow-y-auto">
      {/* Page Title & Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-[#333536]">
        <div>
          <h2 className="font-['Inter'] text-[28px] font-semibold text-[#e2e2e3]">Histórico</h2>
          <p className="font-['Inter'] text-[14px] text-[#e5bdb9]">Archived incidents since 2018</p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-stretch sm:items-end">
          {/* Year Range Slider */}
          <div className="flex flex-col gap-1 min-w-[180px]">
            <div className="flex justify-between text-[12px] font-semibold text-[#e5bdb9]">
              <span>2018</span>
              <span className="text-[#ffb3ad] font-bold">{selectedYear}</span>
              <span>2026</span>
            </div>
            <input
              type="range"
              min="2018"
              max="2026"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full accent-[#ffb3ad] cursor-pointer"
            />
          </div>

          {/* District Filter */}
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-[12px] font-semibold text-[#e5bdb9] uppercase tracking-wider">Distrito</label>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="bg-[#1e2021] text-[#e2e2e3] border border-[#333536] rounded px-3 py-2 text-[14px] focus:outline-none focus:border-[#ffb3ad]"
            >
              {districtsList.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Nature Filter */}
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-[12px] font-semibold text-[#e5bdb9] uppercase tracking-wider">Natureza</label>
            <select
              value={natureFilter}
              onChange={(e) => setNatureFilter(e.target.value)}
              className="bg-[#1e2021] text-[#e2e2e3] border border-[#333536] rounded px-3 py-2 text-[14px] focus:outline-none focus:border-[#ffb3ad]"
            >
              {naturesList.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {/* Segmented Control Track */}
          <div className="bg-[#1a1c1d] border border-[#333536] rounded p-0.5 flex text-[12px] font-semibold">
            <button
              type="button"
              onClick={() => setMetricTab('occurrences')}
              className={`px-3 py-2 rounded transition-colors ${
                metricTab === 'occurrences' ? 'bg-[#e2e2e3] text-[#121415] font-bold' : 'text-[#e5bdb9] hover:bg-[#1e2021]'
              }`}
            >
              Ocorrências
            </button>
            <button
              type="button"
              onClick={() => setMetricTab('burned')}
              className={`px-3 py-2 rounded transition-colors ${
                metricTab === 'burned' ? 'bg-[#e2e2e3] text-[#121415] font-bold' : 'text-[#e5bdb9] hover:bg-[#1e2021]'
              }`}
            >
              Área ardida
            </button>
            <button
              type="button"
              onClick={() => setMetricTab('assets')}
              className={`px-3 py-2 rounded transition-colors ${
                metricTab === 'assets' ? 'bg-[#e2e2e3] text-[#121415] font-bold' : 'text-[#e5bdb9] hover:bg-[#1e2021]'
              }`}
            >
              Meios
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Grid Container */}
      <div className="grid grid-cols-12 gap-[1px] bg-[#333536] border border-[#333536] rounded overflow-hidden">
        {/* Row 1: Stat Tiles */}
        <div className="bg-[#121415] col-span-12 sm:col-span-6 lg:col-span-3 p-5 flex flex-col justify-center">
          <span className="text-[12px] font-semibold text-[#e5bdb9] uppercase tracking-widest mb-2">
            Total Ocorrências
          </span>
          <span className="text-[40px] font-bold text-[#e2e2e3] tabular-nums leading-none">64,201</span>
          <span className="text-[14px] text-[#ffb3ad] font-medium mt-2">2018–2024</span>
        </div>

        <div className="bg-[#121415] col-span-12 sm:col-span-6 lg:col-span-3 p-5 flex flex-col justify-center">
          <span className="text-[12px] font-semibold text-[#e5bdb9] uppercase tracking-widest mb-2">
            Área Ardida (ha)
          </span>
          <span className="text-[40px] font-bold text-[#e2e2e3] tabular-nums leading-none">1.2M</span>
          <span className="text-[14px] text-[#e5bdb9] mt-2">Acumulado</span>
        </div>

        <div className="bg-[#121415] col-span-12 sm:col-span-6 lg:col-span-3 p-5 flex flex-col justify-center">
          <span className="text-[12px] font-semibold text-[#e5bdb9] uppercase tracking-widest mb-2">
            Média Diária
          </span>
          <span className="text-[40px] font-bold text-[#e2e2e3] tabular-nums leading-none">32</span>
          <span className="text-[14px] text-[#e5bdb9] mt-2">Período crítico (Jul-Set)</span>
        </div>

        <div className="bg-[#121415] col-span-12 sm:col-span-6 lg:col-span-3 p-5 flex flex-col justify-center">
          <span className="text-[12px] font-semibold text-[#e5bdb9] uppercase tracking-widest mb-2">
            Maior Ocorrência
          </span>
          <span className="text-[20px] font-semibold text-[#e2e2e3] truncate">Serra da Estrela</span>
          <span className="text-[14px] text-[#ffb3ad] font-semibold mt-2 tabular-nums">28,000 ha (2022)</span>
        </div>

        {/* Row 2: Charts */}
        {/* Stacked Area / Monthly Chart */}
        <div className="bg-[#121415] col-span-12 lg:col-span-8 p-6 flex flex-col min-h-[380px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[20px] font-semibold text-[#e2e2e3]">
              Ocorrências por Mês (2018-2024)
            </h3>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#ffb3ad] inline-block" />
              <span className="text-[12px] text-[#e5bdb9] font-medium">{selectedYear} (Destacado)</span>
            </div>
          </div>

          {/* SVG Custom Area Chart */}
          <div className="flex-1 relative flex flex-col justify-between pt-4 pb-6">
            {/* Y Axis Grid Lines */}
            <div className="absolute inset-x-0 inset-y-4 flex flex-col justify-between pointer-events-none opacity-20">
              <div className="w-full h-px bg-[#e2e2e3]" />
              <div className="w-full h-px bg-[#e2e2e3]" />
              <div className="w-full h-px bg-[#e2e2e3]" />
              <div className="w-full h-px bg-[#e2e2e3]" />
            </div>

            {/* Interactive SVG Curve */}
            <div className="w-full h-[220px] relative">
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 1000 220">
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffb3ad" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#121415" stopOpacity="0.05" />
                  </linearGradient>
                  <linearGradient id="areaAvgGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7bd1fd" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#121415" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Average background curve */}
                <path
                  d="M 0,200 Q 100,190 200,180 T 400,150 T 600,40 T 750,70 T 900,160 T 1000,200 L 1000,220 L 0,220 Z"
                  fill="url(#areaAvgGrad)"
                />

                {/* Selected Year Curve */}
                <path
                  d="M 0,210 Q 80,200 160,185 T 320,160 T 480,120 T 640,15 T 800,25 T 900,150 T 1000,210 L 1000,220 L 0,220 Z"
                  fill="url(#areaGrad)"
                />
                <path
                  d="M 0,210 Q 80,200 160,185 T 320,160 T 480,120 T 640,15 T 800,25 T 900,150 T 1000,210"
                  fill="none"
                  stroke="#ffb3ad"
                  strokeWidth="3"
                />
              </svg>

              {/* Hover overlay points */}
              <div className="absolute inset-0 flex justify-between items-end px-2 pointer-events-auto">
                {MONTHLY_HISTORICAL_STATS.map((m) => (
                  <div
                    key={m.month}
                    onMouseEnter={() => setHoveredMonth(m.month)}
                    onMouseLeave={() => setHoveredMonth(null)}
                    className="flex-1 h-full flex flex-col justify-end items-center group cursor-pointer relative"
                  >
                    {/* Hover tooltip */}
                    {hoveredMonth === m.month && (
                      <div className="absolute -top-12 z-20 bg-[#1e2021] border border-[#ffb3ad] text-[#e2e2e3] text-xs p-2 rounded shadow-xl whitespace-nowrap text-center">
                        <div className="font-bold text-[#ffb3ad]">{m.month} {selectedYear}</div>
                        <div>Ocorrências: <span className="font-bold">{m.count2024}</span></div>
                        <div>Área: <span className="font-bold">{m.burnedHa} ha</span></div>
                      </div>
                    )}
                    <div className="w-1.5 h-1.5 rounded-full bg-[#ffb3ad] group-hover:scale-150 transition-transform mb-2" />
                  </div>
                ))}
              </div>
            </div>

            {/* X Axis Labels */}
            <div className="flex justify-between text-[12px] text-[#e5bdb9] font-medium pt-2 border-t border-[#333536]">
              {MONTHLY_HISTORICAL_STATS.map((m) => (
                <span key={m.month} className="text-center flex-1">
                  {m.month}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* District Intensity Choropleth Card */}
        <div className="bg-[#121415] col-span-12 lg:col-span-4 p-6 flex flex-col min-h-[380px]">
          <h3 className="text-[20px] font-semibold text-[#e2e2e3] mb-4">Intensidade por Distrito</h3>

          <div className="flex-1 relative bg-[#0c0e0f] rounded border border-[#333536] overflow-hidden flex flex-col justify-between p-4">
            <div className="space-y-2.5 overflow-y-auto max-h-[260px] pr-1">
              {DISTRICT_INTENSITY.map((d) => (
                <div
                  key={d.district}
                  className="flex items-center justify-between p-2 rounded bg-[#16191C] border border-[#333536] hover:border-[#ffb3ad] transition-colors"
                >
                  <div>
                    <div className="text-[14px] font-semibold text-[#e2e2e3]">{d.district}</div>
                    <div className="text-[12px] text-[#e5bdb9]">{d.incidentsCount.toLocaleString()} registos</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-[#ffb3ad] tabular-nums">
                      {(d.burnedHa / 1000).toFixed(1)}k ha
                    </span>
                    <div
                      className={`w-3 h-3 rounded-full ${
                        d.riskLevel === 4
                          ? 'bg-[#ef4444]'
                          : d.riskLevel === 3
                          ? 'bg-[#fbbf24]'
                          : d.riskLevel === 2
                          ? 'bg-[#0079a1]'
                          : 'bg-[#ac8885]'
                      }`}
                      title={`Nível de Risco: ${d.riskLevel}`}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Color Ramp Legend */}
            <div className="mt-4 pt-3 border-t border-[#333536] flex items-center justify-between text-xs">
              <span className="text-[#e5bdb9]">Risco Acumulado</span>
              <div className="flex w-32 h-2.5 rounded overflow-hidden">
                <div className="flex-1 bg-[#ac8885]" title="Baixo" />
                <div className="flex-1 bg-[#0079a1]" title="Moderado" />
                <div className="flex-1 bg-[#fbbf24]" title="Alto" />
                <div className="flex-1 bg-[#ef4444]" title="Extremo" />
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Horizontal Bar Chart & Details List */}
        {/* Top Municipalities Bar Chart */}
        <div className="bg-[#121415] col-span-12 lg:col-span-6 p-6 flex flex-col">
          <h3 className="text-[20px] font-semibold text-[#e2e2e3] mb-4">
            Top 10 Municípios (Área Ardida)
          </h3>
          <div className="flex flex-col gap-3">
            {TOP_MUNICIPALITIES.map((m, idx) => (
              <div key={m.name} className="flex items-center gap-3">
                <span className="w-28 text-right text-[12px] font-semibold text-[#e5bdb9] truncate">
                  {m.name}
                </span>
                <div className="flex-1 h-4 bg-[#1e2021] rounded-r overflow-hidden border border-[#333536]">
                  <div
                    className={`h-full ${idx === 0 ? 'bg-[#ffb3ad]' : 'bg-[#ac8885]'}`}
                    style={{ width: `${m.percentage}%` }}
                  />
                </div>
                <span className="w-16 text-right text-[13px] font-semibold text-[#e2e2e3] tabular-nums">
                  {(m.ha / 1000).toFixed(1)}k
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-3 border-t border-[#333536] flex justify-between text-[12px] text-[#e5bdb9]">
            <span>Município</span>
            <span>Hectares (ha)</span>
          </div>
        </div>

        {/* Notable Incidents Records */}
        <div className="bg-[#121415] col-span-12 lg:col-span-6 p-6 flex flex-col">
          <h3 className="text-[20px] font-semibold text-[#e2e2e3] mb-4">
            Ocorrências Notáveis (Registos)
          </h3>

          <div className="flex flex-col divide-y divide-[#333536]">
            {/* Header */}
            <div className="flex items-center py-2 text-[12px] font-semibold text-[#e5bdb9] uppercase tracking-wider">
              <div className="w-4 mr-3" />
              <div className="flex-1">Localização</div>
              <div className="w-20 text-right">Ano</div>
              <div className="w-28 text-right">Área (ha)</div>
            </div>

            {/* Rows */}
            {NOTABLE_HISTORICAL_RECORDS.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center py-3.5 hover:bg-[#1e2021] transition-colors cursor-pointer rounded px-1"
              >
                <div
                  className={`w-1 h-8 rounded mr-3 shrink-0 ${
                    rec.statusColor === 'primary'
                      ? 'bg-[#ffb3ad]'
                      : rec.statusColor === 'tertiary'
                      ? 'bg-[#7bd1fd]'
                      : 'bg-[#ac8885]'
                  }`}
                />
                <div className="flex-1 min-w-0 pr-2">
                  <div className="text-[16px] font-semibold text-[#e2e2e3] truncate">{rec.name}</div>
                  <div className="text-[13px] text-[#e5bdb9] truncate">{rec.location}</div>
                </div>
                <div className="w-20 text-right text-[14px] text-[#e5bdb9] tabular-nums">{rec.year}</div>
                <div className="w-28 text-right text-[16px] font-bold text-[#e2e2e3] tabular-nums">
                  {rec.ha.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
