import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

import { proxyFogos, proxyFirms, type UpstreamProxy } from './src/server/upstreamProxy';

/** Points de montage. Doivent rester alignés avec les constantes de `src/api/`. */
const MOUNTS: Array<{ path: string; proxy: UpstreamProxy }> = [
  { path: '/api/fogos', proxy: proxyFogos },
  { path: '/api/firms', proxy: proxyFirms },
];

/**
 * Monte le proxy-cache fogos.pt dans le serveur de développement.
 *
 * ⚠️ Ne couvre QUE le `vite dev`. Un build de production est un SPA statique, sans
 * serveur : il faudra exposer `proxyFogos` via une fonction serverless (Vercel,
 * Netlify, Cloudflare Worker) sur le même chemin `/api/fogos/*`. La logique étant
 * déjà isolée dans src/server/fogosProxy.ts, ce sera un adaptateur, pas une
 * réécriture.
 */
function upstreamProxyPlugin(): Plugin {
  return {
    name: 'upstream-proxy',
    configureServer(server) {
      for (const { path, proxy } of MOUNTS) {
        server.middlewares.use(path, (req, res) => {
          const url = new URL(req.url ?? '/', 'http://localhost');

          proxy(url.pathname, url.search)
            .then((result) => {
              res.statusCode = result.status;
              res.setHeader('Content-Type', result.contentType);
              res.setHeader('X-Proxy-Cache', result.cached ? 'HIT' : 'MISS');
              res.end(result.body);
            })
            .catch((error: unknown) => {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: String(error) }));
            });
        });
      }
    },
  };
}

export default defineConfig({
  /**
   * Chemin racine du site publié.
   *
   * GitHub Pages sert un dépôt de projet sous `/<nom-du-depot>/`, pas à la
   * racine du domaine. Sans ce préfixe, tous les liens vers les assets pointent
   * vers `/assets/…` et renvoient 404. Laissé configurable pour que
   * `npm run preview` en local fonctionne toujours à la racine.
   */
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss(), upstreamProxyPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
