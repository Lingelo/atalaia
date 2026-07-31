/**
 * Précalcule les détections satellite MONDIALES pour l'hébergement statique.
 *
 * POURQUOI ce script existe :
 *
 * NASA FIRMS ne renvoie AUCUN en-tête CORS — vérifié. Un navigateur ne peut donc
 * pas l'interroger depuis GitHub Pages, où il n'y a aucun serveur pour relayer.
 * On déplace le travail au build : une GitHub Action planifiée télécharge les
 * CSV, applique le même pipeline que l'application, et publie un JSON.
 *
 * Depuis le passage à la couverture mondiale, ce script fait deux choses de plus,
 * et l'une comme l'autre serait déraisonnable côté navigateur :
 *
 *  1. ATTRIBUER UN PAYS à chaque foyer, par test point-dans-polygone. La couche
 *     de frontières pèse 3 Mo, cinq fois le jeu publié.
 *  2. ENCODER en colonnes d'entiers. Le jeu mondial fait 15 Mo en JSON d'objets
 *     et 2 Mo dans ce format — 636 Ko une fois compressé par le serveur.
 *
 * Bénéfices au passage :
 *  - la NASA reçoit trois requêtes par build au lieu de trois par visiteur ;
 *  - le client télécharge ~640 Ko au lieu de ~21 Mo de CSV.
 *
 * La fraîcheur (quelques heures) n'est pas une régression : c'est la cadence
 * réelle de repassage des satellites.
 *
 * Exécuté par Node 24, qui lit le TypeScript nativement.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { VIIRS_SOURCES, encodeFirmsPayload, processFirmsCsvs } from '../src/api/firms.ts';
import { buildCountryIndex } from './lib/countries.ts';

const FIRMS_ORIGIN = 'https://firms.modaps.eosdis.nasa.gov';
const USER_AGENT = 'atalaia/0.1 (+https://github.com/Lingelo/atalaia)';

const OUTPUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/firms.json');

/**
 * Télécharge un CSV FIRMS, en réessayant sur échec réseau.
 *
 * POURQUOI ce filet : sur les runners GitHub, la connexion à
 * firms.modaps.eosdis.nasa.gov échoue régulièrement par `ETIMEDOUT`, en moins
 * d'une seconde — la connexion n'est même pas établie, ce n'est pas un serveur
 * qui répond mal. C'est typiquement transitoire, et une seule tentative
 * transformait cet aléa en déploiement perdu.
 *
 * Attente croissante entre les essais : si l'amont est réellement saturé,
 * marteler n'arrangerait rien. Le `timeout` explicite évite par ailleurs qu'une
 * connexion pendante retienne le build de longues minutes.
 */
async function fetchCsv(path: string, attempts = 4): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${FIRMS_ORIGIN}${path}`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) throw new Error(`FIRMS ${response.status} sur ${path}`);
      return await response.text();
    } catch (error: unknown) {
      lastError = error;
      if (attempt === attempts) break;

      const backoff = 2 ** attempt * 1000;
      console.warn(
        `FIRMS ${path} : échec ${attempt}/${attempts} (${
          error instanceof Error ? error.message : String(error)
        }) — nouvelle tentative dans ${backoff / 1000} s`
      );
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function main(): Promise<void> {
  // Les frontières et les détections sont récupérées en parallèle : elles ne
  // dépendent pas l'une de l'autre, et le CSV mondial est long à descendre.
  const [texts, countryIndex] = await Promise.all([
    Promise.all(VIIRS_SOURCES.map((path) => fetchCsv(path))),
    buildCountryIndex(),
  ]);

  const detections = processFirmsCsvs(texts);

  // Un jeu vide signale presque toujours une panne amont plutôt qu'une planète
  // sans le moindre feu. Mieux vaut faire échouer le build et conserver le JSON
  // précédent que publier une carte vide qui aurait l'air d'une bonne nouvelle.
  if (detections.length === 0) {
    throw new Error('Aucun foyer après traitement : anomalie amont probable.');
  }

  let unattributed = 0;
  const perCountry = new Map<string, number>();

  for (const detection of detections) {
    const index = countryIndex.lookup(detection.lat, detection.lng);
    if (index < 0) {
      // Reste `null` : en mer, c'est le plus souvent une torchère de plateforme
      // pétrolière, que FIRMS détecte réellement. L'attribuer au pays le plus
      // proche inventerait un feu de forêt là où il n'y en a pas.
      unattributed += 1;
      continue;
    }

    const code = countryIndex.codes[index];
    detection.countryCode = code;
    perCountry.set(code, (perCountry.get(code) ?? 0) + 1);
  }

  const payload = encodeFirmsPayload(
    detections,
    countryIndex.codes,
    countryIndex.names,
    Date.now()
  );

  await mkdir(dirname(OUTPUT), { recursive: true });
  const serialised = JSON.stringify(payload);
  await writeFile(OUTPUT, serialised);

  const strongest = detections.reduce((max, d) => Math.max(max, d.frpMw), 0);
  const top = [...perCountry.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => `${code}:${count}`)
    .join(' ');

  console.log(
    `${detections.length} foyers écrits dans public/data/firms.json ` +
      `(${(serialised.length / 1e6).toFixed(2)} Mo, le plus intense : ${strongest.toFixed(1)} MW)\n` +
      `  ${perCountry.size} pays · ${unattributed} hors frontières (mer, torchères) · tête : ${top}`
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
