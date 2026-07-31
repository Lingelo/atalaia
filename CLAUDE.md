# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # dev server (port 5173), mounts the upstream proxy
npm run lint             # tsc --noEmit — the project's ONLY automated safety net
npm run build            # production build (VITE_BASE=/atalaia/ in CI)
npm run preview          # serves dist/ at the root

npm run build:data       # build:firms then build:incidents
npm run build:incidents  # ~8 upstream requests, a few seconds
npm run build:firms      # ~21 MB of NASA CSV, tens of seconds
```

**There is no test suite.** No vitest, no jest, no end-to-end tests. `npm run lint` is the only automated check, and CI runs nothing else. Verifying behaviour therefore means driving the app in a browser — that is the only way regressions get caught here, and it needs doing.

## Founding constraint: two data paths

Neither `api.fogos.pt` nor NASA FIRMS returns CORS headers on GET. A static site cannot query them from the browser. Hence two paths, in `src/api/incidents.ts` (`fetchOperationalIncidents`):

- **In development** — live calls: `fogos.pt` through the Vite proxy (`vite.config.ts` + `src/server/upstreamProxy.ts`), the three Spanish services directly (those do send CORS headers).
- **In production** — reads `/data/incidents.json`, precomputed in CI by `scripts/build-*.ts`.

**Keep this in mind at all times: dev and prod do not run the same fetching code.** A bug in one is invisible in the other. Browser-side faults (caching, CORS, aborted requests) only surface in dev; faults in the precomputed dataset or its format only surface in prod.

`public/data/` is **git-ignored**. A fresh clone has no data at all: run `npm run build:data`, otherwise production reads missing files. A stale file in an older format will break rendering — check its shape before concluding the code is at fault.

## The editorial principle that governs the rest

The project keeps two natures of data strictly apart, and many code decisions only make sense through that lens:

| | Operational incidents | Satellite detections |
|---|---|---|
| Source | civil protection services | NASA FIRMS (VIIRS) |
| Status | verified on the ground | **unconfirmed** |
| Shape | **solid** disc | **hollow** ring |
| Colour | status palette, **vivid** warm range | **ember**, darker and desaturated |
| Totals | summed | **never** |

Shape carries the distinction (it survives colour blindness); colour reinforces it. Never fill those rings, and never push the ember range toward vivid red: that would erase the boundary between an orbital measurement and a verified fire.

A corollary applied twice in July 2026: **a scope only appears in the UI if some service actually publishes its incidents.** The France and World scopes were both added and then removed for this reason; `ViewScope` in `src/types.ts` keeps the full rationale.

## Data invariants

- **`null` is never `0`.** Bombers de la Generalitat publish no personnel counts. `sumPublished` (`src/lib/scope.ts`) skips `null` instead of counting it as zero, and the UI shows a dash. Rendering "0 personnel" would depict fires that nobody is fighting.
- **`personnelIsPartial`** flags an incomplete count — Spanish services report brigades whose headcount is not published. The UI then prefixes the number with `≥`.
- **`SourceReport` / `SourceStatusBadge`** exist to separate "no fires" from "service unreachable". That is this application's most dangerous failure mode: it would turn a technical outage into good news. Spain has **no** national service — three autonomous communities publish, fourteen do not — and the UI must say so.
- **`src/lib/status.ts` is the single status registry.** The four services publish their states in four different vocabularies; all are mapped to a canonical phase carrying its colour, its `ongoing` flag and its `severity`. Never hard-code a status colour anywhere else.

## Architecture notes

**Shared filters** — `src/lib/filters.ts` holds the predicate, applied once in `App` to produce `visibleIncidents`, consumed by both the map **and** the list. They used to show two different sets. Any new filter dimension must go through it, with its state living in `App`.

**Map (`src/components/InteractiveMap.tsx`)** — Leaflet driven imperatively through refs. Sensitive points:
- The init effect's cleanup **must reset every layer ref to `null`**. Under StrictMode, effects are re-run within the same component instance, so with the same refs: a surviving ref makes the code believe a layer is already attached, and it is never added to the new map.
- Leaflet only listens to `window.resize`, never to its container. A `ResizeObserver` calls `invalidateSize` — without it, collapsing the sidebar leaves a band with no tiles.
- Density surface switches to individual rings at `DETAIL_ZOOM` (9). Below it, `SatelliteHeatLayer` (a hand-written canvas Leaflet layer); above it, `circleMarker`s on a **canvas renderer**, never SVG — the dataset holds ~142,000 hotspots.
- `SpatialIndex` (`src/components/map/spatialIndex.ts`) avoids testing every hotspot on each render.

**i18n (`src/i18n/`)** — `pt.ts` is the **reference** dictionary: it defines the `Dictionary` and `TranslationKey` types, the others implement it. Adding a key to `pt` without porting it to `es` and `en` breaks type-checking, which is intended. Three locales only; French was removed.

**Deployment** — GitHub Actions to GitHub Pages, served under `/atalaia/` (hence `VITE_BASE`). Cron every 10 minutes. The workflow deliberately splits FIRMS (`continue-on-error`, hourly cache) from incidents (blocking): an outage of the optional satellite layer must not prevent publishing the incidents. The workflow triggers **only** on `push: main` — pull requests are not checked.

## Conventions

Code comments are written **in French** and explain the **why**, not the how: the upstream constraint, the option that was rejected, what breaks if it is reverted. Pitfalls are marked with `⚠️`. This density is deliberate — most upstream endpoints have no documentation at all, and their traps would otherwise show up as a wrong number on screen. When a decision is reversed, its rationale stays in the code rather than being deleted.

Write new comments in French to match. This file is the exception, being addressed to agents.

**`docs/data-sources.md` is the reference for upstream sources**: URLs, quotas, formats and pitfalls, all verified by probing the services rather than trusting documentation. Read it before touching `src/api/`. Two ArcGIS traps that cost real time: `outSR=4326` is mandatory on every request (otherwise coordinates land off the coast of Africa), and `f=geojson` is rejected by INFOCA where `f=json` works.

`docs/stitch-brief.md` is an **earlier** design brief: it assumes Next.js and MapLibre, which are not the stack in use (Vite + React + Leaflet). Read it for visual intent, not for technical guidance.

`workers/fogos-proxy.js` is an **optional** Cloudflare Worker, not currently deployed and not referenced by CI: it would remove the latency of the precomputed dataset. See `VITE_FOGOS_PROXY`.
