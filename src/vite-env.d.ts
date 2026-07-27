/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Origine d'un proxy temps réel (fonction Cloudflare, Vercel…).
   * Vide : le site lit le JSON précalculé au build. Voir workers/README.md.
   */
  readonly VITE_FOGOS_PROXY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
