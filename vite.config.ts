import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

import { proxyFogos } from './src/server/fogosProxy';

/** Préfixe de montage du proxy. Doit rester aligné avec `API_BASE` dans src/api/fogos.ts. */
const MOUNT = '/api/fogos';

/**
 * Monte le proxy-cache fogos.pt dans le serveur de développement.
 *
 * ⚠️ Ne couvre QUE le `vite dev`. Un build de production est un SPA statique, sans
 * serveur : il faudra exposer `proxyFogos` via une fonction serverless (Vercel,
 * Netlify, Cloudflare Worker) sur le même chemin `/api/fogos/*`. La logique étant
 * déjà isolée dans src/server/fogosProxy.ts, ce sera un adaptateur, pas une
 * réécriture.
 */
function fogosProxyPlugin(): Plugin {
  return {
    name: 'fogos-proxy',
    configureServer(server) {
      server.middlewares.use(MOUNT, (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost');

        proxyFogos(url.pathname, url.search)
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
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), fogosProxyPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
