import { useState, useMemo } from 'react';
import { Incident, ViewTab, MapTileLayer, ViewScope } from './types';
import { useActiveIncidents } from './hooks/useActiveIncidents';
import { useSatelliteDetections } from './hooks/useSatelliteDetections';
import { useWatchZones, useZoneAlerts } from './hooks/useWatchZones';
import { SatelliteLayerControl } from './components/SatelliteLayerControl';
import { SatelliteListView } from './components/SatelliteListView';
import { computeStats, filterByScope } from './lib/scope';
import { InteractiveMap } from './components/InteractiveMap';
import { IncidentListView } from './components/IncidentListView';
import { IncidentDetailPanel } from './components/IncidentDetailPanel';
import { AnalyticsView } from './components/AnalyticsView';
import { WatchZonesView } from './components/WatchZonesView';
import { NavigationShell } from './components/NavigationShell';
import { useI18n } from './i18n/context';

export default function App() {
  const { t, n } = useI18n();

  const {
    incidents: fetchedIncidents,
    reports,
    isLoading,
    isRefreshing,
    error,
    lastUpdatedAt,
    refresh,
  } = useActiveIncidents();

  const { zones: watchZones, addZone, toggleZone, deleteZone } = useWatchZones();

  const [activeTab, setActiveTab] = useState<ViewTab>('dashboard');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [tileLayerType, setTileLayerType] = useState<MapTileLayer>('dark');

  // Search and filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Abonnements « suivre cette zone », conservés en mémoire le temps de la session.
  // Stockés à part des incidents, qui sont remplacés à chaque rafraîchissement.
  const [followedIds, setFollowedIds] = useState<Set<string>>(() => new Set());

  /**
   * Périmètre affiché.
   *
   * Trois périmètres OPÉRATIONNELS — Portugal, Espagne, péninsule — et un
   * périmètre SATELLITE mondial. La séparation tient toujours, mais plus pour la
   * raison qu'elle avait à l'origine : il ne s'agit plus de compenser l'absence
   * de données espagnoles (trois services régionaux les publient bel et bien,
   * voir src/api/spain/), mais de ne pas confondre un sinistre confirmé au sol
   * avec une anomalie thermique vue de l'orbite.
   */
  const [scope, setScope] = useState<ViewScope>('iberia');

  // La couche satellite est le SUJET en mode Monde, et un simple calque
  // facultatif ailleurs (utile pour repérer un départ qu'aucun service n'a
  // encore enregistré). Rien n'est téléchargé tant qu'elle n'est pas demandée.
  const [showSatelliteOverlay, setShowSatelliteOverlay] = useState(false);
  const showSatellite = scope === 'world' || showSatelliteOverlay;
  const { detections, isLoading: isSatelliteLoading } = useSatelliteDetections(showSatellite);

  // Liste mobile : ouverte ou fermée, rien de plus.
  //
  // La maquette prévoyait une bottom sheet à trois hauteurs, jamais câblée (la
  // liste restait en `h-full`, ne laissant aucun pixel à la carte sous `md`).
  // Un premier essai reproduisait ces trois hauteurs par appuis successifs :
  // mécanique invisible, il fallait la deviner. Un interrupteur explicite se
  // comprend sans mode d'emploi. Fermée par défaut, pour que la carte soit
  // la première chose visible sur téléphone.
  const [isListOpen, setIsListOpen] = useState(false);

  const allIncidents = useMemo(
    () => fetchedIncidents.map((inc) => ({ ...inc, isFollowing: followedIds.has(inc.id) })),
    [fetchedIncidents, followedIds]
  );

  // Les alertes portent sur TOUS les incidents, quel que soit le périmètre
  // affiché : une zone de surveillance en Andalousie doit se déclencher même si
  // l'utilisateur regarde le Portugal à l'écran.
  useZoneAlerts(watchZones, allIncidents);

  const incidents = useMemo(() => filterByScope(allIncidents, scope), [allIncidents, scope]);

  /** Totaux du périmètre. Voir `computeStats` pour ce qui s'additionne ou non. */
  const totalStats = useMemo(() => computeStats(incidents), [incidents]);

  /**
   * Chiffres et libellés du bandeau, gouvernés par le périmètre.
   *
   * En mode Monde on ne réutilise SURTOUT PAS les tuiles opérationnelles : on
   * décrit des foyers, une puissance et une couverture, pas des pompiers.
   */
  const satelliteStats = useMemo(() => {
    const strongest = detections.reduce((max, d) => Math.max(max, d.frpMw), 0);
    return {
      activeCount: detections.length,
      personnel: Math.round(strongest),
      vehicles: detections.filter((d) => d.confidence === 'high').length,
      aircraft: new Set(detections.map((d) => d.countryCode).filter(Boolean)).size,
      personnelIsPartial: false,
    };
  }, [detections]);

  const displayedStats = scope === 'world' ? satelliteStats : totalStats;

  const statLabels: [string, string, string, string] =
    scope === 'world'
      ? [
          t('stats.detections'),
          `MW · ${t('stats.strongest')}`,
          t('stats.highConfidence'),
          t('stats.countriesAffected'),
        ]
      : [
          t('stats.activeOccurrences'),
          t('stats.personnel'),
          t('stats.vehicles'),
          t('stats.aircraft'),
        ];

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
            {t('error.retry')}
          </button>
        </div>
      )}

      {/* Navigation Shell (Desktop top stats & Mobile bottom tabs) */}
      <NavigationShell
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        totalStats={displayedStats}
        scope={scope}
        onChangeScope={setScope}
        statLabels={statLabels}
        lastUpdatedAt={lastUpdatedAt}
        isRefreshing={isRefreshing}
        onRefresh={refresh}
        reports={reports}
      />

      {/* Main View Container */}
      <main className="flex-1 relative w-full h-full flex flex-col md:flex-row overflow-hidden">
        {/* Premier chargement : la maquette n'avait pas cet état, puisque ses
            données étaient présentes dès le premier rendu. */}
        {isLoading && (
          <div className="absolute inset-0 z-[600] flex flex-col items-center justify-center gap-3 bg-[#121415] text-[#e5bdb9]">
            <span className="material-symbols-outlined text-[32px] animate-spin">progress_activity</span>
            <span className="text-sm">{t('loading.incidents')}</span>
          </div>
        )}

        {/* TAB 1: DASHBOARD / LIVE MAP */}
        {activeTab === 'dashboard' && (
          <div className="flex-1 relative w-full h-full md:flex md:flex-row overflow-hidden">
            {/* Liste : elle décrit CE QUE le périmètre contient. En mode Monde,
                réutiliser les lignes opérationnelles aurait rempli la colonne de
                « 0 opérationnel », ce qui serait faux. */}
            {scope === 'world' ? (
              <SatelliteListView
                detections={detections}
                isLoading={isSatelliteLoading}
                isOpen={isListOpen}
                onClose={() => setIsListOpen(false)}
              />
            ) : (
            <IncidentListView
              incidents={incidents}
              selectedIncidentId={selectedIncidentId}
              onSelectIncident={handleSelectIncident}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              totalStats={totalStats}
              isOpen={isListOpen}
              onClose={() => setIsListOpen(false)}
            />
            )}

            {/* Carte. Sur mobile elle occupe tout le cadre et la liste flotte
                au-dessus ; sur desktop elle redevient un enfant flex.
                `relative` dans les deux cas : les commandes posées dessus se
                positionnent par rapport à la CARTE, et non par rapport à la
                fenêtre — sans quoi elles chevauchent le panneau de détail. */}
            <div className="absolute inset-0 md:relative md:inset-auto md:flex-1 md:h-full z-0">
              <InteractiveMap
                incidents={incidents}
                watchZones={watchZones}
                selectedIncidentId={selectedIncidentId}
                onSelectIncident={handleSelectIncident}
                tileLayerType={tileLayerType}
                onChangeTileLayer={setTileLayerType}
                satelliteDetections={detections}
                showSatellite={showSatellite}
                scope={scope}
                className="w-full h-full"
              />

              {/* En mode Monde, la liste porte déjà le titre, le compteur et
                  l'avertissement : l'encart ferait doublon. Il ne sert que de
                  calque facultatif sur les périmètres opérationnels. */}
              {scope !== 'world' && (
              <SatelliteLayerControl
                isOn={showSatellite}
                onToggle={() => setShowSatelliteOverlay((on) => !on)}
                isLoading={isSatelliteLoading}
                detectionCount={detections.length}
              />
              )}
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
                  {scope === 'world'
                    ? t('list.openDetections', { count: n(detections.length) })
                    : t('list.open', { count: incidents.length })}
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
            incidents={allIncidents}
            onAddWatchZone={addZone}
            onToggleWatchZone={toggleZone}
            onDeleteWatchZone={deleteZone}
            tileLayerType={tileLayerType}
            onChangeTileLayer={setTileLayerType}
          />
        )}
      </main>
    </div>
  );
}
