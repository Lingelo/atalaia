# Sources de données

Relevé du 30/07/2026. Chaque point d'accès a été vérifié en le sondant, pas
supposé d'après une documentation — la plupart n'en ont aucune.

Ce document existe pour deux raisons : ces adresses ont été trouvées en
remontant des applications cartographiques officielles jusqu'à leurs couches, ce
qui ne se redécouvre pas en cinq minutes ; et chacune porte un piège qui, non
documenté, se paierait par un chiffre faux à l'écran.

---

## 1. Portugal — ANEPC via fogos.pt

| | |
|---|---|
| Temps réel | `https://api.fogos.pt/v2/incidents/active` |
| Archive | `https://api.fogos.pt/v2/incidents/search` |
| Couverture | Portugal continental |
| Volume | 151 419 occurrences depuis 2018 |

**CORS.** Aucun en-tête `Access-Control-Allow-Origin` sur les **GET**. Un
`curl -I` en renvoie bien un, mais c'est la réponse à un HEAD : sur un vrai GET
il est absent et le navigateur bloque. On ne teste pas le CORS autrement qu'avec
la méthode réellement employée. Les données sont donc récupérées au build
(`scripts/build-incidents.ts`).

**Quota.** Derrière Cloudflare, environ **cinq requêtes par fenêtre de quinze
secondes**, puis `429`. La fenêtre se libère en moins de quinze secondes.
`scripts/build-history.ts` espace donc ses appels de 3,5 s et reprend en
exponentielle. Sans cela l'agrégation échoue dès la douzième requête.

**Paramètres de `search`** (aucun n'est documenté) :

- `limit` — jusqu'à 1 000 lignes par page, `page` pour paginer ;
- `after` **et** `before` au format `YYYY-MM-DD`. ⚠️ `before` **seul est
  ignoré** : il ne filtre qu'accompagné de `after` ;
- `concelho` — fonctionne. `district` / `distrito` / `year` / `natureza` — **sont
  ignorés**, la réponse contient alors l'archive entière. Une agrégation par
  district exige donc de paginer.

`limit=1` renvoie `paginator.totalItems` : c'est un décompte serveur qui ne coûte
qu'une ligne de données.

**Surface brûlée.** Le champ `icnf.burnArea` est presque toujours absent : sur
1 000 occurrences d'août 2025, **deux** portaient une surface exploitable. La vue
Historique ne publie donc aucune surface pour le Portugal — voir
`analytics.noBurnedData`.

---

## 2. Andalousie — Plan INFOCA (Junta de Andalucía)

```
https://utility.arcgis.com/usrsvcs/servers/d6d1c0079ddd4c7f8876d58e13fcf1ac
  /rest/services/INFOCA/AN_INCIDENTES_PRO/FeatureServer/2
```

**Comment l'adresse a été trouvée.** La page « Incendios en tiempo real » de la
Junta intègre un tableau de bord ArcGIS ; l'élément de portail de ce tableau de
bord (`.../sharing/rest/content/items/<id>/data?f=json`) référence une carte web,
qui référence à son tour cette couche. Elle répond sans jeton.

**Pièges.**

- `f=geojson` est **refusé** (`400 — Unable to perform query operation`), alors
  que `f=json` répond normalement. On convertit donc soi-même.
- `outSR=4326` est **obligatoire** : sans lui la géométrie sort en Web Mercator
  (EPSG:3857), soit des coordonnées à six chiffres qui poseraient les feux au
  large de l'Afrique.
- Un littéral epoch est refusé dans `where` ; il faut `DATE 'YYYY-MM-DD'`.

**Ce que comptent les champs.** `TECNICOS` est un nombre de **personnes** ;
`GRUPOS_ESPECIALISTAS`, `BRICAS`, `UMIF`, `GRUPOS_APOYO` et `UNASIF_ACO` sont des
nombres de **groupes**, dont l'effectif n'est pas publié. Les additionner
produirait un nombre dénué de sens. `VEHICULOS` et `MEDIOS_AEREOS`, eux, sont de
vrais décomptes d'engins, comparables au Portugal.

---

## 3. Catalogne — Bombers de la Generalitat

```
https://services7.arcgis.com/ZCqVt1fRXwwK6GF4/arcgis/rest/services
  /ACTUACIONS_URGENTS_online_PRO_AMB_FASE_VIEW/FeatureServer/0
```

Trouvée dans la configuration de l'application ArcGIS Experience référencée par
`interior.gencat.cat`. Une seconde vue (`..._PRO_VW`) existe mais ne renvoie que
des identifiants et une date d'édition : elle est inutilisable.

La **source la plus fraîche** des quatre — elle contenait des interventions
vieilles de dix minutes au relevé.

**Pièges.**

- `ACT_NUM_VEH` valait **0 sur les 33 lignes** de la vue, y compris sur des
  incendies forestiers en cours. Or une actuació mobilise par définition au moins
  un véhicule : c'est un champ non alimenté, pas une absence de moyens. Le code
  ne retient donc que les valeurs strictement positives et publie `null` sinon.
- Aucun effectif n'est publié.
- `COM_FASE` (phase en catalan) est absente sur environ la moitié des lignes.
- `ACT_SITUACIO` porte des codes d'une lettre (`A`, `I`, `N`, `P`) non
  documentés : ils sont délibérément **non interprétés** plutôt que devinés.

---

## 4. Castille-et-León — Junta de Castilla y León

```
https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets
  /incendios-forestales/{records,exports/json}
```

La **source la plus riche** : surface brûlée ventilée par couvert, niveau IGR,
cause probable, détail nominatif des moyens. Seule à couvrir plusieurs années
(depuis juin 2021).

**Pièges.**

- Ce n'est pas un flux d'incendies mais un **bulletin quotidien**, publié deux
  fois par jour : 26 996 lignes ne décrivent que **5 644 incendies distincts**.
  Sans dédoublonnage, le nombre de feux de la région est multiplié par cinq.
- `codigo_municipio_ine` est publié **par intermittence pour un même feu** —
  l'incendie de Llamas de Cabrera du 08/08/2025 apparaît à la fois avec le code
  `24016` et avec un code nul. L'identité est donc reconstruite sur le nom de
  commune plus l'instant de départ.
- Les moyens et la surface sont en **texte libre**
  (`3 Técnicos;15 A.M.;8 Autobombas`, `ARBOLADO:650,00 HA.`), avec des décimales
  à la **virgule**.
- Le bulletin ne paraît que pendant la **campagne estivale** : les mois d'hiver
  sont vides sur toute l'archive. Ils sont publiés `null` (« non couvert ») et
  non `0`.
- Les noms de province ne sont pas normalisés : `ÁVILA`, `AVILA` et
  `SEGOVIA,SEGOVIA` coexistent.
- `limit` est plafonné à **100** sur l'API `records` ; l'export complet passe par
  `exports/json` (17 Mo, une seule requête).

---

## 5. NASA FIRMS — détections satellite, mondiales

```
https://firms.modaps.eosdis.nasa.gov/data/active_fire/
  suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv
  noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv
  noaa-21-viirs-c2/csv/J2_VIIRS_C2_Global_24h.csv
```

Publics, sans clé. **Aucun en-tête CORS** : inaccessibles depuis un navigateur.

**Volumes.** ~7 Mo par satellite, soit **21 Mo** pour les trois (contre ~300 Ko
pour les anciens fichiers limités à l'Europe). Après filtrage des détections
`low` et regroupement à 0,01°, il reste **86 786 foyers**.

**Format publié.** Un tableau d'objets JSON pèserait 15 Mo (1,6 Mo compressé).
Réécrit en colonnes d'entiers, latitude et horodatage encodés en écart au
précédent après tri par latitude, le même jeu tombe à **2,3 Mo (696 Ko
compressé)**. Mesuré, pas estimé — une variante base64 a été essayée et donne
848 Ko, donc pire, la compression n'ayant plus prise sur du texte encodé.

**Attribution par pays.** Faite au build par test point-dans-polygone contre
Natural Earth 1:50m (domaine public, 3 Mo). 99,1 % des foyers sont attribués ;
les 0,9 % restants sont en mer — le plus souvent des torchères de plateformes,
que FIRMS détecte réellement. Ils restent `null` plutôt que d'être rattachés au
pays le plus proche.

Le 1:110m a été écarté : à cette échelle les littoraux s'écartent de plusieurs
dizaines de kilomètres et rejetteraient à la mer des foyers côtiers — or les feux
de forêt sont massivement côtiers. Même au 1:50m, l'estuaire du Tage est modélisé
en eau, si bien qu'un point au centre de Lisbonne n'est attribué à aucun pays.

---

## Ce que ces sources ne couvrent pas

**Il n'existe aucun service national espagnol d'incendies en temps réel.** La
compétence est régionale. Les trois communautés autonomes ci-dessus concentrent
l'essentiel de l'activité de la péninsule, mais un feu en Galice, en Estrémadure
ou dans la Communauté valencienne **n'apparaîtra pas**.

C'est la limite la plus importante de cette application, et la seule qu'aucun
soin apporté aux données ne corrige. Une carte vide au-dessus de la Galice se
lirait « il n'y brûle rien » alors qu'elle signifie « on ne sait pas ». D'où le
badge de couverture (`SourceStatusBadge`), qui nomme les services interrogés et
dit explicitement ce qui manque.

Pistes pour étendre la couverture, non explorées : INFOCAM/FIDIAS
(Castille-La Manche) et le 112 de la Communauté valencienne publient des données
d'incendies actifs ; la Galice et l'Estrémadure n'ont pas été cherchées.
