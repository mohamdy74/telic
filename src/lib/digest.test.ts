import { describe, expect, it } from "vitest";
import { digestFor, eveningDigest, morningDigest, type DigestState } from "./digest";
import type { FocusSession, Habit, HabitLog, LocalDay, Task } from "./types";

const TODAY = "2026-11-06";
const TZ = "Africa/Cairo";
const stamp = "2026-11-06T08:00:00.000Z";

const mkTask = (over: {
  id: string;
  priority?: Task["priority"];
  status?: Task["status"];
  dueDate?: LocalDay;
  completedAt?: string;
  deletedAt?: string;
}): Task => ({
  id: over.id,
  title: over.id,
  priority: over.priority ?? "medium",
  tags: [],
  subtasks: [],
  status: over.status ?? "todo",
  kanbanOrder: 0,
  createdAt: stamp,
  updatedAt: stamp,
  ...(over.dueDate !== undefined ? { dueDate: over.dueDate } : {}),
  ...(over.completedAt !== undefined ? { completedAt: over.completedAt } : {}),
  ...(over.deletedAt !== undefined ? { deletedAt: over.deletedAt } : {}),
});

const mkHabit = (over: { id: string; schedule: Habit["schedule"]; archived?: boolean }): Habit => ({
  id: over.id,
  name: over.id,
  schedule: over.schedule,
  createdAt: stamp,
  updatedAt: stamp,
  archived: over.archived ?? false,
});

const mkLog = (over: { id: string; habitId: string; localDay: LocalDay; status: HabitLog["status"] }): HabitLog => ({
  id: over.id,
  habitId: over.habitId,
  localDay: over.localDay,
  status: over.status,
  createdAt: stamp,
  updatedAt: stamp,
});

const mkSession = (over: {
  id: string;
  plannedMinutes: number;
  completed: boolean;
  mode?: FocusSession["mode"];
}): FocusSession => ({
  id: over.id,
  mode: over.mode ?? "pomodoro",
  plannedMinutes: over.plannedMinutes,
  startedAt: stamp,
  endsAt: stamp,
  createdAt: stamp,
  updatedAt: stamp,
  completed: over.completed,
  distractions: [],
  localDay: TODAY,
});

const tasks: Task[] = [
  mkTask({ id: "t1", priority: "high", dueDate: TODAY }),
  mkTask({ id: "t2", dueDate: TODAY }),
  mkTask({ id: "t3", dueDate: "2026-11-05" }),
  mkTask({ id: "t4", dueDate: "2026-11-07" }),
  // 09:00 Cairo on a dayStartHour=4 clock → completed TODAY.
  mkTask({ id: "t5", status: "done", dueDate: TODAY, completedAt: "2026-11-06T07:00:00.000Z" }),
  // 02:30 Cairo → belongs to Nov 5 under dayStartHour 4, NOT today.
  mkTask({ id: "t6", status: "done", dueDate: "2026-11-05", completedAt: "2026-11-06T00:30:00.000Z" }),
];

const habits: Habit[] = [
  mkHabit({ id: "h1", schedule: { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] } }),
  mkHabit({ id: "h2", schedule: { type: "custom", days: [5] } }),
];

const logs: HabitLog[] = [
  mkLog({ id: "l1", habitId: "h1", localDay: TODAY, status: "done" }),
  mkLog({ id: "l2", habitId: "h2", localDay: TODAY, status: "skipped" }),
];

const sessions: FocusSession[] = [
  mkSession({ id: "s1", plannedMinutes: 30, completed: true }),
  mkSession({ id: "s2", plannedMinutes: 5, completed: true, mode: "break" }),
  mkSession({ id: "s3", plannedMinutes: 25, completed: false }),
];

const STATE: DigestState = {
  tasks,
  habits,
  logs,
  sessions,
  today: TODAY,
  hour: 9,
  dayStartHour: 4,
  timeZone: TZ,
};

describe("morningDigest", () => {
  it("counts the day's plate and names the top priority", () => {
    const m = morningDigest(STATE);
    expect(m.greeting).toBe("morning");
    expect(m.tasksDue).toBe(2);
    expect(m.overdue).toBe(1);
    expect(m.habitsDue).toBe(2);
    expect(m.firstTask).toEqual({ id: "t1", title: "t1" });
  });

  it("has no first task when nothing is on the plate", () => {
    const m = morningDigest({ ...STATE, tasks: [], habits: [] });
    expect(m.firstTask).toBeNull();
    expect(m.tasksDue).toBe(0);
    expect(m.habitsDue).toBe(0);
  });
});

describe("eveningDigest", () => {
  it("summarizes the day using stored days and completedAt", () => {
    const e = eveningDigest(STATE);
    expect(e.greeting).toBe("evening");
    expect(e.completedToday).toBe(1); // t5 only — t6 belongs to Nov 5 under dayStartHour 4
    expect(e.habitsDone).toBe(1);
    expect(e.focusMinutes).toBe(30); // planned minutes of completed work sessions
    expect(e.stillOpen).toBe(3); // t1, t2 due today + t3 overdue
    expect(e.tomorrowOpen).toBe(1); // t4
  });
});

describe("digestFor", () => {
  it("is the morning digest before 17:00 and the evening digest after", () => {
    expect(digestFor({ ...STATE, hour: 9 }).greeting).toBe("morning");
    expect(digestFor({ ...STATE, hour: 18 }).greeting).toBe("evening");
  });
});
