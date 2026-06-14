# recording-index.ts

## Purpose

Builds the **in-memory recording-coverage index** that backs the map-centric recording browser: for every recording in a folder, the deduplicated res-11 H3 cells its GPS path crossed. The map view clusters these per zoom level (via `clusterCellsByZoom`) to draw tiles and answer "which tours cross this tile?".

See the plan: `GpsPlusSlamJs_Docs/docs/2026-06-14-map-centric-recording-browser-and-h3-index-user-feedback.md` (D2 — in-memory only, no disk cache).

## Public API

- `RecordingCoverage` (interface) — `{ entry: SessionEntry; scenario: string; cells: readonly string[]; backfilled: boolean }`. `backfilled` is `true` when `cells` were derived from the GPS path because the recording carried no `h3Cells` metadata (legacy recording).
- `loadCoverageCellsForEntry(entry): Promise<{ cells: string[]; backfilled: boolean }>` — resolves coverage for one recording.
  - Fast path: when `entry.h3Cells` is defined (including an empty array), returns it verbatim **without reading the zip's GPS data**.
  - Legacy fallback: when `entry.h3Cells` is `undefined`, reads the GPS path (`loadGpsPathFromBlob`) and derives coverage (`gpsPathToCoverageCells`) **in memory**.
- `buildRecordingIndex(rootHandle): Promise<RecordingCoverage[]>` — discovers all recordings (`discoverScenariosFromZipMetadata`) and resolves coverage for each, flat across scenarios.

## Invariants & assumptions

- **Empty vs. undefined `h3Cells`.** An empty array means the recording genuinely had no GPS coverage and is returned as-is (`backfilled: false`). Only `undefined` (the field is absent — a legacy recording) triggers the GPS-path backfill. Conflating the two would needlessly re-read zips with no GPS.
- **No disk cache (D2).** Backfill is purely in memory for the session. If re-scanning large _legacy_ folders proves too slow, the persistent index (plan option 2-B) is the documented escape hatch — but only if measured.
- **Defensive:** a zip that cannot be read degrades to empty coverage (`backfilled: true`) with a warning, so one corrupt recording cannot abort the whole folder index.
- **Bounded concurrency:** legacy backfills read every action file, so reads are capped at `COVERAGE_BACKFILL_CONCURRENCY` (4) via `mapWithConcurrencyLimit`, mirroring the metadata-scan cap in `session-browser.ts`.

## Examples

```ts
const index = await buildRecordingIndex(rootHandle);
// index: RecordingCoverage[] — one per recording, with res-11 coverage cells.
// The map view then clusters per zoom:
const tilesAtZoom = clusterCellsByZoom(
  index.flatMap((r) => r.cells),
  targetRes
);
```

## Tests

- `recording-index.test.ts` — `loadCoverageCellsForEntry` (metadata fast path with no file read, empty-vs-undefined semantics, legacy GPS-path backfill against `produceTestZip`, corrupt-zip degradation) and `buildRecordingIndex` (mixed metadata/legacy folder, empty folder). The legacy-path test pins that derived cells equal `gpsPathToCoverageCells` of the known recorded GPS coordinates.
