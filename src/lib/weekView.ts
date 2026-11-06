import { addDays, startOfWeek } from "./dates";
import { isScheduledOn } from "./streaks";
import type { FocusSession, Habit, HabitLog, LocalDay, Task } from "./types";

/*
 * Pure week-grid math for the calendar page. Everything works on STORED
 * LocalDay strings only (see AGENTS.md): a record's localDay is never
 * recomputed, so a later change of timezone or dayStartHour never
 * rewrites history.
 */

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

const PRIORITY_RANK: Record<Task["priority"], number> = { high: 0, medium: 1, low: 2 };

/** The seven days of the anchored week, oldest first. */
export function weekDays(anchor: LocalDay, weekStartsOn: number): LocalDay[] {
  const first = startOfWeek(anchor, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

/** Builds one cell per day of the anchored week. */
export function buildWeek(input: WeekInput): WeekCell[] {
  const days = weekDays(input.anchor, input.weekStartsOn);

  const byDay = new Map<LocalDay, { open: Task[]; done: Task[] }>();
  for (const day of days) byDay.set(day, { open: [], done: [] });

  for (const task of input.tasks) {
    if (task.deletedAt || task.dueDate === undefined) continue;
    const slot = byDay.get(task.dueDate);
    if (!slot) continue; // outside the anchored week
    if (task.status === "done") slot.done.push(task);
    else slot.open.push(task);
  }
  for (const slot of byDay.values()) {
    slot.open.sort(
      (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        a.createdAt.localeCompare(b.createdAt),
    );
    slot.done.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  }

  const liveHabits = input.habits.filter((h) => !h.deletedAt && !h.archived);
  const doneKeys = new Set<string>();
  for (const log of input.logs) {
    if (!log.deletedAt && log.status === "done") doneKeys.add(log.habitId + "\n" + log.localDay);
  }

  return days.map((day) => {
    const slot = byDay.get(day)!;
    const scheduled = liveHabits.filter((h) => isScheduledOn(h.schedule, day));
    let focusMinutes = 0;
    for (const session of input.sessions) {
      if (
        !session.deletedAt &&
        session.completed &&
        session.mode !== "break" &&
        session.localDay === day
      ) {
        focusMinutes += session.plannedMinutes;
      }
    }
    return {
      day,
      openTasks: slot.open,
      doneTasks: slot.done,
      habitsScheduled: scheduled.length,
      habitsDone: scheduled.filter((h) => doneKeys.has(h.id + "\n" + day)).length,
      focusMinutes,
      isToday: day === input.today,
    };
  });
}
