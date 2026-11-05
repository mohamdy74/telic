import { describe, expect, it } from "vitest";
import { toLocalDay } from "./dates";
import {
  actualMinutes,
  groupByDay,
  isActive,
  isOverdue,
  nextBreakMinutes,
  remainingMs,
  shiftEndsAfterResume,
  workCompletedToday,
  workMinutesToday,
} from "./focusTime";
import type { FocusSession } from "./types";

const START = Date.parse("2026-03-09T10:00:00.000Z");
const ENDS = Date.parse("2026-03-09T10:25:00.000Z");

function session(partial: Partial<FocusSession> = {}): FocusSession {
  return {
    id: "s1",
    mode: "pomodoro",
    plannedMinutes: 25,
    startedAt: new Date(START).toISOString(),
    endsAt: new Date(ENDS).toISOString(),
    completed: false,
    distractions: [],
    localDay: "2026-03-09",
    createdAt: new Date(START).toISOString(),
    updatedAt: new Date(START).toISOString(),
    ...partial,
  };
}

describe("remainingMs", () => {
  it("counts down from the stored timestamps", () => {
    expect(remainingMs(session(), START + 5 * 60_000)).toBe(20 * 60_000);
  });

  it("clamps at zero when overdue", () => {
    expect(remainingMs(session(), ENDS + 10 * 60_000)).toBe(0);
  });

  it("freezes while paused, no matter how long ago the pause was", () => {
    const paused = session({ pausedAt: new Date(START + 10 * 60_000).toISOString() });
    // paused at 10:10; thirty minutes later the display still shows 15 minutes.
    expect(remainingMs(paused, START + 40 * 60_000)).toBe(15 * 60_000);
  });
});

describe("pause / resume", () => {
  it("shifts endsAt forward by the paused duration", () => {
    const pausedAt = new Date(START + 60_000).toISOString();
    const shifted = shiftEndsAfterResume(new Date(ENDS).toISOString(), pausedAt, START + 5 * 60_000);
    // paused for 4 minutes, so the session ends 4 minutes later.
    expect(Date.parse(shifted)).toBe(ENDS + 4 * 60_000);
  });

  it("a resume at the pause moment shifts nothing", () => {
    const pausedAt = new Date(START).toISOString();
    expect(Date.parse(shiftEndsAfterResume(new Date(ENDS).toISOString(), pausedAt, START))).toBe(ENDS);
  });
});

describe("completion detection", () => {
  it("isOverdue after a long background stay", () => {
    expect(isOverdue(session(), ENDS + 2 * 3_600_000)).toBe(true);
  });

  it("not overdue while paused or already ended", () => {
    const pausedAt = new Date(ENDS - 60_000).toISOString();
    expect(isOverdue(session({ pausedAt }), ENDS + 60_000)).toBe(false);
    expect(isOverdue(session({ endedAt: new Date(ENDS).toISOString() }), ENDS + 60_000)).toBe(false);
  });

  it("isActive separates live sessions from finished ones", () => {
    expect(isActive(session())).toBe(true);
    expect(isActive(session({ endedAt: new Date(ENDS).toISOString() }))).toBe(false);
    expect(isActive(session({ deletedAt: new Date(ENDS).toISOString() }))).toBe(false);
  });
});

describe("planned vs actual", () => {
  it("actual minutes are wall time, pauses included", () => {
    expect(actualMinutes(session({ endedAt: new Date(ENDS).toISOString() }))).toBe(25);
    // endsAt shifted 5 minutes by a pause -> the wall clock shows 30 actual minutes.
    expect(actualMinutes(session({ endedAt: new Date(ENDS + 5 * 60_000).toISOString() }))).toBe(30);
  });

  it("null while the session is still running", () => {
    expect(actualMinutes(session())).toBeNull();
  });
});

describe("long break cadence", () => {
  it("a long break after every 4 completed work sessions", () => {
    expect(nextBreakMinutes(0, 5, 15)).toBe(5);
    expect(nextBreakMinutes(3, 5, 15)).toBe(5);
    expect(nextBreakMinutes(4, 5, 15)).toBe(15);
    expect(nextBreakMinutes(5, 5, 15)).toBe(5);
    expect(nextBreakMinutes(8, 5, 15)).toBe(15);
  });
});

describe("today's focus", () => {
  const done = session({ completed: true });
  const cancelled = session({ id: "s2", completed: false, endedAt: new Date(ENDS - 10 * 60_000).toISOString() });
  const brk = session({ id: "s3", mode: "break", plannedMinutes: 5, completed: true });
  const otherDay = session({ id: "s4", completed: true, localDay: "2026-03-08" });

  it("counts completed work sessions only", () => {
    expect(workCompletedToday([done, cancelled, brk, otherDay], "2026-03-09")).toBe(1);
    expect(workMinutesToday([done, cancelled, brk, otherDay], "2026-03-09")).toBe(25);
  });
});

describe("history grouping across midnight", () => {
  it("a session crossing midnight stays on its startedAt day (Africa/Cairo)", () => {
    // Started 23:50 local on Mar 9, ended 00:20 local on Mar 10 in Cairo.
    const startedAt = "2026-03-09T21:50:00.000Z";
    const endsAt = "2026-03-09T22:20:00.000Z";
    expect(toLocalDay(new Date(startedAt), 0, "Africa/Cairo")).toBe("2026-03-09");
    expect(toLocalDay(new Date(endsAt), 0, "Africa/Cairo")).toBe("2026-03-10");
    const s = session({ startedAt, endsAt, localDay: "2026-03-09" });
    const groups = groupByDay([s]);
    expect([...groups.keys()]).toEqual(["2026-03-09"]);
    expect(groups.get("2026-03-09")).toHaveLength(1);
  });

  it("dayStartHour=4 keeps a 3am session on the previous day", () => {
    // 03:00 local in Cairo on Mar 10 belongs to Mar 9 when the day starts at 4.
    const startedAt = "2026-03-10T01:00:00.000Z";
    expect(toLocalDay(new Date(startedAt), 4, "Africa/Cairo")).toBe("2026-03-09");
    const s = session({ startedAt, endsAt: "2026-03-10T01:25:00.000Z", localDay: "2026-03-09" });
    expect([...groupByDay([s]).keys()]).toEqual(["2026-03-09"]);
  });
});
