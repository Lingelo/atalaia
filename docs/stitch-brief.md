# Brief de maquettage — Stitch

Objectif : obtenir des maquettes **implémentables** pour un lecteur moderne des données
d'incendies au Portugal. Stack cible arrêtée : Next.js + TypeScript + Tailwind + MapLibre GL.

> ⚠️ Rédige les prompts **en anglais** dans Stitch. C'est un outil Google entraîné
> majoritairement sur de l'anglais : les prompts français donnent des layouts plus pauvres et
> des libellés traduits au hasard. En revanche le **contenu affiché** doit rester en portugais
> réel (voir plus bas) — c'est ce qui force Stitch à gérer les vraies longueurs de texte.

---

## 1. Contraintes issues des données réelles

Vérifiées en sondant `api.fogos.pt` le 27/07/2026. Elles ne sont pas négociables : la maquette
doit s'y plier, pas l'inverse.

### 1.1 Les couleurs de statut viennent de l'API

Chaque incident porte un champ `statusColor` (hex) fourni par la source.
**Stitch ne doit pas inventer sa propre palette de statuts** : il doit la recevoir. Sinon
l'implémentation devra soit trahir la maquette, soit ignorer l'API.

Palette **relevée dans la réponse réelle** du 27/07/2026 (23 feux actifs) :

| `statusCode` | Statut (pt) | `statusColor` | Sens |
|---|---|---|---|
| 4 | Despacho de 1º Alerta | `#FF6E02` | Renfort envoyé |
| 5 | Em Curso | `#B81E1F` | **Feu actif, non maîtrisé** |
| 7 | Em Resolução | `#6ABF59` | En cours de maîtrise |
| 8 | Conclusão | `#BDBDBD` | Éteint, moyens encore sur place |
| 9 | Vigilância | `#6ABF59` | Surveillance des reprises |

Codes `1, 2, 3, 6, 10` non observés dans ce relevé (activité faible un 27 juillet au matin) —
à re-sonder en pic d'activité avant de figer la légende.

> 🔴 **Problème de design à résoudre dans la maquette, pas à l'implémentation.**
> `Em Resolução` et `Vigilância` partagent **exactement la même couleur `#6ABF59`**. Or ce sont
> deux situations très différentes : dans un cas les pompiers se battent encore (195 opérationnels
> sur le feu de Soure), dans l'autre le feu est éteint et on guette les reprises. **La couleur ne
> peut donc pas être le seul encodage du statut** — il faut une forme, une icône ou un libellé
> distinct. C'est exactement le genre de contrainte qu'une maquette « jolie » ignore et qui
> explose au premier vrai jeu de données.

### 1.2 Champs réellement disponibles par incident

```
id, date, hour, dateTime.sec, location, district, concelho, freguesia, dico,
regiao, sub_regiao, lat, lng,
natureza (Mato / Povoamento Florestal / Agrícola), naturezaCode,
status, statusCode, statusColor, active, isFire, important,
man (opérationnels), terrain (véhicules), aerial (moyens aériens),
detailLocation, localidade,
icnf.burnArea { povoamento, agricola, mato, total }, icnf.altitude, icnf.fontealerta,
kmlVost  → périmètre du feu en polygone
weather { temperatura, humidade, intensidadeVentoKM, direccVento, precAcumulada,
          radiacao, pressao, stationLocation, stationDistance, date }
```

**Champs vides sur les 23 incidents du relevé** — ne pas concevoir d'UI autour d'eux sans
re-vérification en pic d'activité : `meios_aquaticos`, `especieName`, `familiaName`, `important`,
`kml`, `pco`, `cos`, `heliFight`, `heliCoord`, `planeFight`, `extra`.

Trois gisements que fogos.pt exploite peu et qui justifient le projet :
- **`weather`** (16/23 incidents) : relevé de la station météo la plus proche, avec sa distance.
  Température, humidité, vent en km/h et direction. C'est **le** contexte qui explique pourquoi
  un feu se propage — personne ne l'affiche bien. Fort différenciateur.
- **`icnf.burnArea`** ventilé en peuplement forestier / agricole / broussailles.
- **`kmlVost`** : le périmètre réel du feu, un polygone plutôt qu'une punaise. ⚠️ **Seulement
  2 incidents sur 23** en disposent : c'est un enrichissement pour les gros feux, pas le mode
  d'affichage par défaut. La maquette doit gérer les deux cas.

⚠️ **`burnArea` est très probablement en hectares** : sur le relevé, min `0.0`, médiane `0.2`,
max `13 596.8`. Des m² donneraient une médiane absurde (0,2 m²). À confirmer contre une source
ICNF avant d'afficher l'unité — un chiffre faux sur une carte de sécurité publique est pire
que pas de chiffre. Noter aussi que `icnf.burnArea` peut être `null` même quand `icnf` existe
(c'est le cas du plus gros feu actif).

### 1.3 Contenu réel à donner à Stitch

Colle ces valeurs telles quelles dans les prompts. **Ce sont de vrais incidents du 27/07/2026**,
pas des exemples inventés. Les noms longs sont le piège n°1 du design.

```
Coimbra, Soure, Samuel                            — Povoamento Florestal — Em Resolução — 195 / 55 / 1 — 26-07 17:20
Viana Do Castelo, Ponte de Lima, Ribeira          — Mato — Em Curso      —  45 / 11 / 0 — 26-07 21:36
Santarém, Benavente, Benavente                    — Mato — Conclusão     —  26 /  7 / 0 — 26-07 23:15
Viseu, Vouzela, Cambra E Carvalhal De Vermilhas   — Mato — Vigilância    —  15 /  3 / 0 — 02-07 03:04
Vila Real, Alijó, Vilar De Maçada                 — Mato — Vigilância    —   1 /  0 / 1 — 22-07 13:35
```

**Cas limites à faire tenir dans la maquette** (chacun casse un design naïf) :
- Chaîne la plus longue relevée, 60 caractères :
  `Porto, Marco de Canaveses, Paredes De Viadores E Manhuncelos`
- Un feu à `1 opérationnel / 0 véhicule / 1 moyen aérien` — le marqueur dimensionné par les
  moyens ne doit pas devenir invisible.
- Un feu vieux de **25 jours** encore en `Vigilância` (Vouzela, démarré le 02-07) à côté d'un
  feu de 40 minutes : l'affichage relatif du temps doit couvrir « há 40 min » comme « há 25 d ».
- Totaux nationaux du moment : **23 ocorrências, 349 operacionais, 98 veículos, 2 meios aéreos**.
  L'ordre de grandeur d'un jour calme — en pointe estivale, prévoir 3 chiffres partout.

---

## 2. Principes de design à imposer

À rappeler dans **chaque** prompt, sinon Stitch dérive vers le dashboard générique.

1. **La carte est l'écran, pas un widget.** Plein cadre, l'UI flotte par-dessus.
2. **Double encodage de l'information.** La couleur seule ne suffit pas : un feu « Em Curso »
   avec 300 opérationnels n'est pas un feu « Em Curso » avec 5. Couleur = statut,
   **taille du marqueur = moyens engagés**. Un daltonien doit pouvoir hiérarchiser la carte.
3. **Sobriété chromatique hors statuts.** Fond de carte désaturé, UI en gris neutres. Le rouge
   et l'orange sont *réservés* aux incendies. Un bouton primaire rouge sur une carte de feux
   est une faute de lisibilité.
4. **Lisible en plein soleil, sur mobile, en situation de stress.** Contrastes forts,
   cibles tactiles ≥ 44px, pas de gris clair sur blanc.
5. **Pas d'alarmisme décoratif.** Ni sirènes, ni flammes animées, ni compteurs rouges
   clignotants. C'est un outil d'information, pas un jeu. La donnée est déjà grave.
6. **Densité assumée.** Public cible : habitants concernés et curieux réguliers. Ils veulent
   des chiffres, pas des grands aplats vides.

---

## 3. Prompt 0 — Poser le système de design

À envoyer en premier dans Stitch. Il sert de contexte aux écrans suivants.

```text
Design system for a public-safety web app that tracks wildfires in Portugal in real time.
Audience: residents and journalists checking fire status, often on a phone, outdoors, under stress.

Visual direction: calm, dense, data-first. Editorial rather than corporate. Think a modern
newsroom data product, not a SaaS dashboard. No gradients, no glassmorphism, no drop shadows
on everything, no rounded-pill buttons everywhere.

Typography: one geometric sans for UI (Inter or similar), tabular figures for all numbers.
Clear scale: 12/14/16/20/28/40.

Neutral palette: near-black #0B0D0E, dark surface #16191C, light surface #FFFFFF,
warm grays for borders and secondary text. Support both a light and a dark theme;
dark theme is the default because the map is dark.

Status colors are FIXED by the upstream data source. Use exactly these hex values and never
invent others:
- Em Curso (active, uncontrolled): #B81E1F
- Despacho de 1º Alerta (reinforcements dispatched): #FF6E02
- Em Resolução (being brought under control): #6ABF59
- Vigilância (out, watching for flare-ups): #6ABF59
- Conclusão (out, crews still on site): #BDBDBD
Reds and oranges are reserved for fire status only. Never use them for buttons, links,
or decoration.

CRITICAL CONSTRAINT: "Em Resolução" and "Vigilância" share the SAME green, yet they mean very
different things — in one, crews are still actively fighting the fire; in the other it is out.
So colour alone must never carry the status. Design a second, redundant encoding: distinct
marker SHAPE or an icon, plus an always-visible text label. This must also make the design
readable for red-green colour blindness — do not rely on the red/green axis to rank severity.

Deliver: colour tokens, type scale, and these components — status pill (colour + shape + label),
map marker (shape by status, size by total resources engaged), incident list row, stat tile,
filter chip, segmented control, bottom sheet handle.
```

---

## 4. Prompt 1 — Écran principal : carte temps réel (desktop)

```text
Web app screen, 1440x900, dark theme. Full-bleed interactive map of mainland Portugal as the
background layer, dark desaturated basemap. All UI floats above the map.

Left: a 380px collapsible panel listing active fires, scrollable. Each row shows, in this order:
a status pill; the location on two lines (district + municipality on line 1 in medium weight,
parish on line 2 in smaller gray text — these strings are LONG, e.g. "Cambra E Carvalhal De
Vermilhas", they must truncate gracefully, not break the layout); the start time as relative
("há 3 h"); and a compact resources row with three icon+number pairs: firefighters, vehicles,
aircraft. Rows sort by severity, not by time.

Use these rows verbatim — they are real records, including their awkward lengths:
- Coimbra, Soure / Samuel — Em Resolução — há 14 h — 195 / 55 / 1
- Viana Do Castelo, Ponte de Lima / Ribeira — Em Curso — há 10 h — 45 / 11 / 0
- Porto, Marco de Canaveses / Paredes De Viadores E Manhuncelos — Conclusão — há 3 h — 12 / 4 / 0
- Viseu, Vouzela / Cambra E Carvalhal De Vermilhas — Vigilância — há 25 d — 15 / 3 / 0
- Vila Real, Alijó / Vilar De Maçada — Vigilância — há 5 d — 1 / 0 / 1

Note the range the layout must absorb: relative times from "há 40 min" to "há 25 d", and
resource counts from "1 / 0 / 1" up to three digits.

Top of the panel: a search field ("Procurar distrito, concelho ou freguesia") and a row of
filter chips: Todos / Em curso / Em resolução / Vigilância.

On the map: markers whose SHAPE encodes status and whose SIZE encodes total resources engaged,
so the Soure fire is visibly the largest and the 1-person Alijó fire is still clickable — a
minimum marker size is required. Show ONE fire as a filled translucent POLYGON outline (its real
burned perimeter) instead of a marker: only a minority of fires carry a perimeter, so the design
must handle both representations side by side on the same map. Clustered counts at low zoom.

Top-right, floating: a compact stat bar with tabular numbers — "23 ocorrências ativas",
"349 operacionais", "98 veículos", "2 meios aéreos", plus a discreet "atualizado há 2 min"
with a small live indicator. Size the tiles for 4 digits: these numbers triple at peak season.

Bottom-right: map controls (zoom, locate me, basemap toggle, layer toggle for perimeters and
for IPMA weather warnings).

Calm and dense. No red UI chrome — red belongs to the fires only.
```

---

## 5. Prompt 2 — Panneau de détail d'un incident

```text
Same app, dark theme. The detail view of a single wildfire, shown as a 460px panel sliding over
the right side of the map, the map staying visible and zoomed to the fire perimeter.

Header: large status pill "Em Resolução" (colour AND shape AND label), the title "Samuel" with
"Soure, Coimbra" underneath, and a close button.

Then, in order:
1. A prominent stat trio in tabular figures: 195 operacionais, 55 veículos, 1 meio aéreo.
2. A "Condições no local" block — this is the signature feature, give it real weight. Show the
   nearest weather station reading with an explicit provenance line "Estação de Vila Real, a
   14 km": 20.3 °C, 60 % humidade, vento 3.2 km/h N, 0 mm precipitação. Humidity and wind are
   what drive fire spread, so they must read as the two dominant values, not as a footnote.
3. A vertical timeline of the fire's lifecycle with timestamps: Despacho 17:20 → Chegada ao TO
   → Em Curso → Em Resolução. Past steps solid, current step highlighted, future steps dimmed.
   Show the elapsed total prominently ("14 h em curso").
4. An "Área ardida" block with a small horizontal stacked bar splitting burned area into
   Povoamento florestal / Agrícola / Mato. IMPORTANT: also design the EMPTY state for this
   block, because burned-area data is frequently missing — it must degrade to an honest
   "sem dados de área ardida", never to a zero or a blank.
5. A metadata list: Natureza (Povoamento Florestal), Altitude, Fonte de alerta (112),
   Início (26-07-2026, 17:20), Região (Centro / Região de Coimbra), Coordenadas.
6. A footer with "Ver no mapa", "Partilhar" and "Seguir esta zona" actions.

Keep it scannable: someone worried about their village should get the answer in 3 seconds.
```

---

## 6. Prompt 3 — Historique et statistiques

```text
Same app, but a full analytical page (not a map-first screen), dark theme, 1440x900.
Title: "Histórico" — this explores 151,000 archived incidents since 2018.

Top: a filter bar — year range slider (2018–2026), district multiselect, nature of fire,
and a segmented control: Ocorrências / Área ardida / Meios.

Main area, a grid:
- A large stacked area chart of incidents per month across years, with the current year
  highlighted against the previous years shown as thin gray reference lines.
- A choropleth map of Portugal by district, sequential single-hue scale (not red — use a
  neutral amber-to-brown ramp), with a legend.
- A horizontal bar chart of the top 10 municipalities by burned area.
- A row of four stat tiles with big tabular numbers and small year-over-year deltas:
  total de ocorrências, área ardida, média diária, maior ocorrência.

Charts must be legible in dark mode: thin gridlines, no chart junk, no 3D, no pie charts,
direct labels instead of legends where possible. Data-ink first, in the spirit of a serious
newspaper graphics desk.
```

---

## 7. Prompt 4 — Alertes et zones surveillées

```text
Same app, dark theme. A settings-like page titled "Alertas" for subscribing to geographic areas
and receiving web push notifications when a fire starts nearby.

Left: a list of the user's watched areas as cards. Each card shows a small static map thumbnail
with a circular radius drawn on it, the area name ("Casa — Marmelete, Monchique"), the radius
("10 km"), the trigger condition ("Qualquer ocorrência" / "Apenas Em Curso"), a quiet-hours
indicator, and a toggle to enable or disable it.

Right: the "Nova área" form — a map picker with a draggable pin and a radius slider (1–50 km)
showing the circle update live, a name field, a radio group for the trigger condition, and a
quiet hours time range.

Also include the browser notification permission state as an inline banner, and an example
of what the notification itself looks like: a small OS-style push card reading
"Nova ocorrência a 6 km de Casa — Marmelete, Monchique — Em Curso, 94 operacionais".

Restrained and trustworthy. This feature wakes people up at night: the UI must make the
trigger conditions unambiguous.
```

---

## 8. Prompt 5 — Mobile

```text
Mobile screen, 390x844, dark theme. Same wildfire app, map-first.

Full-screen map with fire markers. A bottom sheet in its middle detent showing a drag handle,
a one-line summary "38 ocorrências ativas · 1 247 operacionais", filter chips, and the
scrollable list of fires using the same row design as desktop.

Top: a slim floating search bar and a filter icon. Bottom-right above the sheet: a locate-me
button. Tap targets at least 44px. The sheet has three detents: peek, half, full.

Also produce the expanded detail state as a full-height sheet.
```

---

## 9. Méthode de travail dans Stitch

1. **Prompt 0 en premier**, dans un projet dédié. Les écrans suivants héritent du contexte.
2. **Un écran par prompt.** Un prompt qui demande quatre écrans donne quatre écrans médiocres.
3. **Itère par retouches ciblées** plutôt que de tout regénérer :
   « make the left panel rows denser », « the status pill is too large », « show the perimeter
   polygon on the Monchique fire instead of a dot ».
4. **Mode Experimental** (Gemini Pro) pour les écrans structurants (carte, historique), mode
   Standard pour les variantes — les générations sont contingentées.
5. **Export** : Figma pour itérer visuellement, ou le code HTML/Tailwind pour récupérer
   l'arborescence et les tokens. ⚠️ Le code Stitch est **jetable** : on en garde les tokens
   (couleurs, échelle typo, espacements) et la structure de layout, pas les composants. On les
   réécrit en React propre.

## 10. Ce qu'une maquette ne pourra pas trancher

Points à décider à l'implémentation, indépendants du visuel — je les prépare en parallèle :

- **Proxy + cache serveur obligatoire.** L'API fogos.pt est derrière Cloudflare. J'ai déclenché
  l'erreur 1015 en boucle avec `curl` par défaut, et tout est repassé au vert en envoyant un
  `User-Agent` de navigateur : **le filtrage porte sur l'identité du client, pas seulement sur
  le volume**. Deux conséquences : (1) il faut un User-Agent explicite côté serveur — idéalement
  honnête, du type `fogos-portugal/0.1 (+contact)`, plutôt qu'un navigateur usurpé ; (2) on passe
  malgré tout par une route API Next qui revalide toutes les N secondes et sert tous les clients,
  parce qu'un rate-limit peut être resserré à tout moment et qu'on ne veut pas que le site tombe
  avec.
- **Stockage de l'historique.** 151 063 incidents ne se requêtent pas à la volée sur une API
  paginée par 50. Il faut une ingestion vers une base locale (SQLite/Postgres + index géo).
- **Rendu de milliers de marqueurs.** Au-delà de ~500 points, MapLibre veut des sources
  GeoJSON avec clustering natif, pas des marqueurs DOM.
- **Fond de carte.** MapLibre a besoin de tuiles vectorielles. Sans clé API : styles CARTO
  gratuits, ou auto-hébergement Protomaps. Choix à faire (coût vs. dépendance).
- **Attribution et éthique.** Créditer visiblement fogos.pt, l'ANEPC et l'ICNF comme sources.
  C'est la contrepartie minimale d'un service public gratuit tenu par des bénévoles.
