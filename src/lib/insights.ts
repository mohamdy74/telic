import type { FocusSession, Habit, HabitLog, LocalDay, Task, XpLedgerEntry } from "./types";

/*
 * RED stubs — the insights engine lands in the GREEN commit.
 * Signatures are final; bodies are placeholders so the specs fail
 * on assertions only.
 */

/** Days counted for observations: the last 28 days, today included. */
export const ACTIVE_WINDOW_DAYS = 28;

/** Minimum days with activity before any observation is allowed. */
export const MIN_ACTIVE_DAYS = 14;

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
export function windowDays(_today: LocalDay, _days: number): LocalDay[] {
  return [];
}

/** Done tasks per day, grouped by the completion day (dayStartHour honored). */
export function taskCompletionsByDay(
  _tasks: Task[],
  _opts: { today: LocalDay; days: number; dayStartHour: number; timeZone: string },
): DayPoint[] {
  return [];
}

/** Per-day habit consistency: done / (scheduled - skipped), null when nothing scheduled. */
export function habitConsistencyByDay(
  _habits: Habit[],
  _logs: HabitLog[],
  _opts: { today: LocalDay; days: number },
): HabitDayPoint[] {
  return [];
}

/** Actual minutes of completed work sessions per stored localDay. */
export function focusMinutesByDay(
  _sessions: FocusSession[],
  _opts: { today: LocalDay; days: number },
): DayPoint[] {
  return [];
}

/** Honest-claim observations with data floors; empty below the threshold. */
export function insightsReport(_input: {
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  focusSessions: FocusSession[];
  xpLedger: XpLedgerEntry[];
  today: LocalDay;
  timeZone: string;
  dayStartHour: number;
}): InsightsReport {
  return { activeDays: 0, hasAnyData: false, observations: [] };
}

