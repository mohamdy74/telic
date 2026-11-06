import { describe, expect, it } from "vitest";
import { buildWeek, monthWeeks, weekDays } from "./weekView";
import type { FocusSession, Habit, HabitLog, LocalDay, Task } from "./types";

const stamp = "2026-11-03T10:00:00.000Z";
const TUE = "2026-11-03";

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

const mkHabit = (over: {
  id: string;
  schedule: Habit["schedule"];
  archived?: boolean;
  deletedAt?: string;
}): Habit => ({
  id: over.id,
  name: over.id,
  schedule: over.schedule,
  createdAt: stamp,
  updatedAt: stamp,
  archived: over.archived ?? false,
  ...(over.deletedAt !== undefined ? { deletedAt: over.deletedAt } : {}),
});

const mkLog = (over: {
  id: string;
  habitId: string;
  localDay: LocalDay;
  status: HabitLog["status"];
  deletedAt?: string;
}): HabitLog => ({
  id: over.id,
  habitId: over.habitId,
  localDay: over.localDay,
  status: over.status,
  createdAt: stamp,
  updatedAt: stamp,
  ...(over.deletedAt !== undefined ? { deletedAt: over.deletedAt } : {}),
});

const mkSession = (over: {
  id: string;
  localDay: LocalDay;
  plannedMinutes: number;
  completed: boolean;
  mode?: FocusSession["mode"];
  deletedAt?: string;
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
  localDay: over.localDay,
  ...(over.deletedAt !== undefined ? { deletedAt: over.deletedAt } : {}),
});

const tasks: Task[] = [
  mkTask({ id: "t1", priority: "high", dueDate: TUE }),
  mkTask({ id: "t2", priority: "low", dueDate: TUE }),
  mkTask({ id: "t3", status: "done", dueDate: TUE, completedAt: "2026-11-03T15:00:00.000Z" }),
  mkTask({ id: "t4", dueDate: TUE, deletedAt: stamp }),
  mkTask({ id: "t5" }),
  mkTask({ id: "t6", dueDate: "2026-11-04" }),
];

const habits: Habit[] = [
  mkHabit({ id: "h1", schedule: { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] } }),
  mkHabit({ id: "h2", schedule: { type: "custom", days: [2] } }),
  mkHabit({ id: "h3", schedule: { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] }, archived: true }),
];

const logs: HabitLog[] = [
  mkLog({ id: "l1", habitId: "h1", localDay: TUE, status: "done" }),
  mkLog({ id: "l2", habitId: "h2", localDay: TUE, status: "skipped" }),
];

const sessions: FocusSession[] = [
  mkSession({ id: "s1", localDay: TUE, plannedMinutes: 25, completed: true }),
  mkSession({ id: "s2", localDay: TUE, plannedMinutes: 5, completed: true, mode: "break" }),
  mkSession({ id: "s3", localDay: TUE, plannedMinutes: 25, completed: false }),
  mkSession({ id: "s4", localDay: "2026-11-04", plannedMinutes: 50, completed: true }),
];

const INPUT = { tasks, habits, logs, sessions, anchor: TUE, today: TUE, weekStartsOn: 1 };

describe("weekDays", () => {
  it("returns the seven days of the anchored week, oldest first", () => {
    expect(weekDays("2026-11-03", 1)).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
  });

  it("starts on Saturday when the week starts on Saturday", () => {
    expect(weekDays("2026-11-03", 6)[0]).toBe("2026-10-31");
  });

  it("crosses month and year boundaries", () => {
    expect(weekDays("2026-01-01", 1)[0]).toBe("2025-12-29");
  });
});

describe("buildWeek", () => {
  it("builds one cell per day with the day's tasks, habits and focus", () => {
    const cells = buildWeek(INPUT);
    expect(cells.map((c) => c.day)).toEqual(weekDays(TUE, 1));
    const tue = cells[1]!;
    expect(tue.isToday).toBe(true);
    expect(tue.openTasks.map((x) => x.id)).toEqual(["t1", "t2"]);
    expect(tue.doneTasks.map((x) => x.id)).toEqual(["t3"]);
    expect(tue.habitsScheduled).toBe(2);
    expect(tue.habitsDone).toBe(1);
    expect(tue.focusMinutes).toBe(25);
    const wed = cells[2]!;
    expect(wed.isToday).toBe(false);
    expect(wed.openTasks.map((x) => x.id)).toEqual(["t6"]);
    expect(wed.focusMinutes).toBe(50);
  });

  it("keeps soft-deleted, archived and undated items out of every cell", () => {
    for (const cell of buildWeek(INPUT)) {
      expect(cell.openTasks.some((x) => x.id === "t4")).toBe(false);
      expect(cell.doneTasks.some((x) => x.id === "t4")).toBe(false);
      expect(cell.openTasks.some((x) => x.id === "t5")).toBe(false);
      expect(cell.habitsScheduled).toBeLessThanOrEqual(2);
    }
  });

  it("respects the Arabic week start (Saturday)", () => {
    const cells = buildWeek({ ...INPUT, weekStartsOn: 6 });
    expect(cells[0]!.day).toBe("2026-10-31");
    expect(cells.map((c) => c.day)).toEqual(weekDays(TUE, 6));
  });
});

describe("monthWeeks (TIL-F09 month view)", () => {
  it("returns full 7-day weeks covering the anchored month (Saturday start)", () => {
    const weeks = monthWeeks("2026-02-15", 6);
    expect(weeks.length).toBeGreaterThanOrEqual(4);
    expect(weeks.length).toBeLessThanOrEqual(6);
    for (const w of weeks) expect(w.length).toBe(7);
    const flat = weeks.flat();
    expect(flat.includes("2026-02-01")).toBe(true);
    expect(flat.includes("2026-02-28")).toBe(true);
    expect(new Set(flat).size).toBe(flat.length);
    for (let i = 1; i < flat.length; i++) {
      const prev = new Date(flat[i - 1]!);
      const cur = new Date(flat[i]!);
      expect(cur.getTime() - prev.getTime()).toBe(86400000);
    }
  });

  it("same month regardless of which day anchors it", () => {
    expect(monthWeeks("2026-03-01", 0)).toEqual(monthWeeks("2026-03-31", 0));
  });
});
