import type { FocusSession, Habit, HabitLog, LocalDay, Task } from "./types";

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

/**
 * RED stub — digest.test.ts drives the real implementation.
 * Morning digest: open tasks due today, overdue, habits due, top task.
 */
export function morningDigest(_s: DigestState): MorningDigest {
  return { greeting: "morning", tasksDue: 0, overdue: 0, habitsDue: 0, firstTask: null };
}

/** RED stub — evening digest of the day's completed work. */
export function eveningDigest(_s: DigestState): EveningDigest {
  return {
    greeting: "evening",
    completedToday: 0,
    habitsDone: 0,
    focusMinutes: 0,
    stillOpen: 0,
    tomorrowOpen: 0,
  };
}

/** RED stub — morning before 17:00, evening from 17:00. */
export function digestFor(_s: DigestState): MorningDigest | EveningDigest {
  return morningDigest(_s);
}
