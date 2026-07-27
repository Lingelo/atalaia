/**
 * Proxy CORS optionnel, pour du VRAI temps réel.
 *
 * Sans lui, le site statique lit un JSON précalculé toutes les ~15 minutes.
 * C'est honnête (l'âge réel de la donnée est affiché) mais ce n'est pas du
 * temps réel. Ce Worker supprime cette latence.
 *
 * POURQUOI il est nécessaire : api.fogos.pt ne renvoie pas d'en-tête
 * `Access-Control-Allow-Origin` sur les requêtes GET — vérifié. Un navigateur
 * ne peut donc pas l'interroger depuis un autre domaine. Un Worker, lui, n'est
 * pas soumis à la politique d'origine.
 *
 * Déploiement (offre gratuite Cloudflare) :
 *   npx wrangler deploy workers/fogos-proxy.js --name atalaia-proxy --compatibility-date 2026-01-01
 *
 * Puis republier le site avec l'origine obtenue :
 *   VITE_FOGOS_PROXY=https://atalaia-proxy.<sous-domaine>.workers.dev npm run build
 * ou en ajoutant cette variable au workflow GitHub Actions.
 */

const UPSTREAM = 'https://api.fogos.pt';
const USER_AGENT = 'atalaia/0.1 (+https://github.com/Lingelo/atalaia)';

// Liste blanche : un proxy ouvert deviendrait un relais pour n'importe qui.
const ALLOWED = [/^\/v2\/incidents\/active$/, /^\/v2\/incidents\/search$/];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (!ALLOWED.some((re) => re.test(url.pathname))) {
      return new Response('Not found', { status: 404, headers: CORS });
    }

    const upstream = await fetch(`${UPSTREAM}${url.pathname}${url.search}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      // Cache de bordure : une requête amont par minute sert tous les visiteurs,
      // ce qui reproduit le comportement du proxy de développement.
      cf: { cacheTtl: 60, cacheEverything: true },
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  },
};
