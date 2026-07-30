/**
 * Zones de surveillance : stockage et alertes RÉELLES.
 *
 * Ce que ce module remplace : deux zones de démonstration codées en dur
 * (« Casa — Marmelete, Monchique », « Armazém — Loulé ») qui réapparaissaient à
 * chaque rechargement, disparaissaient à la moindre modification, et ne
 * déclenchaient jamais la moindre notification. L'écran affichait un formulaire
 * pleinement fonctionnel au-dessus d'un mécanisme qui n'existait pas.
 *
 * Désormais : les zones appartiennent à l'utilisateur, survivent au
 * rechargement, et sont confrontées aux incidents réels à chaque
 * rafraîchissement.
 *
 * POURQUOI `localStorage` et non un compte : le site est statique, sans
 * serveur ni identité. Un stockage local tient la promesse faite à l'écran
 * — « vos zones sont conservées » — sans en faire une plus grande qu'on ne
 * saurait tenir. La contrepartie est honnête et bornée : les zones ne suivent
 * pas d'un appareil à l'autre.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Incident, WatchZone } from '../types';
import { distanceKm, isWithinQuietHours, minutesOfDay } from '../lib/geo.ts';
import { resolvePhase } from '../lib/status.ts';

const STORAGE_KEY = 'atalaia.watchZones';

/** Au-delà, une « zone » couvre une région entière et n'alerte plus de rien d'utile. */
export const MAX_RADIUS_KM = 50;

/** Seuil d'effectif au-delà duquel un sinistre est considéré comme majeur. */
const MAJOR_PERSONNEL = 50;

function readStored(): WatchZone[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Validation champ par champ plutôt qu'une confiance aveugle : le contenu
    // de localStorage a pu être écrit par une version antérieure du format, ou
    // édité à la main. Une zone mal formée ferait planter le rendu de la carte.
    return parsed.flatMap((entry): WatchZone[] => {
      const zone = entry as Partial<WatchZone>;
      if (typeof zone.id !== 'string' || typeof zone.name !== 'string') return [];
      if (!Number.isFinite(zone.lat) || !Number.isFinite(zone.lng)) return [];

      return [
        {
          id: zone.id,
          name: zone.name,
          locationName: typeof zone.locationName === 'string' ? zone.locationName : '',
          lat: zone.lat as number,
          lng: zone.lng as number,
          radiusKm: Number.isFinite(zone.radiusKm) ? (zone.radiusKm as number) : 10,
          condition: zone.condition === 'major' ? 'major' : 'all',
          active: zone.active !== false,
          quietHoursStart: typeof zone.quietHoursStart === 'string' ? zone.quietHoursStart : '23:00',
          quietHoursEnd: typeof zone.quietHoursEnd === 'string' ? zone.quietHoursEnd : '07:00',
        },
      ];
    });
  } catch {
    // Navigation privée, quota plein, JSON corrompu : on repart d'une liste
    // vide plutôt que d'empêcher l'application de démarrer.
    return [];
  }
}

export interface WatchZonesState {
  zones: WatchZone[];
  addZone: (zone: Omit<WatchZone, 'id'>) => void;
  toggleZone: (id: string) => void;
  deleteZone: (id: string) => void;
}

export function useWatchZones(): WatchZonesState {
  const [zones, setZones] = useState<WatchZone[]>(readStored);

  useEffect(() => {
    try {
      window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(zones));
    } catch {
      // Stockage refusé : les zones valent pour la session. Rien de bloquant,
      // et surtout rien qui justifie d'interrompre l'utilisateur.
    }
  }, [zones]);

  const addZone = useCallback((zone: Omit<WatchZone, 'id'>) => {
    setZones((previous) => [{ ...zone, id: `zone-${Date.now()}` }, ...previous]);
  }, []);

  const toggleZone = useCallback((id: string) => {
    setZones((previous) =>
      previous.map((zone) => (zone.id === id ? { ...zone, active: !zone.active } : zone))
    );
  }, []);

  const deleteZone = useCallback((id: string) => {
    setZones((previous) => previous.filter((zone) => zone.id !== id));
  }, []);

  return { zones, addZone, toggleZone, deleteZone };
}

/** Un incident tombe-t-il sous le coup d'une zone donnée ? */
export function matchesZone(zone: WatchZone, incident: Incident, now: Date): boolean {
  if (!zone.active) return false;
  if (!resolvePhase(incident.phase).ongoing) return false;

  if (distanceKm(zone.lat, zone.lng, incident.lat, incident.lng) > zone.radiusKm) return false;

  if (zone.condition === 'major') {
    // ⚠️ `personnel` vaut `null` chez les services qui ne le publient pas —
    // toute la Catalogne, par exemple. Un test `personnel > 50` y serait
    // toujours faux, et la zone ne s'y déclencherait JAMAIS, silencieusement.
    // Faute de pouvoir juger, on alerte : sur une carte d'incendies, une alerte
    // de trop vaut mieux qu'un feu majeur passé sous silence.
    if (incident.personnel !== null && incident.personnel < MAJOR_PERSONNEL) return false;
  }

  return !isWithinQuietHours(minutesOfDay(now), zone.quietHoursStart, zone.quietHoursEnd);
}

/**
 * Notifie l'utilisateur des incidents entrant dans ses zones.
 *
 * Ne notifie QU'UNE FOIS par couple (zone, incident) : sans cette mémoire, le
 * rafraîchissement toutes les minutes renotifierait le même feu soixante fois
 * par heure, et l'utilisateur couperait les notifications — donc raterait la
 * suivante, la vraie.
 *
 * La mémoire vit dans une `ref` et non dans un état : la modifier ne doit pas
 * provoquer de rendu, elle ne change rien à ce qui est affiché.
 */
export function useZoneAlerts(zones: WatchZone[], incidents: Incident[]): void {
  const notified = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const now = new Date();
    const stillRelevant = new Set<string>();

    for (const zone of zones) {
      for (const incident of incidents) {
        if (!matchesZone(zone, incident, now)) continue;

        const key = `${zone.id}:${incident.id}`;
        stillRelevant.add(key);
        if (notified.current.has(key)) continue;
        notified.current.add(key);

        const distance = distanceKm(zone.lat, zone.lng, incident.lat, incident.lng);
        new Notification(zone.name, {
          body: `${incident.title} — ${incident.status} · ${distance.toFixed(1)} km`,
          // Une notification par couple : les suivantes remplacent la
          // précédente plutôt que d'empiler des doublons visuels.
          tag: key,
        });
      }
    }

    // Oubli des couples qui ne correspondent plus, pour qu'un feu éteint puis
    // relancé au même endroit puisse notifier de nouveau.
    for (const key of notified.current) {
      if (!stillRelevant.has(key)) notified.current.delete(key);
    }
  }, [zones, incidents]);
}
