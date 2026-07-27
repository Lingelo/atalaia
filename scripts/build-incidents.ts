/**
 * Précalcule les incidents opérationnels pour l'hébergement statique.
 *
 * POURQUOI, alors que l'API semblait autoriser les appels directs :
 *
 * Un `curl -I` sur api.fogos.pt renvoie bien `Access-Control-Allow-Origin`.
 * Mais c'est une réponse à un HEAD : sur un vrai GET, l'en-tête est ABSENT, et
 * le navigateur bloque. La leçon vaut d'être notée — on ne teste pas le CORS
 * autrement qu'avec la méthode réellement employée.
 *
 * Node, lui, n'applique pas la politique d'origine. On récupère donc les données
 * ici, au build, et on les publie en JSON.
 *
 * ⚠️ CONTREPARTIE, à ne pas minimiser : les données ne sont plus temps réel. Un
 * cron GitHub Actions se déclenche au mieux toutes les 5 minutes, et se trouve
 * souvent retardé de dix minutes ou plus aux heures chargées. Compter sur une
 * fraîcheur de 10 à 30 minutes. C'est acceptable pour une carte d'information,
 * ça ne l'est pas pour décider d'évacuer : fogos.pt reste la source de référence.
 *
 * `generatedAt` est publié avec les données précisément pour que l'interface
 * affiche l'âge RÉEL de l'information, et non l'instant du téléchargement.
 *
 * Pour du vrai temps réel, voir `workers/README.md` : une fonction Cloudflare
 * réutilise `createUpstreamProxy` sans rien réécrire.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { toIncident } from '../src/api/fogos.ts';
import type { FogosActiveResponse } from '../src/api/fogosTypes.ts';

const ENDPOINT = 'https://api.fogos.pt/v2/incidents/active';
const USER_AGENT = 'atalaia/0.1 (+https://github.com/Lingelo/atalaia)';

const OUTPUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/incidents.json');

async function main(): Promise<void> {
  const response = await fetch(ENDPOINT, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`fogos.pt a répondu ${response.status}`);

  const payload = (await response.json()) as FogosActiveResponse;
  if (!payload?.success || !Array.isArray(payload.data)) {
    throw new Error('Réponse inattendue de fogos.pt');
  }

  const incidents = payload.data
    .filter((raw) => raw.coords && Number.isFinite(raw.lat) && Number.isFinite(raw.lng))
    .map(toIncident);

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify({ generatedAt: Date.now(), incidents }));

  // Zéro incident actif est PLAUSIBLE au Portugal en hiver : contrairement au
  // script satellite, on ne fait pas échouer le build là-dessus.
  console.log(`${incidents.length} incidents écrits dans public/data/incidents.json`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
