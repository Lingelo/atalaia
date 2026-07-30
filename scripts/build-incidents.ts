/**
 * Précalcule les incidents opérationnels pour l'hébergement statique.
 *
 * POURQUOI, alors que l'API portugaise semblait autoriser les appels directs :
 *
 * Un `curl -I` sur api.fogos.pt renvoie bien `Access-Control-Allow-Origin`.
 * Mais c'est une réponse à un HEAD : sur un vrai GET, l'en-tête est ABSENT, et
 * le navigateur bloque. La leçon vaut d'être notée — on ne teste pas le CORS
 * autrement qu'avec la méthode réellement employée.
 *
 * Les trois services espagnols, eux, renvoient bien l'en-tête sur un GET. Ils
 * sont donc récupérés ici non par nécessité technique mais par COHÉRENCE : un
 * seul fichier, une seule date de production. Voir la note de src/api/incidents.ts.
 *
 * Node n'applique pas la politique d'origine. On récupère donc les quatre
 * sources ici, au build, et on publie un JSON.
 *
 * ⚠️ CONTREPARTIE, à ne pas minimiser : les données ne sont plus temps réel. Un
 * cron GitHub Actions se déclenche au mieux toutes les 5 minutes, et se trouve
 * souvent retardé de dix minutes ou plus aux heures chargées. Compter sur une
 * fraîcheur de 10 à 30 minutes. C'est acceptable pour une carte d'information,
 * ça ne l'est pas pour décider d'évacuer : les services officiels restent la
 * source de référence.
 *
 * `generatedAt` est publié avec les données précisément pour que l'interface
 * affiche l'âge RÉEL de l'information, et non l'instant du téléchargement.
 *
 * Exécuté par Node 24, qui lit le TypeScript nativement.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { toIncident } from '../src/api/fogos.ts';
import type { FogosActiveResponse } from '../src/api/fogosTypes.ts';
import { fetchSpainIncidents, type SourceReport } from '../src/api/spain/index.ts';
import type { Incident } from '../src/types.ts';

const ENDPOINT = 'https://api.fogos.pt/v2/incidents/active';
const USER_AGENT = 'atalaia/0.1 (+https://github.com/Lingelo/atalaia)';

const OUTPUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/incidents.json');

/** Portugal — ANEPC via fogos.pt. */
async function fetchPortugal(): Promise<Incident[]> {
  const response = await fetch(ENDPOINT, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`fogos.pt a répondu ${response.status}`);

  const payload = (await response.json()) as FogosActiveResponse;
  if (!payload?.success || !Array.isArray(payload.data)) {
    throw new Error('Réponse inattendue de fogos.pt');
  }

  // `coords: false` signale un incident sans localisation exploitable. On l'écarte
  // plutôt que de le poser en (0, 0), au large du golfe de Guinée.
  return payload.data
    .filter((raw) => raw.coords && Number.isFinite(raw.lat) && Number.isFinite(raw.lng))
    .map(toIncident);
}

async function main(): Promise<void> {
  const [portugal, spain] = await Promise.allSettled([fetchPortugal(), fetchSpainIncidents()]);

  const incidents: Incident[] = [];
  const reports: SourceReport[] = [];

  if (portugal.status === 'fulfilled') {
    incidents.push(...portugal.value);
    reports.push({ source: 'anepc', ok: true, count: portugal.value.length });
  } else {
    // On ne fait pas échouer le build sur un seul service : publier trois pays
    // sur quatre vaut mieux que republier un jeu entier vieux d'une heure. Le
    // rapport d'échec voyage AVEC les données, pour que l'interface le montre.
    reports.push({
      source: 'anepc',
      ok: false,
      count: 0,
      error: portugal.reason instanceof Error ? portugal.reason.message : String(portugal.reason),
    });
  }

  if (spain.status === 'fulfilled') {
    incidents.push(...spain.value.incidents);
    reports.push(...spain.value.reports);
  } else {
    const error = spain.reason instanceof Error ? spain.reason.message : String(spain.reason);
    reports.push(
      { source: 'infoca', ok: false, count: 0, error },
      { source: 'bombers', ok: false, count: 0, error },
      { source: 'jcyl', ok: false, count: 0, error }
    );
  }

  // Les quatre services muets en même temps ne décrivent pas une péninsule sans
  // feu : c'est une panne, réseau ou build. Échouer conserve le JSON précédent,
  // qui vaut mieux qu'une carte vide ressemblant à une bonne nouvelle.
  if (reports.every((report) => !report.ok)) {
    throw new Error(
      `Aucun service n'a répondu : ${reports.map((r) => `${r.source} (${r.error})`).join(', ')}`
    );
  }

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify({ generatedAt: Date.now(), incidents, reports }));

  // Zéro incident actif est PLAUSIBLE en hiver : contrairement au script
  // satellite, on ne fait pas échouer le build là-dessus.
  const summary = reports
    .map((r) => `${r.source}=${r.ok ? r.count : `ÉCHEC (${r.error})`}`)
    .join(' · ');
  console.log(`${incidents.length} incidents écrits dans public/data/incidents.json — ${summary}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
