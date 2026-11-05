import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import {
  DAILY_CHALLENGES,
  WEEKLY_CHALLENGES,
  computeChallengeGrants,
  dailyChallenges,
  weeklyChallenges,
  type ChallengeId,
  type ChallengeState,
} from "./challenges";
import { DAILY_CHALLENGE_COINS, WEEKLY_CHALLENGE_COINS } from "./rewardsConfig";
import type { FocusSession, Habit, HabitLog, Task, XpLedgerEntry } from "./types";

const DAY = "2026-11-05"; // Thursday
const WEEK_START = "2026-11-02"; // Monday (weekStartsOn = 1)
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
const fe = (id: string, day = DAY) => entry("focus", id, day, 25);

const state = (over: Partial<ChallengeState> = {}): ChallengeState => ({
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

const ALL_DEFS = [...DAILY_CHALLENGES, ...WEEKLY_CHALLENGES];
const def = (id: string) => {
  const d = ALL_DEFS.find((x) => x.id === (id as ChallengeId));
  if (!d) throw new Error("unknown challenge: " + id);
  return d;
};
const prog = (id: string, s: ChallengeState) => def(id).progress(s);

describe("challenges", () => {
  it("daily selection is deterministic: same day, same set of 3", () => {
    const a = dailyChallenges(DAY);
    expect(a).toEqual(dailyChallenges(DAY));
    expect(a).toHaveLength(3);
  });

  it("weekly selection is deterministic: same week start, same set of 2", () => {
    const a = weeklyChallenges(WEEK_START);
    expect(a).toEqual(weeklyChallenges(WEEK_START));
    expect(a).toHaveLength(2);
  });

  it("selection varies across days and weeks", () => {
    const daily = new Set<string>();
    for (let i = 0; i < 7; i++) for (const c of dailyChallenges(addDays(DAY, -i))) daily.add(c.id);
    expect(daily.size).toBeGreaterThanOrEqual(4);
    const weekly = new Set<string>();
    for (let i = 0; i < 3; i++) for (const c of weeklyChallenges(addDays(WEEK_START, -7 * i))) weekly.add(c.id);
    expect(weekly.size).toBeGreaterThanOrEqual(3);
  });

  it("pools are well-formed: unique ids, matching periods and bonuses", () => {
    expect(new Set(ALL_DEFS.map((d) => d.id)).size).toBe(ALL_DEFS.length);
    for (const d of DAILY_CHALLENGES) {
      expect(d.period).toBe("daily");
      expect(d.bonusCoins).toBe(DAILY_CHALLENGE_COINS);
    }
    for (const d of WEEKLY_CHALLENGES) {
      expect(d.period).toBe("weekly");
      expect(d.bonusCoins).toBe(WEEKLY_CHALLENGE_COINS);
    }
  });

  it("d-tasks-3 counts distinct live task entries today", () => {
    expect(prog("d-tasks-3", state({ xpLedger: [te("a"), te("b"), te("c")] }))).toEqual({ current: 3, goal: 3 });
    expect(prog("d-tasks-3", state({ xpLedger: [te("a"), te("b", "2026-11-04")] }))).toEqual({ current: 1, goal: 3 });
    expect(prog("d-tasks-3", state({ xpLedger: [te("a"), te("b"), entry("task", "c", DAY, 10, { deletedAt: STAMP })] }))).toEqual({ current: 2, goal: 3 });
  });

  it("d-focus-2 counts completed work sessions today only", () => {
    expect(prog("d-focus-2", state({ focusSessions: [makeSession("f1"), makeSession("f2")] }))).toEqual({ current: 2, goal: 2 });
    expect(prog("d-focus-2", state({ focusSessions: [
      makeSession("f1"),
      makeSession("fb", { mode: "break" }),
      makeSession("fi", { completed: false, endedAt: undefined }),
      makeSession("fy", { localDay: "2026-11-04" }),
    ] }))).toEqual({ current: 1, goal: 2 });
  });

  it("d-habits-all completes when every habit due today is done", () => {
    const h1 = makeHabit("h1");
    const h2 = makeHabit("h2");
    const both = state({ habits: [h1, h2], habitLogs: [
      makeLog({ habitId: "h1", localDay: DAY }),
      makeLog({ habitId: "h2", localDay: DAY }),
    ] });
    expect(prog("d-habits-all", both)).toEqual({ current: 2, goal: 2 });
    expect(prog("d-habits-all", state({ habits: [h1, h2], habitLogs: [makeLog({ habitId: "h1", localDay: DAY })] }))).toEqual({ current: 1, goal: 2 });
    expect(prog("d-habits-all", state())).toEqual({ current: 0, goal: 0 });
    const sundayOnly = makeHabit("h7", { schedule: { type: "custom", days: [0] } });
    expect(prog("d-habits-all", state({ habits: [sundayOnly] }))).toEqual({ current: 0, goal: 0 });
  });

  it("d-xp-100 sums XP awarded today, ignoring revoked entries", () => {
    expect(prog("d-xp-100", state({ xpLedger: [te("a", DAY, 60), he("h1", DAY)] }))).toEqual({ current: 70, goal: 100 });
    expect(prog("d-xp-100", state({ xpLedger: [entry("task", "a", DAY, 60, { deletedAt: STAMP }), he("h1", DAY)] }))).toEqual({ current: 10, goal: 100 });
  });

  it("d-focus-45 sums planned minutes of completed sessions today", () => {
    expect(prog("d-focus-45", state({ focusSessions: [makeSession("f1", { plannedMinutes: 25 }), makeSession("f2", { plannedMinutes: 20 })] }))).toEqual({ current: 45, goal: 45 });
    expect(prog("d-focus-45", state({ focusSessions: [makeSession("f1", { plannedMinutes: 25 }), makeSession("f2", { plannedMinutes: 30, completed: false, endedAt: undefined })] }))).toEqual({ current: 25, goal: 45 });
  });

  it("weekly challenges read the week window, both ends inclusive", () => {
    expect(prog("w-tasks-15", state({ xpLedger: [te("a", "2026-11-02"), te("b", "2026-11-08")] }))).toEqual({ current: 2, goal: 15 });
    expect(prog("w-tasks-15", state({ xpLedger: [te("a", "2026-11-01"), te("b", "2026-11-09")] }))).toEqual({ current: 0, goal: 15 });
  });

  it("w-target-4 counts days meeting the focus target", () => {
    const sessions = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"].map((d, i) =>
      makeSession("f" + i, { localDay: d, plannedMinutes: 100 }),
    );
    expect(prog("w-target-4", state({ focusSessions: sessions }))).toEqual({ current: 4, goal: 4 });
    expect(prog("w-target-4", state({ focusSessions: sessions.slice(0, 3) }))).toEqual({ current: 3, goal: 4 });
  });

  it("w-habits-12 counts done habit logs in the week window", () => {
    const habits = [makeHabit("h1"), makeHabit("h2"), makeHabit("h3")];
    const logs: HabitLog[] = [];
    for (let d = 0; d < 4; d++) {
      for (const h of habits) logs.push(makeLog({ habitId: h.id, localDay: addDays(WEEK_START, d) }));
    }
    expect(prog("w-habits-12", state({ habits, habitLogs: logs }))).toEqual({ current: 12, goal: 12 });
  });

  it("grants one coins-only bonus per completed daily challenge, once per period", () => {
    const tasks = Array.from({ length: 5 }, (_, i) => makeTask("t" + i));
    const sessions = [makeSession("f1"), makeSession("f2")];
    const h = makeHabit("h1");
    const ledger: XpLedgerEntry[] = [
      ...tasks.map((t) => te(t.id)),
      fe("f1"),
      fe("f2"),
      he("h1"),
    ];
    const s = state({
      tasks,
      habits: [h],
      habitLogs: [makeLog({ habitId: "h1", localDay: DAY })],
      focusSessions: sessions,
      xpLedger: ledger,
    });
    const grants = computeChallengeGrants(s);
    expect(grants).toHaveLength(3);
    const selected = new Set(dailyChallenges(DAY).map((d) => d.id));
    for (const g of grants) {
      expect(selected.has(g.sourceId as ChallengeId)).toBe(true);
      expect(g.sourceType).toBe("challenge");
      expect(g.localDay).toBe(DAY);
      expect(g.xp).toBe(0);
      expect(g.coins).toBe(DAILY_CHALLENGE_COINS);
    }
    const claimed = dailyChallenges(DAY).map((d) => entry("challenge", d.id, DAY, 0, { coins: DAILY_CHALLENGE_COINS }));
    expect(computeChallengeGrants({ ...s, xpLedger: [...ledger, ...claimed] })).toHaveLength(0);
    expect(computeChallengeGrants(state())).toHaveLength(0);
  });

  it("weekly grants anchor to the week start", () => {
    const WEEK_DAYS = ["2026-11-02", "2026-11-03", "2026-11-06", "2026-11-07"]; // skips today
    const ledger: XpLedgerEntry[] = [];
    for (let i = 0; i < 15; i++) ledger.push(te("w" + i, WEEK_DAYS[i % 4]!, i < 10 ? 20 : 42));
    const sessions: FocusSession[] = [];
    [2, 2, 1, 1].forEach((count, d) => {
      const day = WEEK_DAYS[d]!;
      for (let k = 0; k < count; k++) {
        sessions.push(makeSession("fs" + d + "-" + k, { localDay: day, plannedMinutes: count === 1 ? 100 : 50 }));
      }
    });
    const habits = [makeHabit("h1"), makeHabit("h2"), makeHabit("h3")];
    const logs: HabitLog[] = [];
    for (let d = 0; d < 4; d++) {
      for (const h of habits) logs.push(makeLog({ habitId: h.id, localDay: WEEK_DAYS[d]! }));
    }
    const s = state({ habits, habitLogs: logs, focusSessions: sessions, xpLedger: ledger });
    const grants = computeChallengeGrants(s);
    expect(grants).toHaveLength(2);
    const selected = new Set(weeklyChallenges(WEEK_START).map((d) => d.id));
    for (const g of grants) {
      expect(selected.has(g.sourceId as ChallengeId)).toBe(true);
      expect(g.sourceType).toBe("challenge");
      expect(g.localDay).toBe(WEEK_START);
      expect(g.xp).toBe(0);
      expect(g.coins).toBe(WEEKLY_CHALLENGE_COINS);
    }
  });

  it("bonuses never count toward the daily XP cap: a capped day still grants coins", () => {
    let day = DAY;
    for (let i = 0; i < 60; i++) {
      const d = addDays(DAY, -i);
      if (dailyChallenges(d).some((c) => c.id === "d-xp-100")) {
        day = d;
        break;
      }
    }
    const s = state({ today: day, xpLedger: [entry("task", "t1", day, 300)] });
    expect(prog("d-xp-100", s)).toEqual({ current: 300, goal: 100 });
    const grants = computeChallengeGrants(s);
    expect(grants.some((g) => g.sourceId === "d-xp-100" && g.xp === 0 && g.coins === DAILY_CHALLENGE_COINS)).toBe(true);
  });
});
