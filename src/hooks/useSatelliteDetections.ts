import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchSatelliteDetections } from '../api/firms';
import type { SatelliteDetection } from '../types';

/**
 * Rafraîchissement lent, aligné sur le TTL du proxy FIRMS (30 min).
 *
 * Les satellites repassent toutes les quelques heures : interroger plus souvent
 * ne renverrait que le même cache, au prix de trois fichiers de ~300 Ko.
 */
const REFRESH_MS = 30 * 60_000;

export interface SatelliteState {
  detections: SatelliteDetection[];
  isLoading: boolean;
  error: string | null;
}

/**
 * @param enabled la couche est-elle affichée ? Rien n'est téléchargé tant qu'elle
 *   est masquée : c'est près d'un mégaoctet qu'on évite d'imposer aux visiteurs
 *   qui ne s'en servent pas.
 */
export function useSatelliteDetections(enabled: boolean): SatelliteState {
  const [detections, setDetections] = useState<SatelliteDetection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const hasDataRef = useRef(false);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    if (!hasDataRef.current) setIsLoading(true);

    try {
      const next = await fetchSatelliteDetections(controller.signal);
      setDetections(next);
      setError(null);
      hasDataRef.current = true;
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setError(cause instanceof Error ? cause.message : 'Erro desconhecido.');
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);

    return () => {
      clearInterval(timer);
      controllerRef.current?.abort();
    };
  }, [enabled, load]);

  return { detections, isLoading, error };
}
