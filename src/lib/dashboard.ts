import { addDays } from "./dates";
import { isScheduledOn } from "./streaks";
import type { Habit, HabitLog, LocalDay, Task } from "./types";

/*
 * Pure dashboard math. Everything compares STORED LocalDay strings against
 * the passed-in today (see AGENTS.md): a record's dueDate/localDay is never
 * recomputed here, so timezone or dayStartHour changes never rewrite history.
 */

const PRIORITY_RANK: Record<Task["priority"], number> = { high: 0, medium: 1, low: 2 };

/**
 * Open tasks due today or overdue, highest priority first. Within one
 * priority the earlier dueDate comes first, so overdue items lead the list.
 */
export function todaysPriorities(tasks: Task[], today: LocalDay): Task[] {
  return tasks
    .filter(
      (x) => !x.deletedAt && x.status !== "done" && x.dueDate !== undefined && x.dueDate <= today,
    )
    .sort((a, b) => {
      const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (p !== 0) return p;
      const byDate = (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
      if (byDate !== 0) return byDate;
      return a.createdAt.localeCompare(b.createdAt);
    });
}

/** Open tasks due strictly after today, within the next days (inclusive). Earliest first. */
export function upcomingDeadlines(tasks: Task[], today: LocalDay, days = 7): Task[] {
  const limit = addDays(today, days);
  return tasks
    .filter(
      (x) =>
        !x.deletedAt &&
        x.status !== "done" &&
        x.dueDate !== undefined &&
        x.dueDate > today &&
        x.dueDate <= limit,
    )
    .sort((a, b) => {
      const byDate = (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
      if (byDate !== 0) return byDate;
      const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (p !== 0) return p;
      return a.createdAt.localeCompare(b.createdAt);
    });
}

export interface HabitDue {
  habit: Habit;
  done: boolean;
}

/** Non-archived habits scheduled today, with their done-today flag. */
export function habitsDueToday(habits: Habit[], logs: HabitLog[], today: LocalDay): HabitDue[] {
  const doneIds = new Set(
    logs
      .filter((l) => !l.deletedAt && l.localDay === today && l.status === "done")
      .map((l) => l.habitId),
  );
  return habits
    .filter((h) => !h.deletedAt && !h.archived && isScheduledOn(h.schedule, today))
    .map((habit) => ({ habit, done: doneIds.has(habit.id) }))
    .sort((a, b) => a.habit.createdAt.localeCompare(b.habit.createdAt));
}

export interface DailyProgress {
  done: number;
  total: number;
  /** done / total; null when nothing is due today — the UI shows a friendly state instead of dividing by zero. */
  ratio: number | null;
}

/**
 * Today's plate: (tasks due today that are done + habits due today that are
 * done) / (tasks due today + habits due today). Both sides of the fraction
 * are scoped to today's plate, so the ratio always stays within 0..1 and a
 * task finished early (already done before its due day) still counts.
 */
export function dailyProgress(
  tasks: Task[],
  habits: Habit[],
  logs: HabitLog[],
  today: LocalDay,
): DailyProgress {
  const dueHabits = habitsDueToday(habits, logs, today);
  const tasksDue = tasks.filter((x) => !x.deletedAt && x.dueDate === today);
  const doneTasks = tasksDue.filter((x) => x.status === "done").length;
  const doneHabits = dueHabits.filter((h) => h.done).length;
  const done = doneTasks + doneHabits;
  const total = tasksDue.length + dueHabits.length;
  return { done, total, ratio: total === 0 ? null : done / total };
}
