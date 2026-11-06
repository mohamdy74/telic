import { describe, expect, it } from "vitest";
import { addDays, toLocalDay } from "./dates";
import { consistency30, dayKind, habitStreaks, isScheduledOn, logsByDay } from "./streaks";
import type { Habit, HabitLog, HabitSchedule } from "./types";

const T = "2026-01-10"; // a Saturday
const ISO = "2026-01-01T00:00:00.000Z";

function habit(schedule: HabitSchedule): Habit {
  return { id: "h1", name: "Test", schedule, archived: false, createdAt: ISO, updatedAt: ISO };
}

function log(day: string, status: "done" | "skipped"): HabitLog {
  return {
    id: day + "-" + status,
    habitId: "h1",
    localDay: day,
    status,
    createdAt: ISO,
    updatedAt: ISO,
  };
}

const daily: HabitSchedule = { type: "daily", days: [0, 1, 2, 3, 4, 5, 6] };
const monWedFri: HabitSchedule = { type: "weekly", days: [1, 3, 5] };
const monOnly: HabitSchedule = { type: "weekly", days: [1] };

function many(from: string, to: string, status: "done" | "skipped"): HabitLog[] {
  const out: HabitLog[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(log(d, status));
  return out;
}

describe("isScheduledOn", () => {
  it("daily is scheduled every day", () => {
    expect(isScheduledOn(daily, T)).toBe(true);
  });

  it("weekly/custom follow the weekday list", () => {
    expect(isScheduledOn(monWedFri, "2026-01-05")).toBe(true); // Monday
    expect(isScheduledOn(monWedFri, "2026-01-06")).toBe(false); // Tuesday
    expect(isScheduledOn({ type: "custom", days: [] }, T)).toBe(false);
  });
});

describe("habitStreaks", () => {
  it("no history, zero streaks", () => {
    expect(habitStreaks(habit(daily), [], T, 1)).toEqual({ current: 0, best: 0 });
  });

  it("counts consecutive scheduled days", () => {
    const logs = [log("2026-01-08", "done"), log("2026-01-09", "done"), log(T, "done")];
    expect(habitStreaks(habit(daily), logs, T, 1)).toEqual({ current: 3, best: 3 });
  });

  it("a missed scheduled day breaks the streak", () => {
    const logs = [log("2026-01-08", "done"), log(T, "done")]; // 01-09 missing
    expect(habitStreaks(habit(daily), logs, T, 1)).toEqual({ current: 1, best: 1 });
  });

  it("a skipped day neither breaks nor extends", () => {
    const logs = [log("2026-01-08", "done"), log("2026-01-09", "skipped"), log(T, "done")];
    expect(habitStreaks(habit(daily), logs, T, 1)).toEqual({ current: 2, best: 2 });
  });

  it("two skips in one week are protected (week starts Monday)", () => {
    const logs = [
      log("2026-01-04", "done"),
      log("2026-01-05", "skipped"),
      log("2026-01-06", "skipped"),
      log("2026-01-07", "done"),
    ];
    expect(habitStreaks(habit(daily), logs, "2026-01-08", 1)).toEqual({ current: 2, best: 2 });
  });

  it("a third skip in the same week breaks (week starts Monday)", () => {
    const logs = [
      log("2026-01-04", "done"),
      log("2026-01-05", "skipped"),
      log("2026-01-06", "skipped"),
      log("2026-01-07", "skipped"),
      log("2026-01-08", "done"),
    ];
    expect(habitStreaks(habit(daily), logs, "2026-01-08", 1)).toEqual({ current: 1, best: 1 });
  });

  it("the skip limit respects the week boundary in both week-start settings", () => {
    // Fri 01-09, Sat 01-10 and Sun 01-11 are three skips.
    const logs = [
      log("2026-01-08", "done"),
      log("2026-01-09", "skipped"),
      log("2026-01-10", "skipped"),
      log("2026-01-11", "skipped"),
      log("2026-01-12", "done"),
    ];
    // Mon-start weeks: Fri+Sat+Sun fall in the same week, the 3rd skip breaks.
    expect(habitStreaks(habit(daily), logs, "2026-01-12", 1).current).toBe(1);
    // Sat-start weeks: Sat and Sun open a new week, every skip stays protected.
    expect(habitStreaks(habit(daily), logs, "2026-01-12", 6).current).toBe(2);
  });

  it("unscheduled days never break or extend", () => {
    const logs = [
      log("2026-01-05", "done"), // Monday
      log("2026-01-06", "done"), // Tuesday — off day, its done log never extends
      log("2026-01-09", "done"), // Friday
    ];
    // Wed 01-07 has no log, so the streak ends there.
    expect(habitStreaks(habit(monWedFri), logs, T, 1)).toEqual({ current: 1, best: 1 });
  });

  it("today never breaks the streak until the day ends", () => {
    const logs = [log("2026-01-08", "done"), log("2026-01-09", "done")];
    expect(habitStreaks(habit(daily), logs, T, 1)).toEqual({ current: 2, best: 2 });
  });

  it("skipping today keeps the streak", () => {
    const logs = [log("2026-01-08", "done"), log("2026-01-09", "done"), log(T, "skipped")];
    expect(habitStreaks(habit(daily), logs, T, 1)).toEqual({ current: 2, best: 2 });
  });

  it("best survives a longer past run", () => {
    const logs = [...many("2026-01-01", "2026-01-05", "done"), log("2026-01-07", "done")];
    expect(habitStreaks(habit(daily), logs, "2026-01-08", 1)).toEqual({ current: 1, best: 5 });
  });

  it("month and year boundaries never drop days", () => {
    const feb = [log("2026-02-27", "done"), log("2026-02-28", "done"), log("2026-03-01", "done")];
    expect(habitStreaks(habit(daily), feb, "2026-03-01", 1).current).toBe(3);
    const yr = [log("2026-12-30", "done"), log("2026-12-31", "done"), log("2027-01-01", "done")];
    expect(habitStreaks(habit(daily), yr, "2027-01-01", 1).current).toBe(3);
  });

  it("DST spring-forward still counts the transition day (America/New_York)", () => {
    const at = (utc: string) => toLocalDay(new Date(utc), 0, "America/New_York");
    expect(at("2026-03-07T12:00:00Z")).toBe("2026-03-07");
    expect(at("2026-03-08T06:00:00Z")).toBe("2026-03-08"); // the hour at 02:00 is lost
    const logs = [log("2026-03-07", "done"), log("2026-03-08", "done"), log("2026-03-09", "done")];
    expect(habitStreaks(habit(daily), logs, "2026-03-09", 1).current).toBe(3);
  });

  it("dayStartHour=4 counts early-morning activity as the previous day (Africa/Cairo)", () => {
    const lateNight = new Date("2026-03-10T01:30:00Z"); // 03:30 in Cairo
    expect(toLocalDay(lateNight, 4, "Africa/Cairo")).toBe("2026-03-09");
    expect(toLocalDay(lateNight, 0, "Africa/Cairo")).toBe("2026-03-10");
    // A done logged at 03:30 lands on 03-09, and the streak counts it.
    const logs = [log("2026-03-08", "done"), log("2026-03-09", "done")];
    expect(habitStreaks(habit(daily), logs, "2026-03-09", 1).current).toBe(2);
  });

  it("DST fall-back still counts the transition day (America/New_York)", () => {
    const at = (utc: string) => toLocalDay(new Date(utc), 0, "America/New_York");
    expect(at("2026-11-01T06:30:00Z")).toBe("2026-11-01"); // the hour at 02:00 repeats
    const logs = [log("2026-10-30", "done"), log("2026-10-31", "done"), log("2026-11-01", "done")];
    expect(habitStreaks(habit(daily), logs, "2026-11-01", 1).current).toBe(3);
  });
});

describe("consistency30", () => {
  it("done over scheduled minus skipped (30 days)", () => {
    const logs = [
      ...many("2026-01-01", "2026-01-20", "done"),
      ...many("2026-01-21", "2026-01-23", "skipped"),
    ];
    // 20 done, 3 skipped (excluded from the denominator), 7 missed.
    expect(consistency30(habit(daily), logs, "2026-01-30")).toBeCloseTo(20 / 27);
  });

  it("counts only scheduled days (weekly habit)", () => {
    const logs = [
      log("2026-01-05", "done"),
      log("2026-01-12", "skipped"),
      log("2026-01-19", "done"),
      log("2026-01-26", "done"),
    ];
    // Four Mondays in the window; one is skipped, so 3 done of 3 scheduled.
    expect(consistency30(habit(monOnly), logs, "2026-01-30")).toBe(1);
  });

  it("null when nothing is scheduled", () => {
    expect(consistency30(habit({ type: "custom", days: [] }), [], T)).toBeNull();
  });
});

describe("dayKind", () => {
  const by = logsByDay([log("2026-01-05", "done"), log("2026-01-06", "skipped")]);

  it("classifies done, skipped, missed, upcoming and off days", () => {
    expect(dayKind(monWedFri, by, "2026-01-05", "2026-01-08")).toBe("done");
    expect(dayKind(monWedFri, by, "2026-01-06", "2026-01-08")).toBe("skipped"); // off-day log still shows
    expect(dayKind(monWedFri, by, "2026-01-07", "2026-01-08")).toBe("missed"); // Wednesday, no log
    expect(dayKind(monWedFri, by, "2026-01-09", "2026-01-08")).toBe("upcoming"); // future Friday
    expect(dayKind(monWedFri, by, "2026-01-08", "2026-01-08")).toBe("off"); // Thursday, unscheduled
  });

  it("keeps the latest log per day", () => {
    const two = logsByDay([
      { ...log("2026-01-05", "done"), updatedAt: "2026-01-05T10:00:00.000Z" },
      { ...log("2026-01-05", "skipped"), id: "x2", updatedAt: "2026-01-05T12:00:00.000Z" },
    ]);
    expect(two.get("2026-01-05")?.status).toBe("skipped");
  });
});
