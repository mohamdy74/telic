import type { FocusSession, Habit, HabitLog, LocalDay, Task } from "./types";

/** One day of the week grid. */
export interface WeekCell {
  day: LocalDay;
  /** Open (not done) tasks due this day, priority high → low, then createdAt. */
  openTasks: Task[];
  /** Done tasks due this day, latest completedAt first. */
  doneTasks: Task[];
  /** Live (non-archived) habits scheduled on this day. */
  habitsScheduled: number;
  /** Live habits scheduled on this day that have a done log this day. */
  habitsDone: number;
  /** Planned minutes of completed work sessions stored on this day. */
  focusMinutes: number;
  isToday: boolean;
}

export interface WeekInput {
  tasks: Task[];
  habits: Habit[];
  logs: HabitLog[];
  sessions: FocusSession[];
  /** Any day inside the week to show. */
  anchor: LocalDay;
  today: LocalDay;
  /** 0 = Sunday … 6 = Saturday. */
  weekStartsOn: number;
}

/**
 * RED stub — weekView.test.ts drives the real implementation.
 * Returns the seven days of the anchored week, oldest first.
 */
export function weekDays(anchor: LocalDay, weekStartsOn: number): LocalDay[] {
  return [];
}

/** RED stub — builds one WeekCell per day of the anchored week. */
export function buildWeek(input: WeekInput): WeekCell[] {
  return [];
}
