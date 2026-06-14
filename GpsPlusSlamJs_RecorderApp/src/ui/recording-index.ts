/**
 * Recording Coverage Index
 *
 * Builds the in-memory index that backs the map-centric recording browser:
 * for every recording in a folder, the deduplicated res-11 H3 cells its GPS
 * path crossed. The map view then clusters these per zoom level (via
 * `clusterCellsByZoom`) to draw tiles and answer "which tours cross this tile?".
 *
 * Coverage comes from one of two sources (D2 — in-memory only, no disk cache):
 *   1. The recording's `session.json` `h3Cells` field, read during metadata
 *      discovery — cheap, no GPS unzip (new recordings, Step 2).
 *   2. A legacy fallback: recordings that predate the `h3Cells` field have their
 *      GPS path read from the zip (`loadGpsPathFromBlob`) and coverage derived
 *      in memory (`gpsPathToCoverageCells`). Still no disk persistence — the
 *      persistent cache (2-B) is the documented escape hatch only if real
 *      folders prove too slow to re-scan.
 *
 * @see GpsPlusSlamJs_Docs/docs/2026-06-14-map-centric-recording-browser-and-h3-index-user-feedback.md (D2)
 */

import { loadGpsPathFromBlob } from 'gps-plus-slam-app-framework/storage/zip-reader';
import { gpsPathToCoverageCells } from 'gps-plus-slam-app-framework/geo';
import { mapWithConcurrencyLimit } from 'gps-plus-slam-app-framework/utils/concurrency';
import { createLogger } from 'gps-plus-slam-app-framework/utils/logger';
import {
  discoverScenariosFromZipMetadata,
  type SessionEntry,
} from './session-browser';

const log = createLogger('RecordingIndex');

/**
 * Maximum number of legacy zips whose GPS path is read concurrently while
 * backfilling coverage. Mirrors the metadata-scan cap in `session-browser.ts`:
 * each read uses BlobReader but a legacy backfill reads every action file, so
 * we keep concurrency bounded to avoid overwhelming browser I/O.
 */
const COVERAGE_BACKFILL_CONCURRENCY = 4;

/** A recording paired with its H3 coverage cells. */
export interface RecordingCoverage {
  /** The recording entry (filename, file handle, parsed date). */
  readonly entry: SessionEntry;
  /** Scenario name the recording was grouped under during discovery. */
  readonly scenario: string;
  /** Deduplicated res-11 H3 cells the recording's GPS path crossed. */
  readonly cells: readonly string[];
  /**
   * True when `cells` were derived from the GPS path because the recording
   * carried no `h3Cells` metadata (a legacy recording). Lets the UI surface or
   * log how much of a folder needed the slower backfill path.
   */
  readonly backfilled: boolean;
}

/**
 * Resolve the H3 coverage cells for a single recording.
 *
 * Returns the metadata `h3Cells` verbatim when present (including an empty array
 * — a recording with no GPS coverage), without touching the zip's GPS data.
 * Only when the field is absent (legacy recording) does it read the GPS path and
 * derive coverage in memory. A read failure degrades to empty coverage rather
 * than throwing, so one corrupt zip cannot abort the whole folder index.
 */
export async function loadCoverageCellsForEntry(
  entry: SessionEntry
): Promise<{ cells: string[]; backfilled: boolean }> {
  if (entry.h3Cells !== undefined) {
    return { cells: [...entry.h3Cells], backfilled: false };
  }
  try {
    const file = await entry.fileHandle.getFile();
    const path = await loadGpsPathFromBlob(file);
    return { cells: gpsPathToCoverageCells(path), backfilled: true };
  } catch (err) {
    log.warn(`Failed to backfill coverage for ${entry.filename}:`, err);
    return { cells: [], backfilled: true };
  }
}

/**
 * Build the in-memory recording-coverage index for a folder.
 *
 * Discovers all recordings via `discoverScenariosFromZipMetadata` (which already
 * reads `h3Cells` from each `session.json`), then resolves coverage for each —
 * metadata when present, in-memory GPS-path backfill for legacy recordings.
 * Nothing is written to disk (D2).
 *
 * The returned list is flat across scenarios; callers that need grouping can use
 * `RecordingCoverage.scenario`. Order is by scenario name, then by the
 * discovery order within each scenario (most-recent-first).
 */
export async function buildRecordingIndex(
  rootHandle: FileSystemDirectoryHandle
): Promise<RecordingCoverage[]> {
  const { scenarioSessions } =
    await discoverScenariosFromZipMetadata(rootHandle);

  const flat: { scenario: string; entry: SessionEntry }[] = [];
  for (const [scenario, entries] of scenarioSessions) {
    for (const entry of entries) {
      flat.push({ scenario, entry });
    }
  }

  return mapWithConcurrencyLimit(
    flat,
    COVERAGE_BACKFILL_CONCURRENCY,
    async ({ scenario, entry }) => {
      const { cells, backfilled } = await loadCoverageCellsForEntry(entry);
      return { entry, scenario, cells, backfilled };
    }
  );
}
