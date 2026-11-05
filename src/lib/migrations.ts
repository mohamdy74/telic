import { CURRENT_SCHEMA_VERSION } from "./types";

export type AnySnapshot = Record<string, unknown> & { meta?: { schemaVersion?: number } };
/** migrations[i] migrates a snapshot from version i to version i+1. */
export type Migration = (data: AnySnapshot) => AnySnapshot;

export const migrations: Migration[] = [
  // v0 -> v1: pre-versioned data. Ensure every collection exists as an array.
  (d) => ({
    ...d,
    tasks: Array.isArray(d.tasks) ? d.tasks : [],
    habits: Array.isArray(d.habits) ? d.habits : [],
    habitLogs: Array.isArray(d.habitLogs) ? d.habitLogs : [],
    focusSessions: Array.isArray(d.focusSessions) ? d.focusSessions : [],
    xpLedger: Array.isArray(d.xpLedger) ? d.xpLedger : [],
  }),
];

export function runMigrations(
  data: AnySnapshot,
  list: Migration[] = migrations,
  target = CURRENT_SCHEMA_VERSION,
): { data: AnySnapshot; from: number; to: number } {
  const from = data.meta?.schemaVersion ?? 0;
  if (from > target) throw new Error(`Data is from a newer version (v${from}); please update the app.`);
  let cur = data;
  for (let v = from; v < target; v++) {
    const m = list[v];
    if (!m) throw new Error(`Missing migration v${v} -> v${v + 1}`);
    cur = m(cur);
    cur = { ...cur, meta: { ...(cur.meta ?? {}), schemaVersion: v + 1 } };
  }
  return { data: cur, from, to: target };
}
