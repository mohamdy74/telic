import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import {
  ACTIVE_WINDOW_DAYS,
  MIN_ACTIVE_DAYS,
  focusMinutesByDay,
  habitConsistencyByDay,
  insightsReport,
  taskCompletionsByDay,
  windowDays,
} from "./insights";
import type { FocusSession, Habit, HabitLog, Task } from "./types";

const TZ = "Africa/Cairo"; // UTC+2, no DST
const TODAY = "2026-11-05"; // a Thursday

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (day: string, h: number, m = 0) =>
  day + "T" + pad(h) + ":" + pad(m) + ":00.000Z";

const DAYS14 = Array.from({ length: 14 }, (_, i) => addDays(TODAY, -(i + 1)));

let seq = 0;
const task = (over: Partial<Task>): Task => {
  seq++;
  return {
    id: "t" + seq,
    title: "Task " + seq,
    priority: "medium",
    tags: [],
    subtasks: [],
    status: "todo",
    kanbanOrder: 0,
    createdAt: iso("2026-10-01", 6),
    updatedAt: iso("2026-10-01", 6),
    ...over,
  };
};

const habit = (id: string, over: Partial<Habit> = {}): Habit => ({
  id,
  name: "Habit " + id,
  schedule: { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] },
  archived: false,
  createdAt: iso("2026-10-01", 6),
  updatedAt: iso("2026-10-01", 6),
  ...over,
});

const log = (habitId: string, day: string, status: "done" | "skipped"): HabitLog => ({
  id: habitId + "-" + day,
  habitId,
  localDay: day,
  status,
  createdAt: iso(day, 18),
  updatedAt: iso(day, 18),
});

const focus = (id: string, day: string, minutes: number, over: Partial<FocusSession> = {}): FocusSession => ({
  id,
  mode: "pomodoro",
  plannedMinutes: minutes,
  startedAt: iso(day, 9),
  endsAt: iso(day, 9, minutes),
  endedAt: iso(day, 9, minutes),
  completed: true,
  distractions: [],
  localDay: day,
  createdAt: iso(day, 9),
  updatedAt: iso(day, 9, minutes),
  ...over,
});

const activeLogs = (days: string[]) => days.map((d) => log("h1", d, "done"));

const empty = {
  tasks: [] as Task[],
  habits: [] as Habit[],
  habitLogs: [] as HabitLog[],
  focusSessions: [] as FocusSession[],
  xpLedger: [],
  today: TODAY,
  timeZone: TZ,
  dayStartHour: 0,
};

describe("insights series", () => {
  it("windowDays returns n days ending today, oldest first", () => {
    const days = windowDays(TODAY, 7);
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-10-30");
    expect(days[6]).toBe(TODAY);
  });

  it("uses a 28-day observation window with a 14-day floor", () => {
    expect(ACTIVE_WINDOW_DAYS).toBe(28);
    expect(MIN_ACTIVE_DAYS).toBe(14);
  });

  it("counts completed tasks per day and ignores everything else", () => {
    const tasks = [
      task({ status: "done", completedAt: iso("2026-11-04", 8) }),
      task({ status: "done", completedAt: iso("2026-11-04", 10, 30) }),
      task({ status: "done", completedAt: iso(TODAY, 7) }),
      task({ status: "todo" }),
      task({ status: "done", completedAt: iso("2026-11-04", 9), deletedAt: iso("2026-11-05", 1) }),
      task({ status: "done", completedAt: iso("2026-09-01", 8) }),
    ];
    const pts = taskCompletionsByDay(tasks, { today: TODAY, days: 7, dayStartHour: 0, timeZone: TZ });
    expect(pts).toHaveLength(7);
    expect(pts[0]).toEqual({ day: "2026-10-30", value: 0 });
    expect(pts[5]).toEqual({ day: "2026-11-04", value: 2 });
    expect(pts[6]).toEqual({ day: TODAY, value: 1 });
  });

  it("respects dayStartHour: a 03:30 wall-clock completion belongs to the previous day", () => {
    const tasks = [task({ status: "done", completedAt: iso("2026-11-04", 1, 30) })];
    const pts = taskCompletionsByDay(tasks, { today: TODAY, days: 7, dayStartHour: 4, timeZone: TZ });
    expect(pts[4]).toEqual({ day: "2026-11-03", value: 1 });
    expect(pts[5]?.value).toBe(0);
  });

  it("habit consistency: done / (scheduled - skipped), null when nothing scheduled", () => {
    const h1 = habit("h1");
    const h2 = habit("h2", { schedule: { type: "custom", days: [6] } });
    const hArch = habit("hArch", { archived: true });
    const logs = [
      log("h1", "2026-11-03", "done"),
      log("h1", "2026-11-04", "skipped"),
      log("h2", "2026-10-31", "done"),
    ];
    const pts = habitConsistencyByDay([h1, h2, hArch], logs, { today: TODAY, days: 7 });
    expect(pts).toHaveLength(7);
    // Nov 3 (Tuesday): only h1 scheduled, done -> 100
    expect(pts[4]).toMatchObject({ day: "2026-11-03", value: 100, scheduled: 1, done: 1, skipped: 0 });
    // Nov 4: h1 skipped -> denominator 0 -> null
    expect(pts[5]).toMatchObject({ day: "2026-11-04", value: null, scheduled: 1, done: 0, skipped: 1 });
    // Oct 31 (Saturday): h1 (no log) + h2 done -> 1/2
    expect(pts[1]).toMatchObject({ day: "2026-10-31", value: 50, scheduled: 2, done: 1 });
    // Nov 2: h1 scheduled, no log -> 0
    expect(pts[3]).toMatchObject({ value: 0, scheduled: 1, done: 0 });
  });

  it("sums actual minutes of completed work sessions per stored localDay", () => {
    const sessions = [
      focus("a", "2026-11-04", 25),
      focus("b", "2026-11-04", 35),
      focus("c", "2026-11-03", 25, { mode: "break" }),
      focus("d", "2026-11-03", 25, { completed: false, endedAt: undefined }),
      focus("e", "2026-11-03", 25, { deletedAt: iso("2026-11-04", 1) }),
      focus("f", "2026-09-01", 25),
    ];
    const pts = focusMinutesByDay(sessions, { today: TODAY, days: 7 });
    expect(pts).toHaveLength(7);
    expect(pts[5]).toEqual({ day: "2026-11-04", value: 60 });
    expect(pts[4]).toEqual({ day: "2026-11-03", value: 0 });
  });
});

describe("insights observations", () => {
  it("activeDays counts the last 28 days with any live activity", () => {
    const rep = insightsReport({ ...empty, habits: [habit("h1")], habitLogs: activeLogs(DAYS14) });
    expect(rep.activeDays).toBe(14);
    expect(rep.hasAnyData).toBe(true);
  });

  it("empty input: no data, no claims", () => {
    const rep = insightsReport(empty);
    expect(rep.hasAnyData).toBe(false);
    expect(rep.activeDays).toBe(0);
    expect(rep.observations).toEqual([]);
  });

  it("no claims below 14 active days even with enough events", () => {
    const logs = Array.from({ length: 12 }, (_, i) => log("h1", addDays(TODAY, -(i + 1)), "done"));
    const tasks = Array.from(
      { length: 10 },
      (_, i) => task({ status: "done", completedAt: iso(addDays(TODAY, -(i + 1)), 8) }),
    );
    const rep = insightsReport({ ...empty, tasks, habits: [habit("h1")], habitLogs: logs });
    expect(rep.activeDays).toBe(12);
    expect(rep.observations).toEqual([]);
  });

  it("claims the morning-completion pattern with pct and basis", () => {
    const tasks = [
      ...Array.from({ length: 7 }, (_, i) =>
        task({ status: "done", completedAt: iso(addDays(TODAY, -(i + 1)), 8) })),
      ...Array.from({ length: 2 }, (_, i) =>
        task({ status: "done", completedAt: iso(addDays(TODAY, -(i + 1)), 13) })),
      task({ status: "done", completedAt: iso(addDays(TODAY, -1), 18) }),
    ];
    const rep = insightsReport({
      ...empty,
      tasks,
      habits: [habit("h1")],
      habitLogs: activeLogs(DAYS14),
    });
    const obs = rep.observations.find((o) => o.id === "taskTimeOfDay");
    expect(obs).toBeDefined();
    expect(obs?.params["bucket"]).toBe("morning");
    expect(obs?.params["pct"]).toBe("70");
    expect(obs?.events).toBe(10);
    expect(obs?.activeDays).toBe(14);
  });

  it("no time-of-day claim when the distribution is even", () => {
    const tasks = [
      ...Array.from({ length: 4 }, (_, i) =>
        task({ status: "done", completedAt: iso(addDays(TODAY, -(i + 1)), 8) })),
      ...Array.from({ length: 4 }, (_, i) =>
        task({ status: "done", completedAt: iso(addDays(TODAY, -(i + 1)), 13) })),
      ...Array.from({ length: 2 }, (_, i) =>
        task({ status: "done", completedAt: iso(addDays(TODAY, -(i + 1)), 18) })),
    ];
    const rep = insightsReport({ ...empty, tasks, habits: [habit("h1")], habitLogs: activeLogs(DAYS14) });
    expect(rep.observations.find((o) => o.id === "taskTimeOfDay")).toBeUndefined();
  });

  it("claims the best focus weekday", () => {
    const sessions = [
      ...["2026-10-10", "2026-10-17", "2026-10-24", "2026-10-31"].flatMap((d) => [
        focus(d + "-a", d, 25),
        focus(d + "-b", d, 25),
      ]),
      focus("tue-1", "2026-10-13", 20),
      focus("tue-2", "2026-10-20", 20),
      focus("thu-1", "2026-10-15", 20),
    ];
    const rep = insightsReport({
      ...empty,
      habits: [habit("h1")],
      habitLogs: activeLogs(DAYS14),
      focusSessions: sessions,
    });
    const obs = rep.observations.find((o) => o.id === "focusWeekday");
    expect(obs).toBeDefined();
    expect(obs?.params["weekday"]).toBe("6"); // Saturday
    expect(obs?.events).toBe(11);
  });

  it("focus weekday claim needs 6 sessions on 3+ weekdays", () => {
    const sessions = [
      focus("a", "2026-10-31", 25),
      focus("b", "2026-10-31", 25),
      focus("c", "2026-10-24", 25),
      focus("d", "2026-10-24", 25),
      focus("e", "2026-10-17", 25),
    ];
    const rep = insightsReport({
      ...empty,
      habits: [habit("h1")],
      habitLogs: activeLogs(DAYS14),
      focusSessions: sessions,
    });
    expect(rep.observations.find((o) => o.id === "focusWeekday")).toBeUndefined();
  });

  it("claims the most-skipped habit", () => {
    const hA = habit("hA", { name: "Exercise" });
    const hB = habit("hB", { name: "Meditate" });
    const logs = [
      ...activeLogs(DAYS14),
      log("hA", addDays(TODAY, -2), "skipped"),
      log("hA", addDays(TODAY, -4), "skipped"),
      log("hA", addDays(TODAY, -6), "skipped"),
      log("hA", addDays(TODAY, -8), "skipped"),
      log("hB", addDays(TODAY, -3), "skipped"),
    ];
    const rep = insightsReport({ ...empty, habits: [hA, hB], habitLogs: logs });
    const obs = rep.observations.find((o) => o.id === "skippedHabit");
    expect(obs).toBeDefined();
    expect(obs?.params["habit"]).toBe("Exercise");
    expect(obs?.events).toBe(4);
  });

  it("most-skipped habit needs 3 skips", () => {
    const logs = [
      ...activeLogs(DAYS14),
      log("hA", addDays(TODAY, -2), "skipped"),
      log("hA", addDays(TODAY, -5), "skipped"),
    ];
    const rep = insightsReport({ ...empty, habits: [habit("hA")], habitLogs: logs });
    expect(rep.observations.find((o) => o.id === "skippedHabit")).toBeUndefined();
  });

  it("ignores skips of archived or deleted habits", () => {
    const hA = habit("hA", { name: "Exercise", archived: true });
    const hB = habit("hB", { name: "Meditate", deletedAt: iso("2026-11-01", 1) });
    const logs = [
      ...activeLogs(DAYS14),
      log("hA", addDays(TODAY, -2), "skipped"),
      log("hA", addDays(TODAY, -4), "skipped"),
      log("hA", addDays(TODAY, -6), "skipped"),
      log("hA", addDays(TODAY, -8), "skipped"),
      log("hB", addDays(TODAY, -3), "skipped"),
      log("hB", addDays(TODAY, -5), "skipped"),
      log("hB", addDays(TODAY, -7), "skipped"),
    ];
    const rep = insightsReport({ ...empty, habits: [hA, hB], habitLogs: logs });
    expect(rep.observations.find((o) => o.id === "skippedHabit")).toBeUndefined();
  });

  it("observations keep a stable order when several qualify", () => {
    const tasks = [
      ...Array.from({ length: 7 }, (_, i) =>
        task({ status: "done", completedAt: iso(addDays(TODAY, -(i + 1)), 8) })),
      ...Array.from({ length: 2 }, (_, i) =>
        task({ status: "done", completedAt: iso(addDays(TODAY, -(i + 1)), 13) })),
      task({ status: "done", completedAt: iso(addDays(TODAY, -1), 18) }),
    ];
    const sessions = [
      ...["2026-10-10", "2026-10-17", "2026-10-24", "2026-10-31"].flatMap((d) => [
        focus(d + "-a", d, 25),
        focus(d + "-b", d, 25),
      ]),
      focus("tue-1", "2026-10-13", 20),
      focus("tue-2", "2026-10-20", 20),
      focus("thu-1", "2026-10-15", 20),
    ];
    const logs = [
      ...activeLogs(DAYS14),
      log("hA", addDays(TODAY, -2), "skipped"),
      log("hA", addDays(TODAY, -4), "skipped"),
      log("hA", addDays(TODAY, -6), "skipped"),
      log("hA", addDays(TODAY, -8), "skipped"),
    ];
    const rep = insightsReport({
      ...empty,
      tasks,
      habits: [habit("h1"), habit("hA")],
      habitLogs: logs,
      focusSessions: sessions,
    });
    expect(rep.observations.map((o) => o.id)).toEqual([
      "taskTimeOfDay",
      "focusWeekday",
      "skippedHabit",
    ]);
  });
});

