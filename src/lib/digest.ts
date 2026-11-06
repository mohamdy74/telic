import { addDays, toLocalDay } from "./dates";
import { isScheduledOn } from "./streaks";
import type { FocusSession, Habit, HabitLog, LocalDay, Task } from "./types";

/*
 * Pure digest math for the quiet morning/evening summaries. Silence is
 * the default: the digest only exists if the user turned it on, and it
 * is computed from stored data at display time — nothing is scheduled,
 * nothing is pushed from a server (Tilth is local-first).
 */

/** Everything the digest needs — pure input, no store access. */
export interface DigestState {
  tasks: Task[];
  habits: Habit[];
  logs: HabitLog[];
  sessions: FocusSession[];
  today: LocalDay;
  /** Wall-clock hour (0..23) in the user's zone — picks morning vs evening. */
  hour: number;
  dayStartHour: number;
  timeZone: string;
}

/** The morning summary: what is on the plate today. */
export interface MorningDigest {
  greeting: "morning";
  tasksDue: number;
  overdue: number;
  habitsDue: number;
  firstTask: { id: string; title: string } | null;
}

/** The evening summary: what the day actually delivered. */
export interface EveningDigest {
  greeting: "evening";
  completedToday: number;
  habitsDone: number;
  focusMinutes: number;
  stillOpen: number;
  tomorrowOpen: number;
}

const PRIORITY_RANK: Record<Task["priority"], number> = { high: 0, medium: 1, low: 2 };

function openTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.deletedAt && t.status !== "done");
}

function habitsDueToday(s: DigestState): Habit[] {
  return s.habits.filter(
    (h) => !h.deletedAt && !h.archived && isScheduledOn(h.schedule, s.today),
  );
}

/** Morning digest: open tasks due today, overdue, habits due, top task. */
export function morningDigest(s: DigestState): MorningDigest {
  const open = openTasks(s.tasks);
  const dueToday = open.filter((t) => t.dueDate === s.today);
  const overdue = open.filter((t) => t.dueDate !== undefined && t.dueDate < s.today);
  const plate = [...overdue, ...dueToday].sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
      a.createdAt.localeCompare(b.createdAt),
  );
  const first = plate[0];
  return {
    greeting: "morning",
    tasksDue: dueToday.length,
    overdue: overdue.length,
    habitsDue: habitsDueToday(s).length,
    firstTask: first ? { id: first.id, title: first.title } : null,
  };
}

/** Evening digest: the day's completed work, plus what is still ahead. */
export function eveningDigest(s: DigestState): EveningDigest {
  const open = openTasks(s.tasks);
  const completedToday = s.tasks.filter(
    (t) =>
      !t.deletedAt &&
      t.status === "done" &&
      t.completedAt !== undefined &&
      toLocalDay(new Date(t.completedAt), s.dayStartHour, s.timeZone) === s.today,
  );
  const doneHabitIds = new Set(
    s.logs.filter((l) => !l.deletedAt && l.status === "done" && l.localDay === s.today).map((l) => l.habitId),
  );
  let focusMinutes = 0;
  for (const session of s.sessions) {
    if (!session.deletedAt && session.completed && session.mode !== "break" && session.localDay === s.today) {
      focusMinutes += session.plannedMinutes;
    }
  }
  const tomorrow = addDays(s.today, 1);
  return {
    greeting: "evening",
    completedToday: completedToday.length,
    habitsDone: habitsDueToday(s).filter((h) => doneHabitIds.has(h.id)).length,
    focusMinutes,
    stillOpen: open.filter((t) => t.dueDate !== undefined && t.dueDate <= s.today).length,
    tomorrowOpen: open.filter((t) => t.dueDate === tomorrow).length,
  };
}

/** Morning before 17:00, evening from 17:00 — drives the dashboard greeting. */
export function digestFor(s: DigestState): MorningDigest | EveningDigest {
  return s.hour < 17 ? morningDigest(s) : eveningDigest(s);
}
