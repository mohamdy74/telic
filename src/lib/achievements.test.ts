import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import {
  ACHIEVEMENTS,
  evaluateAchievements,
  latestUnlocks,
  type AchievementId,
  type AchievementState,
} from "./achievements";
import type { AchievementUnlock, FocusSession, Habit, HabitLog, Task, XpLedgerEntry } from "./types";

const DAY = "2026-11-05"; // Thursday
const STAMP = "2026-11-05T10:00:00.000Z";

let seq = 0;
const uid = () => "r" + ++seq;

const makeTask = (id: string, over: Partial<Task> = {}): Task => ({
  id,
  title: id,
  priority: "medium",
  tags: [],
  subtasks: [],
  status: "todo",
  kanbanOrder: 0,
  createdAt: STAMP,
  updatedAt: STAMP,
  ...over,
});

const makeHabit = (id: string, over: Partial<Habit> = {}): Habit => ({
  id,
  name: id,
  schedule: { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] },
  archived: false,
  createdAt: STAMP,
  updatedAt: STAMP,
  ...over,
});

const makeLog = (over: Partial<HabitLog> & { habitId: string; localDay: string }): HabitLog => ({
  id: uid(),
  status: "done",
  createdAt: STAMP,
  updatedAt: STAMP,
  ...over,
});

const makeSession = (id: string, over: Partial<FocusSession> = {}): FocusSession => ({
  id,
  mode: "pomodoro",
  plannedMinutes: 25,
  startedAt: STAMP,
  endsAt: STAMP,
  endedAt: STAMP,
  completed: true,
  distractions: [],
  localDay: DAY,
  createdAt: STAMP,
  updatedAt: STAMP,
  ...over,
});

const entry = (
  sourceType: XpLedgerEntry["sourceType"],
  sourceId: string,
  localDay: string,
  xp = 10,
  over: Partial<XpLedgerEntry> = {},
): XpLedgerEntry => ({
  id: "e-" + sourceType + "-" + sourceId + "-" + localDay,
  sourceType,
  sourceId,
  localDay,
  xp,
  coins: 0,
  createdAt: STAMP,
  updatedAt: STAMP,
  ...over,
});
const te = (id: string, day = DAY, xp = 10) => entry("task", id, day, xp);
const he = (id: string, day = DAY) => entry("habit", id, day, 10);

const state = (over: Partial<AchievementState> = {}): AchievementState => ({
  today: DAY,
  timeZone: "UTC",
  weekStartsOn: 1,
  dailyFocusTargetMinutes: 100,
  tasks: [],
  habits: [],
  habitLogs: [],
  focusSessions: [],
  xpLedger: [],
  lastExportedAt: undefined,
  ...over,
});

const ach = (id: AchievementId) => {
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  if (!def) throw new Error("unknown achievement: " + id);
  return def;
};
const unlocked = (id: AchievementId, s: AchievementState) => ach(id).predicate(s);
const prog = (id: AchievementId, s: AchievementState) => ach(id).progress(s);

describe("achievements", () => {
  it("firstTask unlocks on a validated task entry, never on an instant completion", () => {
    const t = makeTask("t1", { status: "done", completedAt: STAMP });
    expect(unlocked("firstTask", state({ tasks: [t] }))).toBe(false);
    expect(unlocked("firstTask", state({ tasks: [t], xpLedger: [te("t1")] }))).toBe(true);
    expect(unlocked("firstTask", state({ tasks: [t], xpLedger: [entry("task", "t1", DAY, 10, { deletedAt: STAMP })] }))).toBe(false);
  });

  it("task-count achievements count distinct validated tasks", () => {
    const ten = Array.from({ length: 10 }, (_, i) => te("t" + i));
    expect(unlocked("tasksTen", state({ xpLedger: ten }))).toBe(true);
    expect(unlocked("tasksTen", state({ xpLedger: ten.slice(0, 9) }))).toBe(false);
    // a revoked (soft-deleted) entry no longer validates
    expect(unlocked("tasksTen", state({ xpLedger: [...ten.slice(0, 9), entry("task", "tx", DAY, 10, { deletedAt: STAMP })] }))).toBe(false);
    // the same task completed on two days is still one task
    expect(unlocked("tasksTen", state({ xpLedger: [...ten.slice(0, 9), te("t0", "2026-11-04")] }))).toBe(false);
    expect(unlocked("tasksTwoHundred", state({ xpLedger: Array.from({ length: 200 }, (_, i) => te("u" + i)) }))).toBe(true);
  });

  it("tasksFifty progress is measurable", () => {
    expect(prog("tasksFifty", state({ xpLedger: Array.from({ length: 7 }, (_, i) => te("t" + i)) }))).toEqual({ current: 7, target: 50 });
  });

  it("firstHabit needs a validated habit entry; a bare done log is not enough", () => {
    const h = makeHabit("h1");
    const log = makeLog({ habitId: "h1", localDay: DAY });
    expect(unlocked("firstHabit", state({ habits: [h], habitLogs: [log] }))).toBe(false);
    expect(unlocked("firstHabit", state({ habits: [h], habitLogs: [log], xpLedger: [he("h1")] }))).toBe(true);
  });

  it("streak achievements read the habit streak best", () => {
    const h = makeHabit("h1");
    const logs = (n: number) => Array.from({ length: n }, (_, i) => makeLog({ habitId: "h1", localDay: addDays(DAY, -i) }));
    expect(unlocked("streakSeven", state({ habits: [h], habitLogs: logs(7) }))).toBe(true);
    expect(unlocked("streakThirty", state({ habits: [h], habitLogs: logs(7) }))).toBe(false);
    expect(unlocked("streakSeven", state({ habits: [h], habitLogs: logs(6) }))).toBe(false);
    expect(unlocked("streakThirty", state({ habits: [h], habitLogs: logs(30) }))).toBe(true);
    expect(unlocked("streakHundred", state({ habits: [h], habitLogs: logs(100) }))).toBe(true);
  });

  it("firstFocus needs a completed work session", () => {
    expect(unlocked("firstFocus", state({ focusSessions: [makeSession("f1")] }))).toBe(true);
    expect(unlocked("firstFocus", state({ focusSessions: [makeSession("f1", { mode: "break" })] }))).toBe(false);
    expect(unlocked("firstFocus", state({ focusSessions: [makeSession("f1", { completed: false, endedAt: undefined })] }))).toBe(false);
    expect(unlocked("firstFocus", state({ focusSessions: [makeSession("f1", { deletedAt: STAMP })] }))).toBe(false);
  });

  it("focus-hour achievements count completed work minutes", () => {
    const hours = (n: number) => Array.from({ length: n }, (_, i) => makeSession("f" + i, { plannedMinutes: 60 }));
    expect(unlocked("focusTenHours", state({ focusSessions: hours(10) }))).toBe(true);
    expect(unlocked("focusTenHours", state({ focusSessions: [...hours(9), makeSession("fx", { plannedMinutes: 50 })] }))).toBe(false);
    expect(unlocked("focusFiftyHours", state({ focusSessions: hours(50) }))).toBe(true);
  });

  it("perfectDay unlocks when every due task and due habit is done", () => {
    const t = makeTask("t1", { status: "done", completedAt: STAMP, dueDate: DAY });
    const h = makeHabit("h1");
    const s = state({
      tasks: [t],
      habits: [h],
      habitLogs: [makeLog({ habitId: "h1", localDay: DAY })],
      xpLedger: [te("t1"), he("h1")],
    });
    expect(unlocked("perfectDay", s)).toBe(true);
  });

  it("perfectDay is blocked by an open due task, with progress", () => {
    const t1 = makeTask("t1", { status: "done", completedAt: STAMP, dueDate: DAY });
    const t2 = makeTask("t2", { status: "todo", dueDate: DAY });
    const h = makeHabit("h1");
    const s = state({
      tasks: [t1, t2],
      habits: [h],
      habitLogs: [makeLog({ habitId: "h1", localDay: DAY })],
      xpLedger: [te("t1"), he("h1")],
    });
    expect(unlocked("perfectDay", s)).toBe(false);
    expect(prog("perfectDay", s)).toEqual({ current: 2, target: 3 });
  });

  it("perfectDay ignores instant completions and skipped habits", () => {
    const t = makeTask("t1", { status: "done", completedAt: STAMP, dueDate: DAY }); // instant, no entry
    const h = makeHabit("h1");
    const s = state({ tasks: [t], habits: [h], habitLogs: [makeLog({ habitId: "h1", localDay: DAY, status: "skipped" })] });
    expect(unlocked("perfectDay", s)).toBe(false);
    expect(prog("perfectDay", s)).toEqual({ current: 0, target: 2 });
  });

  it("perfectDay stays locked when nothing is due", () => {
    const sundayOnly = makeHabit("h1", { schedule: { type: "custom", days: [0] } }); // today is Thursday
    const s = state({ habits: [sundayOnly] });
    expect(unlocked("perfectDay", s)).toBe(false);
    expect(prog("perfectDay", s)).toEqual({ current: 0, target: 0 });
  });

  it("earlyBirdFive counts validated tasks completed before 09:00, sharp 09:00 excluded", () => {
    const earlyTask = (id: string, at: string) => makeTask(id, { status: "done", completedAt: at });
    const ledgerOf = (ids: string[]) => ids.map((id) => te(id));
    const five = ["05:00", "06:00", "07:00", "08:00", "08:59"].map((hm, i) => earlyTask("t" + i, "2026-11-05T" + hm + ":00.000Z"));
    expect(unlocked("earlyBirdFive", state({ tasks: five, xpLedger: ledgerOf(five.map((x) => x.id)) }))).toBe(true);
    const withNine = [...five.slice(0, 4), earlyTask("t9", "2026-11-05T09:00:00.000Z")];
    expect(unlocked("earlyBirdFive", state({ tasks: withNine, xpLedger: ledgerOf(withNine.map((x) => x.id)) }))).toBe(false);
    expect(prog("earlyBirdFive", state({ tasks: [earlyTask("t0", "2026-11-05T08:59:00.000Z")], xpLedger: [te("t0")] }))).toEqual({ current: 1, target: 5 });
  });

  it("comeback unlocks after 7 inactive days", () => {
    const days = ["2026-10-01", "2026-10-02", "2026-10-10"]; // 8-day gap = 7 inactive days
    expect(unlocked("comeback", state({ xpLedger: days.map((d) => te("t" + d, d)) }))).toBe(true);
  });

  it("comeback stays locked on shorter gaps", () => {
    const days = ["2026-10-02", "2026-10-09"]; // 7-day gap = 6 inactive days
    expect(unlocked("comeback", state({ xpLedger: days.map((d) => te("t" + d, d)) }))).toBe(false);
  });

  it("levelFive and levelTen read the ledger total", () => {
    expect(unlocked("levelFive", state({ xpLedger: [entry("task", "t1", DAY, 1703)] }))).toBe(true);
    expect(unlocked("levelTen", state({ xpLedger: [entry("task", "t1", DAY, 1703)] }))).toBe(false);
    expect(unlocked("levelTen", state({ xpLedger: [entry("task", "t1", DAY, 11106)] }))).toBe(true);
  });

  it("firstPurchase needs a shop entry with negative coins (dormant until the shop ships)", () => {
    expect(unlocked("firstPurchase", state({ xpLedger: [entry("shop", "s1", DAY, 0, { coins: -5 })] }))).toBe(true);
    expect(unlocked("firstPurchase", state({ xpLedger: [entry("shop", "s1", DAY, 0, { coins: 5 })] }))).toBe(false);
  });

  it("firstBackup unlocks on the export stamp", () => {
    expect(unlocked("firstBackup", state())).toBe(false);
    expect(unlocked("firstBackup", state({ lastExportedAt: "2026-11-01T10:00:00.000Z" }))).toBe(true);
  });

  it("consistentMonth unlocks at 80% done over the last 30 days", () => {
    const h = makeHabit("h1");
    const logs = (n: number) => Array.from({ length: n }, (_, i) => makeLog({ habitId: "h1", localDay: addDays(DAY, -i) }));
    expect(unlocked("consistentMonth", state({ habits: [h], habitLogs: logs(24) }))).toBe(true);
    expect(unlocked("consistentMonth", state({ habits: [h], habitLogs: logs(23) }))).toBe(false);
  });

  it("zenThree unlocks on 3 distraction-free completed sessions in a row", () => {
    const at = (hm: string) => "2026-11-05T" + hm + ":00.000Z";
    const sess = (id: string, hm: string, distractions: number) =>
      makeSession(id, {
        startedAt: at(hm),
        endsAt: at(hm),
        endedAt: at(hm),
        distractions: Array.from({ length: distractions }, () => ({ at: at(hm) })),
      });
    expect(unlocked("zenThree", state({ focusSessions: [sess("a", "08:00", 0), sess("b", "07:00", 0), sess("c", "06:00", 0)] }))).toBe(true);
    expect(unlocked("zenThree", state({ focusSessions: [sess("a", "08:00", 0), sess("b", "07:00", 1), sess("c", "06:00", 0)] }))).toBe(false);
  });

  it("focusTargetWeek unlocks after 7 consecutive days at target", () => {
    const day100 = (day: string, id: string) => makeSession(id, { localDay: day, plannedMinutes: 100 });
    const week = Array.from({ length: 7 }, (_, i) => day100(addDays(DAY, -i), "f" + i));
    expect(unlocked("focusTargetWeek", state({ focusSessions: week }))).toBe(true);
    expect(unlocked("focusTargetWeek", state({ focusSessions: week.slice(0, 6) }))).toBe(false);
    const withGap = [...week.slice(0, 3), ...Array.from({ length: 3 }, (_, i) => day100(addDays(DAY, -(i + 4)), "g" + i))];
    expect(unlocked("focusTargetWeek", state({ focusSessions: withGap }))).toBe(false);
  });

  it("evaluateAchievements returns only new ids in definition order", () => {
    const s = state({ xpLedger: [te("t1")], lastExportedAt: "2026-11-01T10:00:00.000Z" });
    expect(evaluateAchievements(s, [])).toEqual(["firstTask", "firstBackup"]);
    const prior: AchievementUnlock = { id: "u1", achievementId: "firstTask", unlockedAt: STAMP, localDay: DAY, createdAt: STAMP, updatedAt: STAMP };
    expect(evaluateAchievements(s, [prior])).toEqual(["firstBackup"]);
  });

  it("latestUnlocks sorts newest first and ignores soft-deleted", () => {
    const mk = (id: string, at: string, over: Partial<AchievementUnlock> = {}): AchievementUnlock => ({
      id,
      achievementId: id,
      unlockedAt: at,
      localDay: DAY,
      createdAt: at,
      updatedAt: at,
      ...over,
    });
    const list = [
      mk("firstTask", "2026-11-04T10:00:00.000Z"),
      mk("firstBackup", "2026-11-05T10:00:00.000Z"),
      mk("firstHabit", "2026-11-05T09:00:00.000Z", { deletedAt: STAMP }),
    ];
    expect(latestUnlocks(list, 3).map((u) => u.achievementId)).toEqual(["firstBackup", "firstTask"]);
    expect(latestUnlocks(list, 1).map((u) => u.achievementId)).toEqual(["firstBackup"]);
  });

  it("progress is measurable where it makes sense and null otherwise", () => {
    expect(prog("comeback", state())).toBe(null);
    expect(prog("tasksTen", state({ xpLedger: Array.from({ length: 7 }, (_, i) => te("t" + i)) }))).toEqual({ current: 7, target: 10 });
  });
});
