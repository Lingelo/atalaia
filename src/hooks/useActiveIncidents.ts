import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchOperationalIncidents } from '../api/incidents.ts';
import type { SourceReport } from '../api/spain/index.ts';
import type { Incident } from '../types';

/**
 * Intervalle de rafraîchissement.
 *
 * Aligné sur le TTL du proxy (60 s) : rafraîchir plus vite ne ferait que
 * resservir le même cache, en agitant l'interface pour rien.
 */
const REFRESH_MS = 60_000;

export interface ActiveIncidentsState {
  incidents: Incident[];
  /** État de chacun des quatre services interrogés. Voir `SourceReport`. */
  reports: SourceReport[];
  /** Vrai uniquement pendant le tout premier chargement, quand il n'y a rien à afficher. */
  isLoading: boolean;
  /** Vrai pendant un rechargement alors que des données sont déjà à l'écran. */
  isRefreshing: boolean;
  error: string | null;
  lastUpdatedAt: number | null;
  refresh: () => void;
}

export function useActiveIncidents(): ActiveIncidentsState {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [reports, setReports] = useState<SourceReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  // Permet d'annuler une requête encore en vol quand une nouvelle démarre : sans
  // ça, une réponse lente arrivant après une réponse rapide écraserait la plus
  // récente avec des données périmées.
  const controllerRef = useRef<AbortController | null>(null);
  const hasDataRef = useRef(false);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    if (hasDataRef.current) setIsRefreshing(true);

    try {
      const next = await fetchOperationalIncidents(controller.signal);
      setIncidents(next.incidents);
      setReports(next.reports);
      // Date de PRODUCTION de la donnée, pas du téléchargement : sur un site
      // statique elle peut avoir une demi-heure, et l'utilisateur doit le voir.
      setLastUpdatedAt(next.generatedAt);
      setError(null);
      hasDataRef.current = true;
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;

      // On garde les incidents déjà affichés : sur une carte de sécurité publique,
      // une donnée d'il y a deux minutes vaut mieux qu'un écran vide.
      setError(cause instanceof Error ? cause.message : 'Erro desconhecido.');
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);

    return () => {
      clearInterval(timer);
      controllerRef.current?.abort();
    };
  }, [load]);

  return {
    incidents,
    reports,
    isLoading,
    isRefreshing,
    error,
    lastUpdatedAt,
    refresh: () => void load(),
  };
}
