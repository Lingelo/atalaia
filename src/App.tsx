import { useCallback, useState, useMemo } from 'react';
import { Icon } from './components/Icon';
import { Incident, ViewTab, MapTileLayer, ViewScope } from './types';
import { useActiveIncidents } from './hooks/useActiveIncidents';
import { useSatelliteDetections } from './hooks/useSatelliteDetections';
import { useWatchZones, useZoneAlerts } from './hooks/useWatchZones';
import { SatelliteLayerControl } from './components/SatelliteLayerControl';
import { computeStats, filterByScope } from './lib/scope';
import { DEFAULT_FILTERS, filterIncidents, hasActiveFilters, type ChipFilter } from './lib/filters';
import { MobileControls } from './components/MobileControls';
import { resolvePhase } from './lib/status';
import { InteractiveMap } from './components/InteractiveMap';
import { IncidentListView } from './components/IncidentListView';
import { IncidentDetailPanel } from './components/IncidentDetailPanel';
import { WatchZonesView } from './components/WatchZonesView';
import { NavigationShell } from './components/NavigationShell';
import { useI18n } from './i18n/context';
import type { TranslationKey } from './i18n/pt';

export default function App() {
  const { t } = useI18n();

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
  // Fond topographique par défaut : le relief explique où le feu peut aller —
  // une crête, une vallée, une pente — là où un fond neutre ne montre que sa
  // position. Voir `index.css` pour le traitement qui le fait RECULER derrière
  // les marqueurs : brut, OpenTopoMap est un fond clair et chargé qui rivalise
  // avec eux au lieu de les porter.
  const [tileLayerType, setTileLayerType] = useState<MapTileLayer>('terrain');

  // Search and filters
  //
  // Ces trois états vivent ICI, et non dans la liste, parce qu'ils gouvernent
  // désormais les DEUX vues. Le filtre rapide mobile y a été remonté : tant
  // qu'il restait interne à la liste, la carte ne pouvait pas en tenir compte.
  const [searchTerm, setSearchTerm] = useState<string>(DEFAULT_FILTERS.searchTerm);
  const [statusFilter, setStatusFilter] = useState<string>(DEFAULT_FILTERS.statusFilter);
  const [chipFilter, setChipFilter] = useState<ChipFilter>(DEFAULT_FILTERS.chipFilter);

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
   *
   * Un périmètre France a été essayé puis retiré, faute de source. Voir
   * `ViewScope`, qui en garde la raison.
   */
  const [scope, setScope] = useState<ViewScope>('iberia');

  // La couche satellite est le SUJET en mode Monde, et un simple calque
  // facultatif ailleurs (utile pour repérer un départ qu'aucun service n'a
  // encore enregistré). Rien n'est téléchargé tant qu'elle n'est pas demandée.
  const [showSatelliteOverlay, setShowSatelliteOverlay] = useState(false);
  const showSatellite = showSatelliteOverlay;
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

  /**
   * Colonne repliée, sur desktop uniquement.
   *
   * Séparé de `isListOpen` : replier la colonne pour rendre de la largeur à la
   * carte n'est pas le même geste que fermer la feuille du bas d'un téléphone.
   * Un seul état pour les deux ferait disparaître la liste sur mobile dès qu'on
   * l'aurait repliée sur écran large.
   */
  const [isListCollapsed, setIsListCollapsed] = useState(false);

  const allIncidents = useMemo(
    () => fetchedIncidents.map((inc) => ({ ...inc, isFollowing: followedIds.has(inc.id) })),
    [fetchedIncidents, followedIds]
  );

  // Les alertes portent sur TOUS les incidents, quel que soit le périmètre
  // affiché : une zone de surveillance en Andalousie doit se déclencher même si
  // l'utilisateur regarde le Portugal à l'écran.
  const formatIncidentStatus = useCallback(
    (incident: Incident) => t(`phase.${incident.phase}` as TranslationKey),
    [t]
  );
  useZoneAlerts(watchZones, allIncidents, formatIncidentStatus);

  const incidents = useMemo(() => filterByScope(allIncidents, scope), [allIncidents, scope]);

  /**
   * Ce que la carte ET la liste affichent : le périmètre, restreint par les
   * filtres. Un seul tableau pour les deux, pour qu'ils ne puissent plus se
   * contredire — voir `src/lib/filters.ts`.
   */
  const filters = useMemo(
    () => ({ searchTerm, statusFilter, chipFilter }),
    [searchTerm, statusFilter, chipFilter]
  );
  const visibleIncidents = useMemo(
    () => filterIncidents(incidents, filters),
    [incidents, filters]
  );

  /**
   * Phases proposées au filtre, dérivées du PÉRIMÈTRE et non des incidents déjà
   * filtrés : sinon les options s'évaporent à mesure qu'on s'en sert, et le
   * dernier choix restant devient une impasse.
   */
  const availablePhases = useMemo(
    () =>
      Array.from(new Set(incidents.map((inc) => inc.phase))).sort(
        (a, b) => resolvePhase(b).severity - resolvePhase(a).severity
      ),
    [incidents]
  );

  const isFiltered = useMemo(() => hasActiveFilters(filters), [filters]);

  /**
   * Totaux du périmètre. Voir `computeStats` pour ce qui s'additionne ou non.
   *
   * ⚠️ Calculés sur le périmètre ENTIER, jamais sur le sous-ensemble filtré. Le
   * bandeau annonce « sinistres en cours » pour un territoire ; le faire varier
   * au gré d'une recherche laisserait croire que des feux s'éteignent quand on
   * tape dans un champ de texte.
   */
  const totalStats = useMemo(() => computeStats(incidents), [incidents]);

  const statLabels: [string, string, string, string] = [
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
    /*
      ⚠️ `h-dvh`, et surtout PAS `h-screen`.

      `h-screen` vaut `100vh`, et sur mobile `100vh` désigne le GRAND viewport :
      la hauteur qu'aurait la page si la barre d'URL était rétractée. Tant
      qu'elle est affichée — c'est-à-dire presque tout le temps sur une page
      qui ne défile pas — la boîte dépasse l'écran par le bas d'exactement sa
      hauteur.

      La panne qui en découlait était trompeuse, parce qu'elle ne touchait PAS
      tout le monde de la même façon : la barre d'onglets est `fixed`, donc
      ancrée au viewport visible, et restait à sa place ; les commandes de la
      carte sont `absolute` dans cette boîte trop haute, et passaient sous
      l'écran. Le bouton des calques disparaissait, la géolocalisation était
      rognée. Et `overflow-hidden` interdisant de défiler, rien ne permettait
      d'aller les chercher : l'écran semblait simplement amputé.

      `dvh` suit la hauteur réellement visible, si bien que les deux ancrages
      se retrouvent d'accord. Invisible en émulation de navigateur, qui ne
      simule pas la barre d'URL rétractable : cette panne ne se voit que sur un
      vrai téléphone.
    */
    <div className="h-dvh w-full overflow-hidden bg-[#121415] text-[#e2e2e3] flex flex-col relative font-['Inter',sans-serif]">
      {/* Bandeau d'erreur. Les incidents déjà chargés restent affichés dessous :
          une donnée un peu ancienne vaut mieux qu'un écran vide. */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] bg-[#7f1d1d] text-white px-4 py-2.5 rounded shadow-2xl border border-white/20 text-sm font-semibold flex items-center gap-2">
          <Icon name="cloud_off" className="text-[20px]" />
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
        totalStats={totalStats}
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
            <Icon name="progress_activity" className="text-[32px] animate-spin" />
            <span className="text-sm">{t('loading.incidents')}</span>
          </div>
        )}

        {/* TAB 1: DASHBOARD / LIVE MAP */}
        {activeTab === 'dashboard' && (
          <div className="flex-1 relative w-full h-full md:flex md:flex-row overflow-hidden">
            {/* Liste : elle décrit CE QUE le périmètre contient — des sinistres
                confirmés, toujours. La couche satellite n'est plus qu'un calque
                sur la carte : elle n'a plus de liste propre depuis le retrait du
                mode Monde. */}
            <IncidentListView
              incidents={visibleIncidents}
              selectedIncidentId={selectedIncidentId}
              onSelectIncident={handleSelectIncident}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              totalStats={totalStats}
              isOpen={isListOpen}
              onClose={() => setIsListOpen(false)}
              isCollapsed={isListCollapsed}
            />

            {/* Carte. Sur mobile elle occupe tout le cadre et la liste flotte
                au-dessus ; sur desktop elle redevient un enfant flex.
                `relative` dans les deux cas : les commandes posées dessus se
                positionnent par rapport à la CARTE, et non par rapport à la
                fenêtre — sans quoi elles chevauchent le panneau de détail. */}
            <div className="absolute inset-0 md:relative md:inset-auto md:flex-1 md:h-full z-0">
              {/* Poignée de repli, desktop uniquement. Elle reste ANCRÉE au bord
                  gauche de la carte dans les deux états : c'est le même bouton
                  qui referme et rouvre, au même endroit. Un bouton qui se
                  déplacerait avec la colonne obligerait à le chercher. */}
              <button
                type="button"
                onClick={() => setIsListCollapsed((collapsed) => !collapsed)}
                title={t(isListCollapsed ? 'list.expandPanel' : 'list.collapsePanel')}
                aria-expanded={!isListCollapsed}
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-[400] w-5 h-14 items-center justify-center rounded-r bg-[#16191C] border border-l-0 border-[#2D3034] text-[#e5bdb9] hover:bg-[#282a2b] hover:text-[#e2e2e3] transition-colors shadow-lg"
              >
                <Icon name={isListCollapsed ? 'chevron_right' : 'chevron_left'} className="text-[18px] leading-none" />
              </button>

              <InteractiveMap
                incidents={visibleIncidents}
                watchZones={watchZones}
                selectedIncidentId={selectedIncidentId}
                onSelectIncident={handleSelectIncident}
                tileLayerType={tileLayerType}
                onChangeTileLayer={setTileLayerType}
                satelliteDetections={detections}
                showSatellite={showSatellite}
                scope={scope}
                className="w-full h-full"
                satelliteControl={
                  <SatelliteLayerControl
                    isOn={showSatellite}
                    onToggle={() => setShowSatelliteOverlay((on) => !on)}
                    isLoading={isSatelliteLoading}
                    detectionCount={detections.length}
                  />
                }
              />

              {/* Interrupteur de la liste, mobile uniquement. Masqué quand la
                  liste est ouverte (elle porte alors son propre bouton de
                  fermeture) et quand un incident est sélectionné, pour ne pas
                  flotter au-dessus du panneau de détail.

                  ⚠️ RENDU DANS LE CONTENEUR DE LA CARTE, et non à côté. Il en
                  était frère, et passait alors AU-DESSUS du menu des calques
                  qu'il recouvrait en partie. La comparaison qui tranche n'était
                  pas son `z-30` contre le `z-[400]` du menu, mais son `z-30`
                  contre le `z-0` du conteneur ci-dessus : celui-ci ouvre un
                  contexte d'empilement, dont aucun enfant ne peut sortir quelle
                  que soit sa valeur. Un frère à `z-30` passe donc devant TOUT
                  ce que la carte contient.

                  Ce `z-0` est porteur — c'est lui qui empêche les commandes de
                  la carte de chevaucher le panneau de détail (voir plus haut).
                  On ne le retire donc pas : on fait entrer le bouton dans le
                  même contexte, où `z-30` et `z-[400]` se comparent enfin
                  directement. Sur mobile le conteneur est `absolute inset-0`,
                  soit exactement le cadre précédent : rien ne bouge à l'écran. */}
              {!isListOpen && !selectedIncident && (
                <button
                  type="button"
                  onClick={() => setIsListOpen(true)}
                  className="md:hidden absolute bottom-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 pl-4 pr-5 py-3 rounded-full bg-[#1e2021] border border-[#3a3d3f] text-[#e2e2e3] shadow-xl active:scale-95 transition-transform"
                >
                  <Icon name="list" className="text-[20px] text-[#ffb3ad]" />
                  <span className="font-['Inter'] text-[14px] font-semibold tabular-nums whitespace-nowrap">
                    {t('list.open', { count: visibleIncidents.length })}
                  </span>
                </button>
              )}
            </div>

            {/* Commandes du mobile, posées sur la carte : périmètre, couverture
                des services, fraîcheur et filtres. C'est la contrepartie de
                l'en-tête desktop, qui est `hidden md:flex` — voir `MobileControls`
                pour la raison de leur emplacement. */}
            <MobileControls
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              chipFilter={chipFilter}
              onChipFilterChange={setChipFilter}
              availablePhases={availablePhases}
              visibleCount={visibleIncidents.length}
              isFiltered={isFiltered}
              scope={scope}
              onChangeScope={setScope}
              reports={reports}
              lastUpdatedAt={lastUpdatedAt}
              isRefreshing={isRefreshing}
              onRefresh={refresh}
            />

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

        {/* TAB 2: WATCH ZONES & ALERTS */}
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
