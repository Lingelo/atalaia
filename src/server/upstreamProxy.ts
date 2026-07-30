/**
 * Proxy-cache générique vers une source amont.
 *
 * POURQUOI cette couche existe :
 *
 * 1. api.fogos.pt est derrière Cloudflare. Un `curl` sans User-Agent déclenche
 *    l'erreur 1015 en quelques requêtes ; avec un User-Agent explicite, tout
 *    passe. Le filtrage porte donc sur l'identité du client, pas seulement sur
 *    le volume — il faut s'annoncer.
 * 2. Sans cache, chaque visiteur déclencherait sa propre requête amont. Ici, une
 *    requête amont par fenêtre de TTL sert tout le monde. Pour FIRMS, dont les
 *    fichiers pèsent ~300 Ko pièce, ce n'est pas une politesse mais une nécessité.
 *
 * Volontairement écrit sans dépendance à un framework (entrée : un chemin,
 * sortie : un statut + un corps) pour être réutilisé tel quel dans une fonction
 * serverless en production, sans réécriture.
 */

/**
 * On s'identifie honnêtement plutôt que d'usurper un navigateur : si notre trafic
 * pose problème, l'opérateur doit pouvoir nous identifier et nous joindre.
 */
const USER_AGENT = 'atalaia/0.1 (+https://github.com/Lingelo/fogos-pt-renew)';

export interface UpstreamConfig {
  /** Origine amont, sans barre oblique finale. */
  origin: string;
  /** Liste blanche : le proxy ne doit jamais devenir un relais ouvert. */
  allowedPaths: RegExp[];
  ttlMs: number;
  contentType: string;
}

export interface ProxyResult {
  status: number;
  body: string;
  contentType: string;
  /** Vrai si la réponse provient du cache — exposé en en-tête pour le diagnostic. */
  cached: boolean;
}

interface CacheEntry {
  at: number;
  status: number;
  body: string;
}

export type UpstreamProxy = (pathname: string, search?: string) => Promise<ProxyResult>;

export function createUpstreamProxy(config: UpstreamConfig): UpstreamProxy {
  const cache = new Map<string, CacheEntry>();
  /** Requêtes en vol, partagées : évite la ruée simultanée à l'expiration du cache. */
  const inFlight = new Map<string, Promise<CacheEntry>>();

  const fail = (status: number, message: string): ProxyResult => ({
    status,
    body: JSON.stringify({ success: false, error: message }),
    contentType: 'application/json',
    cached: false,
  });

  return async function proxy(pathname, search = '') {
    if (!config.allowedPaths.some((allowed) => allowed.test(pathname))) {
      return fail(404, `Chemin non relayé : ${pathname}`);
    }

    const key = pathname + search;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < config.ttlMs) {
      return { status: hit.status, body: hit.body, contentType: config.contentType, cached: true };
    }

    let pending = inFlight.get(key);
    if (!pending) {
      pending = (async () => {
        const response = await fetch(`${config.origin}${pathname}${search}`, {
          headers: { 'User-Agent': USER_AGENT },
        });
        return { at: Date.now(), status: response.status, body: await response.text() };
      })().finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
    }

    try {
      const entry = await pending;

      // On ne met en cache que les succès : figer un 429 pendant tout le TTL
      // transformerait un incident passager en panne durable.
      if (entry.status === 200) cache.set(key, entry);

      return {
        status: entry.status,
        body: entry.body,
        contentType: config.contentType,
        cached: false,
      };
    } catch {
      // Amont injoignable : mieux vaut servir une donnée périmée que rien du tout.
      if (hit) {
        return { status: hit.status, body: hit.body, contentType: config.contentType, cached: true };
      }
      return fail(502, 'Fonte de dados indisponível.');
    }
  };
}

/** Incidents opérationnels de la protection civile portugaise (ANEPC via fogos.pt). */
export const proxyFogos = createUpstreamProxy({
  origin: 'https://api.fogos.pt',
  allowedPaths: [/^\/v2\/incidents\/active$/, /^\/v2\/incidents\/search$/],
  // Les incidents actifs bougent à l'échelle de la minute.
  ttlMs: 60_000,
  contentType: 'application/json',
});

/**
 * Détections thermiques satellite (NASA FIRMS).
 *
 * Les fichiers « 24h » sont publics et ne demandent aucune clé — vérifié le
 * 30/07/2026. TTL long : les satellites repassent toutes les quelques heures.
 *
 * ⚠️ Depuis le passage à la couverture MONDIALE, chaque fichier pèse ~7 Mo (et
 * non ~300 Ko comme les anciens fichiers limités à l'Europe), soit 21 Mo pour
 * les trois satellites. Ce relais n'est donc PAS le chemin normal : même en
 * développement, l'application lit le jeu précalculé. Il ne sert qu'à vérifier
 * le pipeline de bout en bout, avec VITE_FIRMS_LIVE=1 (voir src/api/firms.ts).
 */
export const proxyFirms = createUpstreamProxy({
  origin: 'https://firms.modaps.eosdis.nasa.gov',
  allowedPaths: [/^\/data\/active_fire\/[a-z0-9.-]+\/csv\/[A-Za-z0-9_]+\.csv$/],
  ttlMs: 30 * 60_000,
  contentType: 'text/csv',
});
