import React, { useState, useEffect, useMemo } from 'react';
import { Incident, WatchZone, ViewTab, MapTileLayer } from './types';
import { INITIAL_INCIDENTS, INITIAL_WATCH_ZONES } from './data/mockData';
import { InteractiveMap } from './components/InteractiveMap';
import { IncidentListView } from './components/IncidentListView';
import { IncidentDetailPanel } from './components/IncidentDetailPanel';
import { AnalyticsView } from './components/AnalyticsView';
import { WatchZonesView } from './components/WatchZonesView';
import { NavigationShell } from './components/NavigationShell';

export default function App() {
  const [incidents, setIncidents] = useState<Incident[]>(INITIAL_INCIDENTS);
  const [watchZones, setWatchZones] = useState<WatchZone[]>(INITIAL_WATCH_ZONES);
  const [activeTab, setActiveTab] = useState<ViewTab>('dashboard');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>('inc-1');
  const [tileLayerType, setTileLayerType] = useState<MapTileLayer>('dark');

  // Search and filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Simulation state
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [liveToastAlert, setLiveToastAlert] = useState<string | null>(null);

  // Mobile Bottom Sheet state
  const [isMobileSheetExpanded, setIsMobileSheetExpanded] = useState<boolean>(false);

  // Computed total stats across all incidents
  const totalStats = useMemo(() => {
    let activeCount = 0;
    let operacionais = 0;
    let veiculos = 0;
    let meiosAereos = 0;

    incidents.forEach((inc) => {
      if (inc.status === 'Em Curso' || inc.status === 'Em Resolução') {
        activeCount += 1;
      }
      operacionais += inc.operacionais;
      veiculos += inc.veiculos;
      meiosAereos += inc.meiosAereos;
    });

    return { activeCount, operacionais, veiculos, meiosAereos };
  }, [incidents]);

  // Selected incident object
  const selectedIncident = useMemo(() => {
    return incidents.find((i) => i.id === selectedIncidentId) || null;
  }, [incidents, selectedIncidentId]);

  // Handle live simulation
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      setIncidents((prev) =>
        prev.map((inc) => {
          if (inc.status === 'Em Curso' || inc.status === 'Em Resolução') {
            const deltaOps = Math.floor(Math.random() * 7) - 3;
            const deltaVeic = Math.floor(Math.random() * 3) - 1;
            const newOps = Math.max(2, inc.operacionais + deltaOps);
            const newVeic = Math.max(1, inc.veiculos + deltaVeic);

            return {
              ...inc,
              operacionais: newOps,
              veiculos: newVeic,
            };
          }
          return inc;
        })
      );

      // 30% chance to show live notification toast
      if (Math.random() < 0.3) {
        const randomInc = incidents[Math.floor(Math.random() * incidents.length)];
        setLiveToastAlert(
          `ALERTA TEMPO REAL: Atualização do Teatro de Operações em ${randomInc.title} (${randomInc.operacionais} operacionais em ação)`
        );
        setTimeout(() => setLiveToastAlert(null), 4000);
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [isSimulating, incidents]);

  // Event Handlers
  const handleSelectIncident = (incident: Incident) => {
    setSelectedIncidentId(incident.id);
  };

  const handleToggleFollow = (incidentId: string) => {
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === incidentId ? { ...inc, isFollowing: !inc.isFollowing } : inc))
    );
  };

  const handleAddWatchZone = (newZone: Omit<WatchZone, 'id'>) => {
    const created: WatchZone = {
      ...newZone,
      id: `zone-${Date.now()}`,
    };
    setWatchZones((prev) => [created, ...prev]);
  };

  const handleToggleWatchZone = (id: string) => {
    setWatchZones((prev) =>
      prev.map((z) => (z.id === id ? { ...z, active: !z.active } : z))
    );
  };

  const handleDeleteWatchZone = (id: string) => {
    setWatchZones((prev) => prev.filter((z) => z.id !== id));
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#121415] text-[#e2e2e3] flex flex-col relative font-['Inter',sans-serif]">
      {/* Toast Alert for Live Events */}
      {liveToastAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] bg-[#d8262c] text-white px-4 py-2.5 rounded shadow-2xl border border-white/20 text-sm font-semibold flex items-center gap-2 animate-bounce">
          <span class="material-symbols-outlined text-[20px] material-symbols-filled">
            notifications_active
          </span>
          <span>{liveToastAlert}</span>
        </div>
      )}

      {/* Navigation Shell (Desktop top stats & Mobile bottom tabs) */}
      <NavigationShell
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        totalStats={totalStats}
        onSimulateUpdate={() => setIsSimulating(!isSimulating)}
        isSimulating={isSimulating}
      />

      {/* Main View Container */}
      <main className="flex-1 relative w-full h-full flex flex-col md:flex-row overflow-hidden">
        {/* TAB 1: DASHBOARD / LIVE MAP */}
        {activeTab === 'dashboard' && (
          <div className="flex-1 relative w-full h-full flex flex-col md:flex-row overflow-hidden">
            {/* Left Sidebar (Incident List) */}
            <IncidentListView
              incidents={incidents}
              selectedIncidentId={selectedIncidentId}
              onSelectIncident={handleSelectIncident}
              activeTab={activeTab}
              onChangeTab={setActiveTab}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              totalStats={totalStats}
            />

            {/* Central Map Canvas Layer */}
            <div className="flex-1 h-full relative z-0">
              <InteractiveMap
                incidents={incidents}
                watchZones={watchZones}
                selectedIncidentId={selectedIncidentId}
                onSelectIncident={handleSelectIncident}
                tileLayerType={tileLayerType}
                onChangeTileLayer={setTileLayerType}
                className="w-full h-full"
              />
            </div>

            {/* Right Sliding Detail Panel (Opens when an incident is selected) */}
            {selectedIncident && (
              <IncidentDetailPanel
                incident={selectedIncident}
                onClose={() => setSelectedIncidentId(null)}
                onFocusOnMap={handleSelectIncident}
                onToggleFollow={handleToggleFollow}
              />
            )}
          </div>
        )}

        {/* TAB 2: ANALYTICS / HISTÓRICO */}
        {activeTab === 'analytics' && <AnalyticsView />}

        {/* TAB 3: WATCH ZONES & ALERTS */}
        {activeTab === 'watch-zones' && (
          <WatchZonesView
            watchZones={watchZones}
            onAddWatchZone={handleAddWatchZone}
            onToggleWatchZone={handleToggleWatchZone}
            onDeleteWatchZone={handleDeleteWatchZone}
            tileLayerType={tileLayerType}
            onChangeTileLayer={setTileLayerType}
          />
        )}
      </main>
    </div>
  );
}
