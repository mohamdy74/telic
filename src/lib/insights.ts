import { addDays, toLocalDay, weekdayOf } from "./dates";
import { actualMinutes } from "./focusTime";
import { isScheduledOn, logsByDay } from "./streaks";
import type { FocusSession, Habit, HabitLog, LocalDay, Task, XpLedgerEntry } from "./types";

/*
 * Pure insights engine: daily series + honest observations.
 * - series work on STORED localDays / toLocalDay(completedAt) only, never
 *   recomputing history;
 * - habit consistency follows the app convention (consistency30):
 *   done / (scheduled - skipped), skipped days leave the denominator;
 * - focus minutes are ACTUAL wall-time minutes of completed work
 *   sessions, grouped by the session's stored localDay;
 * - observations are claims with data floors (no claim below the floor),
 *   each carrying its sample size so the page can state the basis.
 */

/** Observation window: the last 28 days, today included. */
export const ACTIVE_WINDOW_DAYS = 28;

/** Minimum days with activity before any observation is allowed. */
export const MIN_ACTIVE_DAYS = 14;

const MIN_TASKS_FOR_TIME_OF_DAY = 10;
const MIN_FOCUS_SESSIONS = 6;
const MIN_FOCUS_WEEKDAYS = 3;
const MIN_SKIPS_FOR_HABIT = 3;
const TOP_BUCKET_MIN_SHARE = 0.4;

export interface DayPoint {
  day: LocalDay;
  value: number | null;
}

export interface HabitDayPoint extends DayPoint {
  scheduled: number;
  done: number;
  skipped: number;
}

export type ObservationId = "taskTimeOfDay" | "focusWeekday" | "skippedHabit";

export interface Observation {
  id: ObservationId;
  params: Record<string, string>;
  /** Sample size behind the claim (for the basis line). */
  events: number;
  activeDays: number;
}

export interface InsightsReport {
  activeDays: number;
  hasAnyData: boolean;
  observations: Observation[];
}

/** The last `days` days ending today, oldest first. */
export function windowDays(today: LocalDay, days: number): LocalDay[] {
  const out: LocalDay[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(addDays(today, -i));
  return out;
}

/** Done tasks per day, grouped by the completion day (dayStartHour honored). */
export function taskCompletionsByDay(
  tasks: Task[],
  opts: { today: LocalDay; days: number; dayStartHour: number; timeZone: string },
): DayPoint[] {
  const by = new Map<LocalDay, number>();
  for (const t of tasks) {
    if (t.deletedAt || t.status !== "done" || t.completedAt === undefined) continue;
    const day = toLocalDay(new Date(t.completedAt), opts.dayStartHour, opts.timeZone);
    by.set(day, (by.get(day) ?? 0) + 1);
  }
  return windowDays(opts.today, opts.days).map((day) => ({ day, value: by.get(day) ?? 0 }));
}

/**
 * Per-day habit consistency: done / (scheduled - skipped) in percent.
 * Skipped days leave the denominator (the consistency30 convention);
 * value is null when nothing was scheduled (or everything was skipped).
 */
export function habitConsistencyByDay(
  habits: Habit[],
  logs: HabitLog[],
  opts: { today: LocalDay; days: number },
): HabitDayPoint[] {
  const live = habits.filter((h) => !h.deletedAt && !h.archived);
  const byHabit = new Map<string, Map<LocalDay, HabitLog>>();
  for (const h of live) {
    byHabit.set(h.id, logsByDay(logs.filter((l) => l.habitId === h.id)));
  }
  return windowDays(opts.today, opts.days).map((day) => {
    let scheduled = 0;
    let done = 0;
    let skipped = 0;
    for (const h of live) {
      if (!isScheduledOn(h.schedule, day)) continue;
      scheduled++;
      const status = byHabit.get(h.id)?.get(day)?.status;
      if (status === "done") done++;
      else if (status === "skipped") skipped++;
    }
    const denom = scheduled - skipped;
    return {
      day,
      scheduled,
      done,
      skipped,
      value: denom > 0 ? Math.round((100 * done) / denom) : null,
    };
  });
}

/** Actual minutes of completed work sessions per stored localDay. */
export function focusMinutesByDay(
  sessions: FocusSession[],
  opts: { today: LocalDay; days: number },
): DayPoint[] {
  const by = new Map<LocalDay, number>();
  for (const s of sessions) {
    if (s.deletedAt || !s.completed || s.mode === "break" || s.endedAt === undefined) continue;
    const m = actualMinutes(s);
    if (m === null || m <= 0) continue;
    by.set(s.localDay, (by.get(s.localDay) ?? 0) + m);
  }
  return windowDays(opts.today, opts.days).map((day) => ({ day, value: by.get(day) ?? 0 }));
}

/** Wall-clock hour (0..23) of an ISO timestamp in the given timezone. */
function hourInTz(iso: string, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(
      new Date(iso),
    ),
  );
}

/**
 * The observations engine. A claim only appears when the data clears its
 * floor; the basis (events + active days) travels with every claim.
 */
export function insightsReport(input: {
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  focusSessions: FocusSession[];
  xpLedger: XpLedgerEntry[];
  today: LocalDay;
  timeZone: string;
  dayStartHour: number;
}): InsightsReport {
  const window = windowDays(input.today, ACTIVE_WINDOW_DAYS);
  const inWindow = new Set<LocalDay>(window);
  const doneTasks = input.tasks.filter(
    (t) => !t.deletedAt && t.status === "done" && t.completedAt !== undefined,
  );
  const workSessions = input.focusSessions.filter(
    (s) => !s.deletedAt && s.completed && s.mode !== "break" && (actualMinutes(s) ?? 0) > 0,
  );

  const active = new Set<LocalDay>();
  for (const e of input.xpLedger) {
    if (!e.deletedAt && inWindow.has(e.localDay)) active.add(e.localDay);
  }
  for (const t of doneTasks) {
    const d = toLocalDay(new Date(t.completedAt as string), input.dayStartHour, input.timeZone);
    if (inWindow.has(d)) active.add(d);
  }
  for (const l of input.habitLogs) {
    if (!l.deletedAt && inWindow.has(l.localDay)) active.add(l.localDay);
  }
  for (const s of input.focusSessions) {
    if (!s.deletedAt && inWindow.has(s.localDay)) active.add(s.localDay);
  }
  const activeDays = active.size;
  const hasAnyData =
    input.tasks.some((t) => !t.deletedAt) ||
    input.habits.some((h) => !h.deletedAt) ||
    input.habitLogs.some((l) => !l.deletedAt) ||
    input.focusSessions.some((s) => !s.deletedAt) ||
    input.xpLedger.some((e) => !e.deletedAt);

  const observations: Observation[] = [];
  if (activeDays < MIN_ACTIVE_DAYS) return { activeDays, hasAnyData, observations };

  // Time of day: the top completion bucket must clearly lead.
  const completions = doneTasks
    .map((t) => ({
      day: toLocalDay(new Date(t.completedAt as string), input.dayStartHour, input.timeZone),
      hour: hourInTz(t.completedAt as string, input.timeZone),
    }))
    .filter((c) => inWindow.has(c.day));
  if (completions.length >= MIN_TASKS_FOR_TIME_OF_DAY) {
    const buckets: { bucket: string; n: number }[] = [
      { bucket: "morning", n: completions.filter((c) => c.hour < 12).length },
      { bucket: "afternoon", n: completions.filter((c) => c.hour >= 12 && c.hour < 17).length },
      { bucket: "evening", n: completions.filter((c) => c.hour >= 17).length },
    ];
    buckets.sort((a, b) => b.n - a.n);
    const top = buckets[0];
    const second = buckets[1];
    if (top && second) {
      const share = top.n / completions.length;
      if (share >= TOP_BUCKET_MIN_SHARE && top.n > second.n) {
        observations.push({
          id: "taskTimeOfDay",
          params: { bucket: top.bucket, pct: String(Math.round(share * 100)) },
          events: completions.length,
          activeDays,
        });
      }
    }
  }

  // Best focus weekday: total actual minutes per weekday of the window.
  const windowSessions = workSessions.filter((s) => inWindow.has(s.localDay));
  if (windowSessions.length >= MIN_FOCUS_SESSIONS) {
    const sums = new Map<number, number>();
    for (const s of windowSessions) {
      const wd = weekdayOf(s.localDay);
      sums.set(wd, (sums.get(wd) ?? 0) + (actualMinutes(s) ?? 0));
    }
    if (sums.size >= MIN_FOCUS_WEEKDAYS) {
      let best = -1;
      let bestTotal = -1;
      for (let wd = 0; wd < 7; wd++) {
        const total = sums.get(wd) ?? 0;
        if (total > bestTotal) {
          bestTotal = total;
          best = wd;
        }
      }
      if (best >= 0) {
        observations.push({
          id: "focusWeekday",
          params: { weekday: String(best) },
          events: windowSessions.length,
          activeDays,
        });
      }
    }
  }

  // Most-skipped live habit in the window.
  const liveHabits = input.habits.filter((h) => !h.deletedAt && !h.archived);
  const skips = new Map<string, number>();
  for (const l of input.habitLogs) {
    if (l.deletedAt || l.status !== "skipped" || !inWindow.has(l.localDay)) continue;
    if (!liveHabits.some((h) => h.id === l.habitId)) continue;
    skips.set(l.habitId, (skips.get(l.habitId) ?? 0) + 1);
  }
  let topHabit: Habit | null = null;
  let topSkips = 0;
  for (const h of liveHabits) {
    const c = skips.get(h.id) ?? 0;
    if (c > topSkips) {
      topSkips = c;
      topHabit = h;
    }
  }
  if (topHabit && topSkips >= MIN_SKIPS_FOR_HABIT) {
    observations.push({
      id: "skippedHabit",
      params: { habit: topHabit.name },
      events: topSkips,
      activeDays,
    });
  }

  return { activeDays, hasAnyData, observations };
}
