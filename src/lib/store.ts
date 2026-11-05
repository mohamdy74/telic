import { create } from "zustand";
import { currentTimeZone, defaultWeekStartsOn, toLocalDay } from "./dates";
import { runMigrations, type AnySnapshot } from "./migrations";
import { nextOccurrence } from "./recurrence";
import { shiftEndsAfterResume } from "./focusTime";
import { evaluateAchievements, type AchievementState } from "./achievements";
import { computeChallengeGrants } from "./challenges";
import { awardXp, revokeXp, totalsFromLedger, type AwardEvent } from "./rewards";
import { readAll, readKey, writeAll, writeKey, mergeValue } from "./storage/persistence";
import {
  COLLECTION_KEYS,
  CURRENT_SCHEMA_VERSION,
  STORAGE_KEYS,
  type AchievementUnlock,
  type CollectionKey,
  type FocusSession,
  type Habit,
  type HabitLog,
  type Meta,
  type Settings,
  type Snapshot,
  type StorageKey,
  type Task,
  type XpLedgerEntry,
} from "./types";

const nowIso = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

export function defaultSettings(language: "en" | "ar" = "en"): Settings {
  return {
    language,
    theme: "dark",
    accent: "moss",
    dayStartHour: 0,
    weekStartsOn: defaultWeekStartsOn(language),
    dashboardCards: { priorities: true, progress: true, deadlines: true, habits: true, focus: true, level: true, achievements: true },
    dailyFocusTargetMinutes: 100,
    updatedAt: nowIso(),
  };
}

function emptySnapshot(): Snapshot {
  const t = nowIso();
  return {
    tasks: [], habits: [], habitLogs: [], focusSessions: [], xpLedger: [], achievements: [],
    shopItems: [], purchases: [],
    settings: defaultSettings(),
    meta: { schemaVersion: CURRENT_SCHEMA_VERSION, createdAt: t, updatedAt: t },
  };
}

interface StoreState extends Snapshot {
  ready: boolean;
  error: string | null;
  persisted: boolean | null; // navigator.storage.persist() result
  revs: Partial<Record<StorageKey, number>>;
  pending: StorageKey[];
  lastSyncAt: string | null;
  lastMergeAt: string | null;
}

export const useStore = create<StoreState>(() => ({
  ...emptySnapshot(),
  ready: false,
  error: null,
  persisted: null,
  revs: {},
  pending: [],
  lastSyncAt: null,
  lastMergeAt: null,
}));

/* ---------------- write scheduling (debounced, per key) ---------------- */

const DEBOUNCE_MS = 250;
const timers = new Map<StorageKey, ReturnType<typeof setTimeout>>();
// Cloudflare Workers (workerd) forbids generating random values in the global
// scope, so the tab id is created lazily on first use, inside handlers.
let cachedTabId: string | null = null;
function tabId(): string {
  if (cachedTabId === null) {
    cachedTabId = typeof crypto !== "undefined" && "randomUUID" in crypto ? uid() : "tab";
  }
  return cachedTabId;
}
let channel: BroadcastChannel | null = null;

function schedule(key: StorageKey) {
  const s = useStore.getState();
  if (!s.pending.includes(key)) useStore.setState({ pending: [...s.pending, key] });
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => void flushKey(key), DEBOUNCE_MS));
}

async function flushKey(key: StorageKey) {
  timers.delete(key);
  const s = useStore.getState();
  try {
    const res = await writeKey(key, s[key], s.revs[key] ?? 0);
    const after = useStore.getState();
    const stillDirty = timers.has(key); // edited again while writing
    useStore.setState({
      revs: { ...after.revs, [key]: res.rev },
      pending: stillDirty ? after.pending : after.pending.filter((k) => k !== key),
      ...(res.merged && !stillDirty ? { [key]: res.data } : {}),
      ...(res.merged ? { lastMergeAt: nowIso() } : {}),
    } as Partial<StoreState>);
    channel?.postMessage({ type: "changed", key, rev: res.rev, from: tabId() });
  } catch (e) {
    useStore.setState({ error: String(e) });
  }
}

export async function flushAll() {
  await Promise.all([...timers.keys()].map((k) => { clearTimeout(timers.get(k)); return flushKey(k); }));
}

/* ---------------- boot (call after hydration only) ---------------- */

let booted = false;
export async function bootStore() {
  if (booted || typeof window === "undefined") return;
  booted = true;
  try {
    const envs = await readAll();
    const revs: Partial<Record<StorageKey, number>> = {};
    const raw: AnySnapshot = {};
    for (const k of STORAGE_KEYS) {
      if (envs[k]) {
        (raw as Record<string, unknown>)[k] = envs[k]!.data;
        revs[k] = envs[k]!.rev;
      }
    }
    let snap: Snapshot;
    if (!envs.meta) {
      // first run (or pre-versioned data): migrate whatever exists from v0
      const fresh = emptySnapshot();
      const migrated = Object.keys(raw).length ? runMigrations(raw).data : {};
      snap = { ...fresh, ...(migrated as Partial<Snapshot>), meta: fresh.meta };
      if (!raw["settings"]) snap.settings = defaultSettings(navigator.language?.startsWith("ar") ? "ar" : "en");
      Object.assign(revs, await writeAll(snap, revs));
    } else if ((raw.meta as Snapshot["meta"]).schemaVersion < CURRENT_SCHEMA_VERSION) {
      const { data } = runMigrations(raw);
      snap = { ...emptySnapshot(), ...(data as Partial<Snapshot>) };
      snap.meta = { ...snap.meta, updatedAt: nowIso() };
      Object.assign(revs, await writeAll(snap, revs));
    } else {
      snap = { ...emptySnapshot(), ...(raw as Partial<Snapshot>) };
    }
    useStore.setState({ ...snap, revs, ready: true, lastSyncAt: nowIso() });
  } catch (e) {
    useStore.setState({ error: String(e), ready: true });
  }

  applyBonusChecks();

  // multi-tab sync
  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel("tilth-sync");
    channel.onmessage = (ev) => {
      const msg = ev.data as { type: string; key: StorageKey; rev: number; from: string };
      if (msg.from === tabId()) return;
      if (msg.type === "changed") void pullKey(msg.key);
      if (msg.type === "reload-all") window.location.reload();
    };
  }
  window.addEventListener("pagehide", () => void flushAll());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushAll();
  });

  // ask for durable storage once
  try {
    const p = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
    useStore.setState({ persisted: p || (navigator.storage?.persist ? await navigator.storage.persist() : false) });
  } catch {
    useStore.setState({ persisted: false });
  }
}

async function pullKey(key: StorageKey) {
  const env = await readKey(key);
  if (!env) return;
  const s = useStore.getState();
  if ((s.revs[key] ?? 0) >= env.rev) return;
  const dirty = s.pending.includes(key);
  // keep our unsaved edits: merge them on top; the pending write will reconcile on disk
  const data = dirty ? mergeValue(env.data, s[key]) : env.data;
  useStore.setState({ [key]: data, revs: { ...s.revs, [key]: env.rev }, lastSyncAt: nowIso() } as Partial<StoreState>);
}

/* ---------------- generic helpers ---------------- */

function setCollection<K extends CollectionKey>(key: K, fn: (list: Snapshot[K]) => Snapshot[K]) {
  useStore.setState({ [key]: fn(useStore.getState()[key]) } as Partial<StoreState>);
  schedule(key);
}

export function todayLocal(): string {
  return toLocalDay(new Date(), useStore.getState().settings.dayStartHour, currentTimeZone());
}

const live = <T extends { deletedAt?: string | undefined }>(l: T[]) => l.filter((r) => !r.deletedAt);

/* ---------------- selectors ---------------- */

export const selectTasks = (s: StoreState) => live(s.tasks);
export const selectHabits = (s: StoreState) => live(s.habits).filter((h) => !h.archived);
export const selectHabitLogs = (s: StoreState) => live(s.habitLogs);
export const selectFocusSessions = (s: StoreState) => live(s.focusSessions);
export const selectXpLedger = (s: StoreState) => live(s.xpLedger);
export const selectSettings = (s: StoreState) => s.settings;
export const selectTotals = (s: StoreState) => {
  const totals = totalsFromLedger(s.xpLedger);
  return { xp: totals.xp, coins: totals.coins };
};

/* ---------------- rewards (single wiring point) ---------------- */

/**
 * The ONE service function wiring the pure rewards engine (src/lib/rewards.ts)
 * into the store. Task complete/reopen, habit log/unlog and focus end all flow
 * through here; no component ever calls the engine or writes xpLedger.
 */
type RewardEvent =
  | { kind: "task-completed"; task: Task & { completedAt: string }; localDay: string }
  | { kind: "task-reopened"; taskId: string }
  | { kind: "habit-logged"; habitId: string; localDay: string; status: HabitLog["status"] }
  | { kind: "habit-unlogged"; habitId: string; localDay: string }
  | { kind: "focus-ended"; session: FocusSession };

function applyRewardEvent(event: RewardEvent) {
  const state = useStore.getState();
  let award: AwardEvent | null = null;
  let revoke: { sourceType: "task" | "habit" | "focus"; sourceId: string; localDay?: string | undefined } | null =
    null;

  if (event.kind === "task-completed") {
    award = { kind: "task-completed", task: event.task, localDay: event.localDay };
  } else if (event.kind === "task-reopened") {
    revoke = { sourceType: "task", sourceId: event.taskId };
  } else if (event.kind === "habit-logged") {
    if (event.status === "done") {
      award = { kind: "habit-done", habitId: event.habitId, localDay: event.localDay };
    } else {
      revoke = { sourceType: "habit", sourceId: event.habitId, localDay: event.localDay };
    }
  } else if (event.kind === "habit-unlogged") {
    revoke = { sourceType: "habit", sourceId: event.habitId, localDay: event.localDay };
  } else if (event.session.completed && event.session.mode !== "break") {
    award = { kind: "focus-completed", session: event.session };
  } else {
    // incomplete or break sessions never keep an award
    revoke = { sourceType: "focus", sourceId: event.session.id };
  }

  if (award) {
    const res = awardXp(award, state.xpLedger);
    if (res.entry) xp.add(res.entry);
  } else if (revoke) {
    const doomed = revokeXp(revoke, state.xpLedger);
    if (doomed.length > 0) {
      const t = nowIso();
      const ids = new Set(doomed.map((e) => e.id));
      setCollection("xpLedger", (l) => l.map((e) => (ids.has(e.id) ? { ...e, deletedAt: t, updatedAt: t } : e)));
    }
  }

  applyBonusChecks();
}

/** Pure state slice for achievement predicates and challenge progress. */
export function progressState(s = useStore.getState()): AchievementState {
  return {
    today: todayLocal(),
    timeZone: currentTimeZone(),
    weekStartsOn: s.settings.weekStartsOn,
    dailyFocusTargetMinutes: s.settings.dailyFocusTargetMinutes,
    tasks: s.tasks,
    habits: s.habits,
    habitLogs: s.habitLogs,
    focusSessions: s.focusSessions,
    xpLedger: s.xpLedger,
    lastExportedAt: s.meta.lastExportedAt,
  };
}

/**
 * The ONE bonus checkpoint: evaluates achievements over already-validated
 * data, stores new unlocks once, and grants completed-challenge coin
 * bonuses (coins-only ledger entries, never XP). Called after every reward
 * event, after an export stamp and once at the end of boot — never from
 * components.
 */
function applyBonusChecks() {
  const s = useStore.getState();
  const ps = progressState();
  const fresh = evaluateAchievements(ps, s.achievements);
  if (fresh.length > 0) {
    const t = nowIso();
    setCollection("achievements", (l) => [
      ...l,
      ...fresh.map((id) => ({
        id: uid(),
        achievementId: id,
        unlockedAt: t,
        localDay: todayLocal(),
        createdAt: t,
        updatedAt: t,
      })),
    ]);
  }
  for (const grant of computeChallengeGrants(ps)) xp.add(grant);
}

/* ---------------- actions ---------------- */


type NewTask = Pick<Task, "title"> & Partial<Omit<Task, "id" | "createdAt" | "updatedAt">>;

export const tasks = {
  add(input: NewTask): Task {
    const t = nowIso();
    const order = Math.max(0, ...useStore.getState().tasks.map((x) => x.kanbanOrder)) + 1;
    const task: Task = { priority: "medium", tags: [], subtasks: [], status: "todo", kanbanOrder: order, ...input, id: uid(), createdAt: t, updatedAt: t };
    if (task.recurrence && task.seriesId === undefined) task.seriesId = uid();
    setCollection("tasks", (l) => [...l, task]);
    return task;
  },
  update(id: string, patch: Partial<Omit<Task, "id" | "createdAt">>) {
    setCollection("tasks", (l) => l.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: nowIso() } : x)));
  },
  /** Completes a task; if recurring, creates only the NEXT instance (same seriesId). */
  complete(id: string): Task | undefined {
    const task = useStore.getState().tasks.find((x) => x.id === id);
    if (!task || task.status === "done") return;
    const t = nowIso();
    tasks.update(id, { status: "done", completedAt: t });
    applyRewardEvent({
      kind: "task-completed",
      task: { ...task, status: "done", completedAt: t },
      localDay: toLocalDay(new Date(t), useStore.getState().settings.dayStartHour, currentTimeZone()),
    });
    if (task.recurrence) {
      const base = task.dueDate ?? todayLocal();
      const { id: _i, createdAt: _c, updatedAt: _u, completedAt: _d, ...rest } = task;
      return tasks.add({ ...rest, status: "todo", dueDate: nextOccurrence(task.recurrence, base), subtasks: task.subtasks.map((s) => ({ ...s, id: uid(), done: false })) });
    }
    return undefined;
  },
  reopen(id: string) {
    tasks.update(id, { status: "todo", completedAt: undefined });
    applyRewardEvent({ kind: "task-reopened", taskId: id });
  },
  remove(id: string) {
    tasks.update(id, { deletedAt: nowIso() });
  },
  restore(id: string) {
    tasks.update(id, { deletedAt: undefined });
  },
  /** Reassigns kanbanOrder to match the given order (ids of one kanban column). */
  reorder(orderedIds: string[]) {
    const rank = new Map(orderedIds.map((id, i) => [id, i] as const));
    const t = nowIso();
    setCollection("tasks", (l) => l.map((x) => (rank.has(x.id) ? { ...x, kanbanOrder: rank.get(x.id)!, updatedAt: t } : x)));
  },
};

export const habits = {
  add(name: string, schedule: Habit["schedule"]): Habit {
    const t = nowIso();
    const h: Habit = { id: uid(), name, schedule, archived: false, createdAt: t, updatedAt: t };
    setCollection("habits", (l) => [...l, h]);
    return h;
  },
  update(id: string, patch: Partial<Omit<Habit, "id" | "createdAt">>) {
    setCollection("habits", (l) => l.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: nowIso() } : x)));
  },
  remove(id: string) {
    habits.update(id, { deletedAt: nowIso() });
  },
  /** One log per habit per localDay; logging again replaces the status. */
  log(habitId: string, status: HabitLog["status"], localDay = todayLocal()) {
    const t = nowIso();
    setCollection("habitLogs", (l) => {
      const existing = l.find((x) => x.habitId === habitId && x.localDay === localDay && !x.deletedAt);
      if (existing) return l.map((x) => (x === existing ? { ...x, status, updatedAt: t } : x));
      return [...l, { id: uid(), habitId, localDay, status, createdAt: t, updatedAt: t }];
    });
    applyRewardEvent({ kind: "habit-logged", habitId, localDay, status });
  },
  unlog(habitId: string, localDay = todayLocal()) {
    const t = nowIso();
    setCollection("habitLogs", (l) => l.map((x) => x.habitId === habitId && x.localDay === localDay && !x.deletedAt ? { ...x, deletedAt: t, updatedAt: t } : x));
    applyRewardEvent({ kind: "habit-unlogged", habitId, localDay });
  },
};

export const focus = {
  start(mode: FocusSession["mode"], plannedMinutes: number, linkedTaskId?: string): FocusSession {
    const now = new Date();
    const t = now.toISOString();
    const s: FocusSession = {
      id: uid(), mode, plannedMinutes, startedAt: t, endsAt: new Date(now.getTime() + plannedMinutes * 60_000).toISOString(),
      completed: false, distractions: [], linkedTaskId, localDay: todayLocal(), createdAt: t, updatedAt: t,
    };
    setCollection("focusSessions", (l) => [...l, s]);
    return s;
  },
  distraction(id: string) {
    const t = nowIso();
    setCollection("focusSessions", (l) => l.map((x) => (x.id === id ? { ...x, distractions: [...x.distractions, { at: t }], updatedAt: t } : x)));
  },
  /** Freezes the countdown; endsAt is shifted on resume (pure helper). */
  pause(id: string) {
    const t = nowIso();
    setCollection("focusSessions", (l) => l.map((x) => (x.id === id && x.endedAt === undefined ? { ...x, pausedAt: t, updatedAt: t } : x)));
  },
  resume(id: string) {
    const s = useStore.getState().focusSessions.find((x) => x.id === id);
    if (!s || s.endedAt !== undefined || s.pausedAt === undefined) return;
    const endsAt = shiftEndsAfterResume(s.endsAt, s.pausedAt, Date.now());
    setCollection("focusSessions", (l) => l.map((x) => (x.id === id ? { ...x, endsAt, pausedAt: undefined, updatedAt: nowIso() } : x)));
  },
  end(id: string, completed: boolean) {
    const existing = useStore.getState().focusSessions.find((x) => x.id === id);
    const t = nowIso();
    setCollection("focusSessions", (l) => l.map((x) => (x.id === id ? { ...x, endedAt: t, completed, updatedAt: t } : x)));
    if (existing && existing.endedAt === undefined) {
      applyRewardEvent({ kind: "focus-ended", session: { ...existing, endedAt: t, completed } });
    }
  },
};

export const xp = {
  add(entry: Omit<XpLedgerEntry, "id" | "createdAt" | "updatedAt" | "localDay"> & { localDay?: string }) {
    const t = nowIso();
    const e: XpLedgerEntry = { localDay: todayLocal(), ...entry, id: uid(), createdAt: t, updatedAt: t };
    setCollection("xpLedger", (l) => [...l, e]);
    return e;
  },
};

export const settings = {
  update(patch: Partial<Omit<Settings, "updatedAt">>) {
    useStore.setState({ settings: { ...useStore.getState().settings, ...patch, updatedAt: nowIso() } });
    schedule("settings");
  },
};

/** Meta writes (e.g. lastExportedAt for the backup reminder). */
export const metaActions = {
  update(patch: Partial<Omit<Meta, "updatedAt">>) {
    useStore.setState({ meta: { ...useStore.getState().meta, ...patch, updatedAt: nowIso() } });
    schedule("meta");
    if (patch.lastExportedAt !== undefined) applyBonusChecks();
  },
};

/* ---------------- import / export / reset ---------------- */

export function exportSnapshot(): Snapshot {
  const s = useStore.getState();
  const out = {} as Record<StorageKey, unknown>;
  for (const k of STORAGE_KEYS) out[k] = s[k];
  return out as unknown as Snapshot;
}

/** Imports a backup (any older schema version is migrated first) and replaces all data. */
export async function importSnapshot(input: unknown) {
  if (!input || typeof input !== "object") throw new Error("Invalid backup file");
  const { data } = runMigrations(input as AnySnapshot);
  const snap: Snapshot = { ...emptySnapshot(), ...(data as Partial<Snapshot>) };
  snap.meta = { ...snap.meta, schemaVersion: CURRENT_SCHEMA_VERSION, updatedAt: nowIso() };
  await replaceAll(snap);
}

export async function resetAll() {
  await replaceAll({ ...emptySnapshot(), settings: { ...useStore.getState().settings, updatedAt: nowIso() } });
}

async function replaceAll(snap: Snapshot) {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  const envs = await readAll();
  const prev: Partial<Record<StorageKey, number>> = {};
  for (const k of STORAGE_KEYS) prev[k] = envs[k]?.rev ?? 0;
  const revs = await writeAll(snap, prev);
  useStore.setState({ ...snap, revs, pending: [] });
  channel?.postMessage({ type: "reload-all", from: tabId() });
}

/* ---------------- dev seed ---------------- */

export function seedSampleData() {
  const today = todayLocal();
  const plus = (n: number) => { const d = new Date(today + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  tasks.add({ title: "Plan the week", priority: "high", dueDate: today, tags: ["planning"] });
  tasks.add({ title: "Reply to emails", priority: "medium", dueDate: today, recurrence: { freq: "daily", interval: 1 } });
  tasks.add({ title: "Read 20 pages", priority: "low", dueDate: plus(1), tags: ["reading"], subtasks: [{ id: uid(), title: "Chapter 3", done: false }] });
  tasks.add({ title: "Pay rent", priority: "high", dueDate: plus(-1), recurrence: { freq: "monthly", interval: 1 } });
  const h1 = habits.add("Drink water", { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] });
  const h2 = habits.add("Exercise", { type: "custom", days: [0, 2, 4] });
  habits.log(h1.id, "done", plus(-1));
  habits.log(h1.id, "done", today);
  habits.log(h2.id, "skipped", plus(-1));
  const s = focus.start("pomodoro", 25);
  focus.end(s.id, true); // XP is awarded automatically through applyRewardEvent
}

export { COLLECTION_KEYS };
