import { useState, useMemo } from 'react';
import { Incident, WatchZone, ViewTab, MapTileLayer } from './types';
import { INITIAL_WATCH_ZONES } from './data/mockData';
import { useActiveIncidents } from './hooks/useActiveIncidents';
import { resolveStatus } from './lib/status';
import { InteractiveMap } from './components/InteractiveMap';
import { IncidentListView } from './components/IncidentListView';
import { IncidentDetailPanel } from './components/IncidentDetailPanel';
import { AnalyticsView } from './components/AnalyticsView';
import { WatchZonesView } from './components/WatchZonesView';
import { NavigationShell } from './components/NavigationShell';

export default function App() {
  const {
    incidents: fetchedIncidents,
    isLoading,
    isRefreshing,
    error,
    lastUpdatedAt,
    refresh,
  } = useActiveIncidents();

  const [watchZones, setWatchZones] = useState<WatchZone[]>(INITIAL_WATCH_ZONES);
  const [activeTab, setActiveTab] = useState<ViewTab>('dashboard');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [tileLayerType, setTileLayerType] = useState<MapTileLayer>('dark');

  // Search and filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Abonnements « suivre cette zone », conservés en mémoire le temps de la session.
  // Stockés à part des incidents, qui sont remplacés à chaque rafraîchissement.
  const [followedIds, setFollowedIds] = useState<Set<string>>(() => new Set());

  // Liste mobile : ouverte ou fermée, rien de plus.
  //
  // La maquette prévoyait une bottom sheet à trois hauteurs, jamais câblée (la
  // liste restait en `h-full`, ne laissant aucun pixel à la carte sous `md`).
  // Un premier essai reproduisait ces trois hauteurs par appuis successifs :
  // mécanique invisible, il fallait la deviner. Un interrupteur explicite se
  // comprend sans mode d'emploi. Fermée par défaut, pour que la carte soit
  // la première chose visible sur téléphone.
  const [isListOpen, setIsListOpen] = useState(false);

  const incidents = useMemo(
    () => fetchedIncidents.map((inc) => ({ ...inc, isFollowing: followedIds.has(inc.id) })),
    [fetchedIncidents, followedIds]
  );

  // Totaux nationaux. « Ativas » s'appuie sur statusCode via le registre, et non
  // sur une comparaison de libellés : un accent ou un statut non prévu fausserait
  // silencieusement le compteur.
  const totalStats = useMemo(() => {
    let activeCount = 0;
    let operacionais = 0;
    let veiculos = 0;
    let meiosAereos = 0;

    incidents.forEach((inc) => {
      if (resolveStatus(inc.statusCode, inc.status).ongoing) activeCount += 1;
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

  // Event Handlers
  const handleSelectIncident = (incident: Incident) => {
    setSelectedIncidentId(incident.id);
  };

  const handleToggleFollow = (incidentId: string) => {
    setFollowedIds((prev) => {
      const next = new Set(prev);
      if (next.has(incidentId)) next.delete(incidentId);
      else next.add(incidentId);
      return next;
    });
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
      {/* Bandeau d'erreur. Les incidents déjà chargés restent affichés dessous :
          une donnée un peu ancienne vaut mieux qu'un écran vide. */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] bg-[#7f1d1d] text-white px-4 py-2.5 rounded shadow-2xl border border-white/20 text-sm font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">cloud_off</span>
          <span>{error}</span>
          <button
            type="button"
            onClick={refresh}
            className="ml-2 underline underline-offset-2 hover:no-underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Navigation Shell (Desktop top stats & Mobile bottom tabs) */}
      <NavigationShell
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        totalStats={totalStats}
        lastUpdatedAt={lastUpdatedAt}
        isRefreshing={isRefreshing}
        onRefresh={refresh}
      />

      {/* Main View Container */}
      <main className="flex-1 relative w-full h-full flex flex-col md:flex-row overflow-hidden">
        {/* Premier chargement : la maquette n'avait pas cet état, puisque ses
            données étaient présentes dès le premier rendu. */}
        {isLoading && (
          <div className="absolute inset-0 z-[600] flex flex-col items-center justify-center gap-3 bg-[#121415] text-[#e5bdb9]">
            <span className="material-symbols-outlined text-[32px] animate-spin">progressbar</span>
            <span className="text-sm">A carregar ocorrências…</span>
          </div>
        )}

        {/* TAB 1: DASHBOARD / LIVE MAP */}
        {activeTab === 'dashboard' && (
          <div className="flex-1 relative w-full h-full md:flex md:flex-row overflow-hidden">
            {/* Liste : bottom sheet flottante sur mobile, barre latérale sur desktop. */}
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
              isOpen={isListOpen}
              onClose={() => setIsListOpen(false)}
            />

            {/* Carte. Sur mobile elle occupe tout le cadre et la liste flotte
                au-dessus ; sur desktop elle redevient un simple enfant flex. */}
            <div className="absolute inset-0 md:static md:flex-1 md:h-full z-0">
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

            {/* Interrupteur de la liste, mobile uniquement. Masqué quand la liste
                est ouverte (elle porte alors son propre bouton de fermeture) et
                quand un incident est sélectionné, pour ne pas flotter au-dessus
                du panneau de détail. */}
            {!isListOpen && !selectedIncident && (
              <button
                type="button"
                onClick={() => setIsListOpen(true)}
                className="md:hidden absolute bottom-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 pl-4 pr-5 py-3 rounded-full bg-[#1e2021] border border-[#3a3d3f] text-[#e2e2e3] shadow-xl active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-[20px] text-[#ffb3ad]">list</span>
                <span className="font-['Inter'] text-[14px] font-semibold tabular-nums whitespace-nowrap">
                  {incidents.length} ocorrências
                </span>
              </button>
            )}

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
