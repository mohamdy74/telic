import { describe, expect, it } from "vitest";
import { awardXp, revokeXp, totalsFromLedger, type NewXpEntry } from "./rewards";
import { HABIT_XP, TASK_XP, levelFromXp, totalXpForLevel, xpForLevel } from "./rewardsConfig";
import type { FocusSession, Task, XpLedgerEntry } from "./types";

const DAY = "2026-11-05";
const OTHER_DAY = "2026-11-06";
const STAMP = "2026-11-05T12:00:00.000Z";

let seq = 0;
const nextId = (p: string) => p + "-" + ++seq;

function makeTask(over: Partial<Task> = {}): Task {
  return {
    id: nextId("task"),
    title: "Task",
    priority: "medium",
    tags: [],
    subtasks: [],
    status: "todo",
    kanbanOrder: 0,
    createdAt: "2026-11-05T10:00:00.000Z",
    updatedAt: STAMP,
    ...over,
  };
}

function makeSession(over: Partial<FocusSession> = {}): FocusSession {
  return {
    id: nextId("focus"),
    mode: "pomodoro",
    plannedMinutes: 25,
    startedAt: "2026-11-05T09:00:00.000Z",
    endsAt: "2026-11-05T09:25:00.000Z",
    completed: true,
    distractions: [],
    localDay: DAY,
    createdAt: "2026-11-05T09:00:00.000Z",
    updatedAt: STAMP,
    ...over,
  };
}

function makeLedgerEntry(over: Partial<XpLedgerEntry> = {}): XpLedgerEntry {
  return {
    id: nextId("xp"),
    sourceType: "task",
    sourceId: nextId("src"),
    localDay: DAY,
    xp: 0,
    coins: 0,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...over,
  };
}

/** Mimics what xp.add does in the store: commit a new entry with identity fields. */
function commit(ledger: XpLedgerEntry[], entry: NewXpEntry): XpLedgerEntry[] {
  return [...ledger, { ...entry, id: nextId("xp"), createdAt: STAMP, updatedAt: STAMP }];
}

/** Mimics the store revoke: soft-delete the matched entries. */
function softDelete(ledger: XpLedgerEntry[], doomed: XpLedgerEntry[]): XpLedgerEntry[] {
  return ledger.map((e) => (doomed.includes(e) ? { ...e, deletedAt: STAMP, updatedAt: STAMP } : e));
}

/** A task completed 5 minutes after creation (past the minimum age). */
const completedTask = (over: Partial<Task> = {}): Task & { completedAt: string } => ({
  ...makeTask(over),
  status: "done",
  completedAt: "2026-11-05T10:05:00.000Z",
});

const taskEvent = (over: Partial<Task> = {}) => ({
  kind: "task-completed" as const,
  task: completedTask(over),
  localDay: DAY,
});

describe("level curve (xpForLevel / levelFromXp)", () => {
  it("costs 100 XP to go from level 1 to level 2", () => {
    expect(xpForLevel(1)).toBe(100);
  });

  it("costs 283 XP to go from level 2 to level 3", () => {
    expect(xpForLevel(2)).toBe(283);
  });

  it("costs 3162 XP to go from level 10 to level 11", () => {
    expect(xpForLevel(10)).toBe(3162);
  });

  it("costs 35355 XP to go from level 50 to level 51", () => {
    expect(xpForLevel(50)).toBe(35355);
  });

  it("level 1 starts at 0 XP; level 2 is reached at exactly 100 XP", () => {
    expect(levelFromXp(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNextLevel: 100 });
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100)).toEqual({ level: 2, xpIntoLevel: 0, xpForNextLevel: 283 });
  });

  it("totalXpForLevel matches the step sums (level 3 needs 383 total XP)", () => {
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(3)).toBe(383);
    expect(levelFromXp(383).level).toBe(3);
    expect(levelFromXp(382).level).toBe(2);
  });
});

describe("awardXp: sources", () => {
  it("task XP follows priority: low 5, medium 10, high 20", () => {
    expect(awardXp(taskEvent({ priority: "low" }), []).entry?.xp).toBe(TASK_XP.low);
    expect(awardXp(taskEvent({ priority: "medium" }), []).entry?.xp).toBe(TASK_XP.medium);
    expect(awardXp(taskEvent({ priority: "high" }), []).entry?.xp).toBe(TASK_XP.high);
  });

  it("habit done-log awards 10 XP", () => {
    const res = awardXp({ kind: "habit-done", habitId: "h1", localDay: DAY }, []);
    expect(res.entry).toMatchObject({ sourceType: "habit", sourceId: "h1", localDay: DAY, xp: HABIT_XP });
    expect(res.reason).toBeNull();
  });

  it("focus awards 1 XP per full planned minute", () => {
    const res = awardXp({ kind: "focus-completed", session: makeSession({ plannedMinutes: 40 }) }, []);
    expect(res.entry?.xp).toBe(40);
  });
});

describe("awardXp: daily cap", () => {
  it("awards past the cap are denied with daily-cap", () => {
    const capped = [makeLedgerEntry({ xp: 300, localDay: DAY })];
    const res = awardXp({ kind: "habit-done", habitId: "h1", localDay: DAY }, capped);
    expect(res.entry).toBeNull();
    expect(res.reason).toBe("daily-cap");
  });

  it("a partial award exactly reaches the cap, then the day is closed", () => {
    const almost = [makeLedgerEntry({ xp: 290, localDay: DAY })];
    const first = awardXp(taskEvent({ priority: "high" }), almost); // 20 base XP
    expect(first.entry?.xp).toBe(10);
    const after = commit(almost, first.entry!);
    const second = awardXp({ kind: "habit-done", habitId: "h1", localDay: DAY }, after);
    expect(second.entry).toBeNull();
    expect(second.reason).toBe("daily-cap");
  });

  it("the cap counts only the stored localDay, other days are unaffected", () => {
    const otherDay = [makeLedgerEntry({ xp: 300, localDay: OTHER_DAY })];
    const res = awardXp({ kind: "habit-done", habitId: "h1", localDay: DAY }, otherDay);
    expect(res.entry?.xp).toBe(HABIT_XP);
  });
});

describe("awardXp: task minimum age (anti self-cheat)", () => {
  it("a task completed within 2 minutes of creation earns 0 (task-too-new)", () => {
    const res = awardXp(
      {
        kind: "task-completed",
        localDay: DAY,
        task: {
          ...makeTask(),
          status: "done",
          completedAt: "2026-11-05T10:01:30.000Z", // 90s after creation
        },
      },
      [],
    );
    expect(res.entry).toBeNull();
    expect(res.reason).toBe("task-too-new");
  });

  it("a task completed after 2 minutes earns full XP", () => {
    const res = awardXp(
      {
        kind: "task-completed",
        localDay: DAY,
        task: {
          ...makeTask(),
          status: "done",
          completedAt: "2026-11-05T10:02:01.000Z", // 121s after creation
        },
      },
      [],
    );
    expect(res.entry?.xp).toBe(TASK_XP.medium);
  });

  it("recurring instances measure age from the spawn time of the instance", () => {
    // The next instance is created the moment its predecessor completes; its
    // createdAt IS the spawn time. Completing it 90s later earns nothing.
    const res = awardXp(
      {
        kind: "task-completed",
        localDay: DAY,
        task: {
          ...makeTask({ createdAt: "2026-11-05T10:00:00.000Z" }),
          status: "done",
          completedAt: "2026-11-05T10:01:30.000Z", // 90s after spawn
        },
      },
      [],
    );
    expect(res.reason).toBe("task-too-new");
  });
});

describe("awardXp: idempotency and undo", () => {
  it("each habit pays out once per localDay no matter how it was logged (duplicate)", () => {
    const event = { kind: "habit-done", habitId: "h1", localDay: DAY } as const;
    const ledger = commit([], awardXp(event, []).entry!);
    const again = awardXp(event, ledger);
    expect(again.entry).toBeNull();
    expect(again.reason).toBe("duplicate");
  });

  it("a duplicate task award is denied without re-awarding", () => {
    const event = taskEvent();
    const ledger = commit([], awardXp(event, []).entry!);
    const again = awardXp(event, ledger);
    expect(again.reason).toBe("duplicate");
  });

  it("complete -> undo -> redo never awards twice: exactly one live entry", () => {
    const event = taskEvent();
    let ledger = commit([], awardXp(event, []).entry!); // complete
    const doomed = revokeXp({ sourceType: "task", sourceId: event.task.id }, ledger);
    ledger = softDelete(ledger, doomed); // undo
    const redo = awardXp(event, ledger);
    expect(redo.entry).not.toBeNull();
    ledger = commit(ledger, redo.entry!); // redo
    const live = ledger.filter((e) => !e.deletedAt);
    expect(live).toHaveLength(1);
    expect(live[0]?.xp).toBe(TASK_XP.medium);
  });

  it("rapid toggle spam ends with one entry or zero, matching the final state", () => {
    const habitId = "h1";
    const source = { sourceType: "habit" as const, sourceId: habitId, localDay: DAY };
    const live = (l: XpLedgerEntry[]) => l.filter((e) => !e.deletedAt);
    // Same guards the store uses: denied awards commit nothing.
    const markDone = (l: XpLedgerEntry[]) => {
      const res = awardXp({ kind: "habit-done", habitId, localDay: DAY }, l);
      return res.entry ? commit(l, res.entry) : l;
    };
    const markUndone = (l: XpLedgerEntry[]) => softDelete(l, revokeXp(source, l));

    // 9 alternating toggles starting undone end on done: exactly one live entry.
    let ledger: XpLedgerEntry[] = [];
    for (let i = 0; i < 9; i++) ledger = i % 2 === 0 ? markDone(ledger) : markUndone(ledger);
    expect(live(ledger)).toHaveLength(1);
    expect(totalsFromLedger(ledger).xp).toBe(HABIT_XP);

    // 10 more alternating toggles starting done end on undone: zero live entries.
    for (let i = 0; i < 10; i++) ledger = i % 2 === 0 ? markUndone(ledger) : markDone(ledger);
    expect(live(ledger)).toHaveLength(0);
    expect(totalsFromLedger(ledger).xp).toBe(0);
  });
});

describe("awardXp: focus rules", () => {
  it("an early-stopped session gives 0 XP (focus-incomplete)", () => {
    const res = awardXp({ kind: "focus-completed", session: makeSession({ completed: false }) }, []);
    expect(res.entry).toBeNull();
    expect(res.reason).toBe("focus-incomplete");
  });

  it("break sessions give 0 XP (focus-break)", () => {
    const res = awardXp(
      { kind: "focus-completed", session: makeSession({ mode: "break", plannedMinutes: 5 }) },
      [],
    );
    expect(res.entry).toBeNull();
    expect(res.reason).toBe("focus-break");
  });
});

describe("awardXp: clock rule (awards use the stored day, never now)", () => {
  it("a capped stored day stays capped; another stored day still awards", () => {
    const capped = [makeLedgerEntry({ xp: 300, localDay: DAY })];
    const onCappedDay = awardXp({ kind: "habit-done", habitId: "h1", localDay: DAY }, capped);
    expect(onCappedDay.reason).toBe("daily-cap");
    const otherDay = awardXp({ kind: "habit-done", habitId: "h1", localDay: OTHER_DAY }, capped);
    expect(otherDay.entry?.localDay).toBe(OTHER_DAY);
  });

  it("the entry records the stored localDay of the event, not today", () => {
    const oldDay = "2026-10-01";
    const res = awardXp({ kind: "habit-done", habitId: "h1", localDay: oldDay }, []);
    expect(res.entry?.localDay).toBe(oldDay);
  });
});

describe("revokeXp", () => {
  it("removes only the matching identity and leaves other entries intact", () => {
    const ledger = [
      makeLedgerEntry({ sourceType: "habit", sourceId: "h1", localDay: DAY, xp: 10 }),
      makeLedgerEntry({ sourceType: "habit", sourceId: "h1", localDay: OTHER_DAY, xp: 10 }),
      makeLedgerEntry({ sourceType: "habit", sourceId: "h2", localDay: DAY, xp: 10 }),
    ];
    const doomed = revokeXp({ sourceType: "habit", sourceId: "h1", localDay: DAY }, ledger);
    expect(doomed).toHaveLength(1);
    expect(doomed[0]?.localDay).toBe(DAY);
  });

  it("task revoke matches any day (one live completion per task at a time)", () => {
    const ledger = [makeLedgerEntry({ sourceType: "task", sourceId: "t1", localDay: OTHER_DAY, xp: 10 })];
    const doomed = revokeXp({ sourceType: "task", sourceId: "t1" }, ledger);
    expect(doomed).toHaveLength(1);
  });

  it("revoked entries free cap room for later awards", () => {
    let ledger = [makeLedgerEntry({ sourceType: "habit", sourceId: "h1", localDay: DAY, xp: 300 })];
    const source = { sourceType: "habit" as const, sourceId: "h1", localDay: DAY };
    ledger = softDelete(ledger, revokeXp(source, ledger));
    const res = awardXp({ kind: "habit-done", habitId: "h1", localDay: DAY }, ledger);
    expect(res.entry?.xp).toBe(HABIT_XP);
  });
});

describe("totalsFromLedger (derived XP, coins, level)", () => {
  it("coins: 1 coin per 2 XP actually awarded, floored on the total (no per-entry loss)", () => {
    const ledger = [
      makeLedgerEntry({ sourceType: "task", sourceId: "t1", localDay: DAY, xp: 5 }),
      makeLedgerEntry({ sourceType: "task", sourceId: "t2", localDay: DAY, xp: 5 }),
    ];
    const totals = totalsFromLedger(ledger);
    expect(totals.xp).toBe(10);
    expect(totals.coins).toBe(5); // floor(10/2), not floor(5/2) * 2
  });

  it("shop spending subtracts coins but never XP", () => {
    const ledger = [
      makeLedgerEntry({ sourceType: "task", sourceId: "t1", localDay: DAY, xp: 40 }),
      makeLedgerEntry({ sourceType: "shop", sourceId: "shop-1", localDay: DAY, xp: 0, coins: -3 }),
    ];
    const totals = totalsFromLedger(ledger);
    expect(totals.xp).toBe(40);
    expect(totals.coins).toBe(17);
  });

  it("soft-deleted entries are ignored", () => {
    const ledger = [
      makeLedgerEntry({ xp: 20 }),
      makeLedgerEntry({ xp: 300, deletedAt: STAMP }),
    ];
    expect(totalsFromLedger(ledger).xp).toBe(20);
  });

  it("level reflects the summed ledger XP", () => {
    const ledger = [makeLedgerEntry({ xp: 100 }), makeLedgerEntry({ localDay: OTHER_DAY, xp: 283 })];
    const totals = totalsFromLedger(ledger);
    expect(totals.level).toBe(3);
    expect(totals.xpIntoLevel).toBe(0);
    expect(totals.xpForNextLevel).toBe(xpForLevel(3));
  });
});
