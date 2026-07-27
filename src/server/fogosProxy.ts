/**
 * Proxy-cache vers api.fogos.pt.
 *
 * POURQUOI cette couche existe :
 *
 * 1. api.fogos.pt est derrière Cloudflare. Un `curl` sans User-Agent déclenche
 *    l'erreur 1015 en quelques requêtes ; avec un User-Agent explicite, tout
 *    passe. Le filtrage porte donc sur l'identité du client, pas seulement sur
 *    le volume — il faut s'annoncer.
 * 2. Sans cache, chaque visiteur déclencherait sa propre requête amont. Ici, une
 *    requête amont par fenêtre de TTL sert tout le monde.
 *
 * Volontairement écrit sans dépendance à un framework (entrée : une URL, sortie :
 * un statut + un corps) pour être réutilisé tel quel dans une fonction serverless
 * en production, sans réécriture.
 */

const UPSTREAM_ORIGIN = 'https://api.fogos.pt';

/**
 * On s'identifie honnêtement plutôt que d'usurper un navigateur : si notre trafic
 * pose problème, l'opérateur doit pouvoir nous identifier et nous joindre.
 */
const USER_AGENT = 'fogos-pt-renew/0.1 (+https://github.com/Lingelo/fogos-pt-renew)';

/** Les incidents actifs bougent à l'échelle de la minute : en deçà, on tape pour rien. */
const TTL_MS = 60_000;

/** Chemins relayables. Liste blanche : le proxy ne doit pas devenir un relais ouvert. */
const ALLOWED_PATHS = [/^\/v2\/incidents\/active$/, /^\/v2\/incidents\/search$/];

export interface ProxyResult {
  status: number;
  body: string;
  contentType: string;
  /** Vrai si la réponse provient du cache — pratique pour un en-tête de debug. */
  cached: boolean;
}

interface CacheEntry {
  at: number;
  status: number;
  body: string;
}

const cache = new Map<string, CacheEntry>();

/** Requête amont en vol, partagée : évite la ruée simultanée à l'expiration du cache. */
const inFlight = new Map<string, Promise<CacheEntry>>();

function jsonError(status: number, message: string): ProxyResult {
  return {
    status,
    body: JSON.stringify({ success: false, error: message }),
    contentType: 'application/json',
    cached: false,
  };
}

async function fetchUpstream(pathname: string, search: string): Promise<CacheEntry> {
  const response = await fetch(`${UPSTREAM_ORIGIN}${pathname}${search}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });

  return { at: Date.now(), status: response.status, body: await response.text() };
}

/**
 * Relaie une requête, en servant le cache quand il est frais.
 *
 * @param pathname chemin APRÈS le préfixe de montage (ex. "/v2/incidents/active")
 */
export async function proxyFogos(pathname: string, search = ''): Promise<ProxyResult> {
  if (!ALLOWED_PATHS.some((allowed) => allowed.test(pathname))) {
    return jsonError(404, `Chemin non relayé : ${pathname}`);
  }

  const key = pathname + search;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return { status: hit.status, body: hit.body, contentType: 'application/json', cached: true };
  }

  // Si une requête amont est déjà en vol pour cette clé, on s'y raccroche au lieu
  // d'en lancer une seconde.
  let pending = inFlight.get(key);
  if (!pending) {
    pending = fetchUpstream(pathname, search).finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }

  try {
    const entry = await pending;

    // On ne met en cache que les succès : figer un 429 pendant une minute
    // transformerait un incident passager en panne durable.
    if (entry.status === 200) cache.set(key, entry);

    return {
      status: entry.status,
      body: entry.body,
      contentType: 'application/json',
      cached: false,
    };
  } catch {
    // Amont injoignable : mieux vaut servir une donnée périmée que rien du tout.
    if (hit) {
      return { status: hit.status, body: hit.body, contentType: 'application/json', cached: true };
    }
    return jsonError(502, 'Serviço de incêndios indisponível.');
  }
}
