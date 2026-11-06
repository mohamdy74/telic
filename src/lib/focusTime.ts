import type { FocusSession, ISODate, LocalDay } from "./types";

/*
 * Pure focus-timer math. Correctness rules (see AGENTS.md):
 * - the timer NEVER counts with interval ticks; remaining time is always
 *   computed from stored timestamps (startedAt / endsAt / pausedAt) vs the
 *   current wall clock, so background tabs and sleeping phones stay correct;
 * - pausing freezes the countdown at pausedAt; resuming shifts endsAt
 *   forward by the paused duration (shiftEndsAfterResume);
 * - a session's localDay is assigned from startedAt at creation and never
 *   recomputed, so a session crossing midnight stays on its start day.
 */

/** An active session: no endedAt, not soft-deleted. */
export function isActive(s: Pick<FocusSession, "endedAt" | "deletedAt">): boolean {
  return s.endedAt === undefined && s.deletedAt === undefined;
}

/** ms left; frozen at pausedAt while paused, never negative. */
export function remainingMs(s: Pick<FocusSession, "endsAt" | "pausedAt">, now: number): number {
  const base = s.pausedAt !== undefined ? new Date(s.pausedAt).getTime() : now;
  return Math.max(0, new Date(s.endsAt).getTime() - base);
}

/**
 * True when an unpaused active session has run past its endsAt — the
 * completion trigger after a backgrounded tab or a sleeping phone.
 */
export function isOverdue(
  s: Pick<FocusSession, "endedAt" | "deletedAt" | "pausedAt" | "endsAt">,
  now: number,
): boolean {
  return isActive(s) && s.pausedAt === undefined && new Date(s.endsAt).getTime() <= now;
}

/** Pure resume: shift endsAt forward by the paused duration. */
export function shiftEndsAfterResume(endsAt: ISODate, pausedAt: ISODate, now: number): ISODate {
  return new Date(new Date(endsAt).getTime() + (now - new Date(pausedAt).getTime())).toISOString();
}

/** Long break after every 4 completed work sessions (count for today, 1-based). */
export function nextBreakMinutes(
  workCompletedToday: number,
  shortBreak: number,
  longBreak: number,
): number {
  return workCompletedToday > 0 && workCompletedToday % 4 === 0 ? longBreak : shortBreak;
}

/** Actual minutes = wall time from startedAt to endedAt (null while running). */
export function actualMinutes(s: Pick<FocusSession, "startedAt" | "endedAt">): number | null {
  if (s.endedAt === undefined) return null;
  return Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60_000);
}

/** Completed work sessions started today (drives the long-break cadence). */
export function workCompletedToday(sessions: FocusSession[], today: LocalDay): number {
  let n = 0;
  for (const s of sessions) {
    if (!s.deletedAt && s.completed && s.localDay === today && s.mode !== "break") n++;
  }
  return n;
}

/** Focus minutes today: planned minutes of completed work sessions (breaks excluded). */
export function workMinutesToday(sessions: FocusSession[], today: LocalDay): number {
  let n = 0;
  for (const s of sessions) {
    if (!s.deletedAt && s.completed && s.localDay === today && s.mode !== "break")
      n += s.plannedMinutes;
  }
  return n;
}

/** History grouping: by stored localDay (the startedAt day — never recomputed). */
export function groupByDay(sessions: FocusSession[]): Map<LocalDay, FocusSession[]> {
  const m = new Map<LocalDay, FocusSession[]>();
  for (const s of sessions) {
    if (s.deletedAt) continue;
    const list = m.get(s.localDay);
    if (list) list.push(s);
    else m.set(s.localDay, [s]);
  }
  return m;
}
