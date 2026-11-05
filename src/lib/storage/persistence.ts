import { createStore, getMany, setMany, update, get, type UseStore } from "idb-keyval";
import { STORAGE_KEYS, type StorageKey } from "../types";

/** Each storage key holds its own envelope, so writing one collection never touches the others. */
export interface Envelope<T = unknown> {
  rev: number;
  data: T;
}

let _db: UseStore | null = null;
export function db(): UseStore {
  if (!_db) _db = createStore("grove", "kv");
  return _db;
}
/** Test hook. */
export function _setDb(store: UseStore | null) {
  _db = store;
}

type Rec = { id: string; updatedAt: string };

/** Per-record last-writer-wins merge by updatedAt. Soft-deleted records carry deletedAt, so deletes merge too. */
export function mergeRecords<T extends Rec>(disk: T[], local: T[]): T[] {
  const map = new Map<string, T>();
  for (const r of disk) map.set(r.id, r);
  for (const r of local) {
    const d = map.get(r.id);
    if (!d || r.updatedAt >= d.updatedAt) map.set(r.id, r);
  }
  return [...map.values()];
}

export function mergeValue(disk: unknown, local: unknown): unknown {
  if (Array.isArray(disk) && Array.isArray(local)) return mergeRecords(disk as Rec[], local as Rec[]);
  const du = (disk as { updatedAt?: string } | undefined)?.updatedAt ?? "";
  const lu = (local as { updatedAt?: string } | undefined)?.updatedAt ?? "";
  return lu >= du ? local : disk;
}

export async function readAll(): Promise<Partial<Record<StorageKey, Envelope>>> {
  const values = await getMany<Envelope | undefined>(STORAGE_KEYS, db());
  const out: Partial<Record<StorageKey, Envelope>> = {};
  STORAGE_KEYS.forEach((k, i) => {
    if (values[i]) out[k] = values[i];
  });
  return out;
}

export async function readKey(key: StorageKey): Promise<Envelope | undefined> {
  return get<Envelope>(key, db());
}

/**
 * Atomic compare-and-write. If another tab wrote since `knownRev`, the two versions
 * are merged instead of silently overwritten. Returns what is now on disk.
 */
export async function writeKey(
  key: StorageKey,
  data: unknown,
  knownRev: number,
): Promise<{ rev: number; data: unknown; merged: boolean }> {
  let result = { rev: 0, data, merged: false };
  await update<Envelope>(
    key,
    (old) => {
      const diskRev = old?.rev ?? 0;
      const conflict = !!old && diskRev !== knownRev;
      const next = conflict ? mergeValue(old!.data, data) : data;
      result = { rev: diskRev + 1, data: next, merged: conflict };
      return { rev: diskRev + 1, data: next };
    },
    db(),
  );
  return result;
}

/** Overwrite every key unconditionally (used for first boot, migrations and import). */
export async function writeAll(snapshot: Partial<Record<StorageKey, unknown>>, prevRevs: Partial<Record<StorageKey, number>>) {
  const revs: Partial<Record<StorageKey, number>> = {};
  const entries = (Object.keys(snapshot) as StorageKey[]).map((k) => {
    revs[k] = (prevRevs[k] ?? 0) + 1;
    return [k, { rev: revs[k], data: snapshot[k] }] as [StorageKey, Envelope];
  });
  await setMany(entries, db());
  return revs;
}
