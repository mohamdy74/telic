import { runMigrations, type AnySnapshot } from "./migrations";
import {
  COLLECTION_KEYS,
  CURRENT_SCHEMA_VERSION,
  type CollectionKey,
  type Snapshot,
} from "./types";

/** Export envelope written to disk. `data` is a full store snapshot. */
export interface BackupFile {
  schemaVersion: number;
  exportedAt: string;
  data: Snapshot;
}

export type BackupErrorCode = "invalid-json" | "invalid-shape" | "newer-schema" | "empty";

export class BackupError extends Error {
  code: BackupErrorCode;
  constructor(code: BackupErrorCode) {
    super(code);
    this.name = "BackupError";
    this.code = code;
  }
}

export interface ParsedBackup {
  /** Schema version the file was written with (before any migration). */
  schemaVersion: number;
  exportedAt: string | null;
  /** Set when the file was older than the app and had to be migrated. */
  migratedFrom: number | null;
  snapshot: Snapshot;
  counts: Record<CollectionKey, number>;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Builds the export envelope. Pure. */
export function buildBackup(
  snap: Snapshot,
  exportedAt: string = new Date().toISOString(),
): BackupFile {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, exportedAt, data: snap };
}

/** tilth-export-YYYY-MM-DD.json — LOCAL date, so the name matches the user's day. */
export function backupFileName(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    "tilth-export-" +
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    ".json"
  );
}

/**
 * Validates and normalizes a backup file. PURE: never touches the store.
 * Newer files are rejected (update the app first); older files are migrated
 * here so importSnapshot() stays a dumb writer. A rejected file never
 * modifies existing data.
 */
export function parseBackup(text: string): ParsedBackup {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    throw new BackupError("invalid-json");
  }
  if (!isObj(root)) throw new BackupError("invalid-shape");

  const v = root["schemaVersion"];
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0)
    throw new BackupError("invalid-shape");
  const data = root["data"];
  if (!isObj(data)) throw new BackupError("invalid-shape");
  const exportedAt = root["exportedAt"];
  if (exportedAt !== undefined && typeof exportedAt !== "string")
    throw new BackupError("invalid-shape");
  if (v > CURRENT_SCHEMA_VERSION) throw new BackupError("newer-schema");

  // The file-level schemaVersion wins; meta may be missing (v0) or stale.
  const normalized: AnySnapshot = {
    ...data,
    meta: { ...(isObj(data["meta"]) ? data["meta"] : {}), schemaVersion: v },
  };
  let out = normalized;
  let migratedFrom: number | null = null;
  if (v < CURRENT_SCHEMA_VERSION) {
    const res = runMigrations(normalized);
    out = res.data;
    migratedFrom = res.from;
  }

  // Post-migration shape checks — an import must never write garbage.
  for (const k of COLLECTION_KEYS) {
    if (!Array.isArray(out[k])) throw new BackupError("invalid-shape");
  }
  if ("settings" in out && !isObj(out["settings"])) throw new BackupError("invalid-shape");
  if ("meta" in out && !isObj(out["meta"])) throw new BackupError("invalid-shape");

  const counts = {} as Record<CollectionKey, number>;
  let total = 0;
  for (const k of COLLECTION_KEYS) {
    const n = (out[k] as unknown[]).length;
    counts[k] = n;
    total += n;
  }
  if (total === 0) throw new BackupError("empty");

  return {
    schemaVersion: v,
    exportedAt: typeof exportedAt === "string" ? exportedAt : null,
    migratedFrom,
    snapshot: out as unknown as Snapshot,
    counts,
  };
}
