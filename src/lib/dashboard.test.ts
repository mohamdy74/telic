import { describe, expect, it } from "vitest";
import { dailyProgress, habitsDueToday, todaysPriorities, upcomingDeadlines } from "./dashboard";
import type { Habit, HabitLog, LocalDay, Task } from "./types";

const TODAY: LocalDay = "2026-03-09"; // a Monday

function task(partial: Partial<Task> = {}): Task {
  return {
    id: "t1",
    title: "Task",
    priority: "medium",
    tags: [],
    subtasks: [],
    status: "todo",
    kanbanOrder: 1,
    dueDate: TODAY,
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-01T10:00:00.000Z",
    ...partial,
  };
}

function habit(partial: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    name: "Habit",
    schedule: { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] },
    archived: false,
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-01T10:00:00.000Z",
    ...partial,
  };
}

function log(partial: Partial<HabitLog> = {}): HabitLog {
  return {
    id: "l1",
    habitId: "h1",
    localDay: TODAY,
    status: "done",
    createdAt: "2026-03-09T08:00:00.000Z",
    updatedAt: "2026-03-09T08:00:00.000Z",
    ...partial,
  };
}

describe("todaysPriorities", () => {
  it("sorts by priority: high, then medium, then low", () => {
    const list = [
      task({ id: "low", priority: "low" }),
      task({ id: "high", priority: "high" }),
      task({ id: "med", priority: "medium" }),
    ];
    expect(todaysPriorities(list, TODAY).map((x) => x.id)).toEqual(["high", "med", "low"]);
  });

  it("within one priority, overdue comes before today", () => {
    const list = [
      task({ id: "today", dueDate: TODAY, priority: "high" }),
      task({ id: "overdue", dueDate: "2026-03-07", priority: "high" }),
      task({ id: "today2", dueDate: TODAY, priority: "high" }),
    ];
    expect(todaysPriorities(list, TODAY).map((x) => x.id)).toEqual(["overdue", "today", "today2"]);
  });

  it("excludes done, deleted, undated and future tasks", () => {
    const list = [
      task({ id: "done", status: "done" }),
      task({ id: "gone", deletedAt: "2026-03-08T10:00:00.000Z" }),
      task({ id: "nodate", dueDate: undefined }),
      task({ id: "later", dueDate: "2026-03-20" }),
      task({ id: "keep" }),
    ];
    expect(todaysPriorities(list, TODAY).map((x) => x.id)).toEqual(["keep"]);
  });
});

describe("upcomingDeadlines", () => {
  it("takes the next 7 days inclusive, today excluded", () => {
    const list = [
      task({ id: "today", dueDate: TODAY }),
      task({ id: "in7", dueDate: "2026-03-16" }),
      task({ id: "in8", dueDate: "2026-03-17" }),
      task({ id: "in3", dueDate: "2026-03-12" }),
    ];
    expect(upcomingDeadlines(list, TODAY).map((x) => x.id)).toEqual(["in3", "in7"]);
  });

  it("earliest first, then priority; done and deleted never appear", () => {
    const list = [
      task({ id: "laterLow", dueDate: "2026-03-12", priority: "low" }),
      task({ id: "earlierLow", dueDate: "2026-03-10", priority: "low" }),
      task({ id: "earlierHigh", dueDate: "2026-03-10", priority: "high" }),
      task({ id: "done", dueDate: "2026-03-11", status: "done" }),
      task({ id: "gone", dueDate: "2026-03-11", deletedAt: "2026-03-08T10:00:00.000Z" }),
    ];
    expect(upcomingDeadlines(list, TODAY).map((x) => x.id)).toEqual(["earlierHigh", "earlierLow", "laterLow"]);
  });
});

describe("habitsDueToday", () => {
  it("lists only habits scheduled today, archived and deleted excluded", () => {
    const list = [
      habit({ id: "daily" }),
      habit({ id: "mon", schedule: { type: "custom", days: [1] } }),
      habit({ id: "tue", schedule: { type: "custom", days: [2] } }),
      habit({ id: "archived", archived: true }),
      habit({ id: "gone", deletedAt: "2026-03-08T10:00:00.000Z" }),
    ];
    expect(habitsDueToday(list, [], TODAY).map((x) => x.habit.id)).toEqual(["daily", "mon"]);
  });

  it("flags done from today's log; skipped or deleted logs do not count", () => {
    const list = [
      habit({ id: "a" }),
      habit({ id: "b" }),
      habit({ id: "c" }),
    ];
    const logs = [
      log({ id: "la", habitId: "a", status: "done" }),
      log({ id: "lb", habitId: "b", status: "skipped" }),
      log({ id: "lc", habitId: "c", status: "done", deletedAt: "2026-03-09T09:00:00.000Z" }),
      log({ id: "ld", habitId: "a", status: "done", localDay: "2026-03-08" }),
    ];
    const res = habitsDueToday(list, logs, TODAY);
    expect(res.find((x) => x.habit.id === "a")?.done).toBe(true);
    expect(res.find((x) => x.habit.id === "b")?.done).toBe(false);
    expect(res.find((x) => x.habit.id === "c")?.done).toBe(false);
  });
});

describe("dailyProgress", () => {
  it("mixes tasks and habits due today into one fraction", () => {
    const tasks = [
      task({ id: "t-open" }),
      task({ id: "t-done", status: "done" }),
      task({ id: "t-later", dueDate: "2026-03-12" }),
    ];
    const habits = [
      habit({ id: "h-done" }),
      habit({ id: "h-open" }),
    ];
    const logs = [log({ id: "l1", habitId: "h-done", status: "done" })];
    const p = dailyProgress(tasks, habits, logs, TODAY);
    expect(p.done).toBe(2);
    expect(p.total).toBe(4);
    expect(p.ratio).toBe(0.5);
  });

  it("zero total -> ratio null, never a divide by zero", () => {
    const p = dailyProgress([], [], [], TODAY);
    expect(p.ratio).toBeNull();
    expect(p.done).toBe(0);
    expect(p.total).toBe(0);
  });

  it("all done -> 1; a skipped habit stays in the denominator", () => {
    const tasks = [task({ id: "t1", status: "done" })];
    const habits = [habit({ id: "h1" })];
    const logs = [log({ id: "l1", habitId: "h1", status: "skipped" })];
    const p = dailyProgress(tasks, habits, logs, TODAY);
    expect(p.ratio).toBe(0.5);
    const logs2 = [log({ id: "l2", habitId: "h1", status: "done" })];
    expect(dailyProgress(tasks, habits, logs2, TODAY).ratio).toBe(1);
  });

  it("nothing scheduled today -> null even with other-day activity", () => {
    const tasks = [task({ id: "yesterday", dueDate: "2026-03-08", status: "done" })];
    const habits = [habit({ id: "h1", schedule: { type: "custom", days: [3] } })];
    const logs = [log({ id: "l1", habitId: "h1", localDay: "2026-03-08", status: "done" })];
    expect(dailyProgress(tasks, habits, logs, TODAY).ratio).toBeNull();
  });
});
