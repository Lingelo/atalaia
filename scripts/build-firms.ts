/**
 * Précalcule les détections satellite pour l'hébergement statique.
 *
 * POURQUOI ce script existe :
 *
 * NASA FIRMS ne renvoie AUCUN en-tête CORS — vérifié. Un navigateur ne peut donc
 * pas l'interroger depuis GitHub Pages, où il n'y a aucun serveur pour relayer.
 * On déplace le travail au build : une GitHub Action planifiée télécharge les
 * CSV, applique le même pipeline que l'application, et publie un JSON.
 *
 * Deux bénéfices au passage :
 *  - la NASA reçoit une requête par build au lieu d'une par visiteur ;
 *  - le client télécharge ~100 Ko de JSON au lieu de ~900 Ko de CSV.
 *
 * La fraîcheur (quelques heures) n'est pas une régression : c'est la cadence
 * réelle de repassage des satellites.
 *
 * Exécuté par Node 24, qui lit le TypeScript nativement.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { VIIRS_SOURCES, processFirmsCsvs } from '../src/api/firms.ts';

const FIRMS_ORIGIN = 'https://firms.modaps.eosdis.nasa.gov';
const USER_AGENT = 'atalaia/0.1 (+https://github.com/Lingelo/atalaia)';

const OUTPUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/firms.json');

async function main(): Promise<void> {
  const texts = await Promise.all(
    VIIRS_SOURCES.map(async (path) => {
      const response = await fetch(`${FIRMS_ORIGIN}${path}`, {
        headers: { 'User-Agent': USER_AGENT },
      });
      if (!response.ok) throw new Error(`FIRMS ${response.status} sur ${path}`);
      return response.text();
    })
  );

  const detections = processFirmsCsvs(texts);

  // Un jeu vide signale presque toujours une panne amont plutôt qu'une Europe
  // sans le moindre feu. Mieux vaut faire échouer le build et conserver le JSON
  // précédent que publier une carte vide qui aurait l'air d'une bonne nouvelle.
  if (detections.length === 0) {
    throw new Error('Aucun foyer après traitement : anomalie amont probable.');
  }

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(detections));

  const strongest = detections.reduce((max, d) => Math.max(max, d.frpMw), 0);
  console.log(
    `${detections.length} foyers écrits dans public/data/firms.json ` +
      `(le plus intense : ${strongest.toFixed(1)} MW)`
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
