import { useEffect, useState } from 'react';

import type { HistoryPayload } from '../types';

/**
 * Charge l'historique agrégé publié par `scripts/build-history.ts`.
 *
 * Aucun rafraîchissement périodique, contrairement aux incidents : ce fichier
 * est reconstruit une fois par jour. Le relire toutes les minutes ne ferait que
 * resservir le même octet.
 *
 * Le chargement est différé jusqu'à l'ouverture de l'onglet Historique par
 * l'appelant, qui passe `enabled` — la majorité des visiteurs ne consultent que
 * la carte, et n'ont aucune raison de télécharger l'archive.
 */
export interface HistoryState {
  history: HistoryPayload | null;
  isLoading: boolean;
  error: string | null;
}

export function useHistory(enabled: boolean): HistoryState {
  const [history, setHistory] = useState<HistoryPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || history) return;

    const controller = new AbortController();
    setIsLoading(true);

    fetch(`${import.meta.env.BASE_URL}data/history.json`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Histórico indisponível (${response.status}).`);
        return (await response.json()) as HistoryPayload;
      })
      .then((payload) => {
        setHistory(payload);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Erro desconhecido.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [enabled, history]);

  return { history, isLoading, error };
}
