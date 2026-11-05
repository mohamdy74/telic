import { describe, expect, it } from "vitest";
import { addDays, addMonths, defaultWeekStartsOn, endOfMonth, endOfWeek, startOfMonth, startOfWeek, toLocalDay } from "./dates";

describe("toLocalDay", () => {
  it("dayStartHour=4 puts 02:30 on the previous day", () => {
    // 02:30 in Cairo (UTC+2 in Nov) = 00:30Z
    expect(toLocalDay(new Date("2026-11-05T00:30:00Z"), 4, "Africa/Cairo")).toBe("2026-11-04");
    expect(toLocalDay(new Date("2026-11-05T00:30:00Z"), 0, "Africa/Cairo")).toBe("2026-11-05");
  });
  it("04:00 exactly starts the new day", () => {
    expect(toLocalDay(new Date("2026-11-05T02:00:00Z"), 4, "Africa/Cairo")).toBe("2026-11-05");
  });
  it("same instant gives different days in different timezones", () => {
    const d = new Date("2026-03-10T23:30:00Z");
    expect(toLocalDay(d, 0, "UTC")).toBe("2026-03-10");
    expect(toLocalDay(d, 0, "Asia/Tokyo")).toBe("2026-03-11");
    expect(toLocalDay(d, 0, "America/Los_Angeles")).toBe("2026-03-10");
  });
  it("handles US spring-forward DST (2026-03-08)", () => {
    // 01:59 PST and 03:00 PDT are both March 8
    expect(toLocalDay(new Date("2026-03-08T09:59:00Z"), 0, "America/New_York")).toBe("2026-03-08");
    expect(toLocalDay(new Date("2026-03-08T07:30:00Z"), 4, "America/New_York")).toBe("2026-03-07"); // 03:30 EDT < 4
    expect(toLocalDay(new Date("2026-03-08T08:30:00Z"), 4, "America/New_York")).toBe("2026-03-08"); // 04:30 EDT
  });
  it("handles fall-back DST (2026-11-01) repeated hour", () => {
    // 01:30 EDT and 01:30 EST both map to Nov 1
    expect(toLocalDay(new Date("2026-11-01T05:30:00Z"), 0, "America/New_York")).toBe("2026-11-01");
    expect(toLocalDay(new Date("2026-11-01T06:30:00Z"), 0, "America/New_York")).toBe("2026-11-01");
    expect(toLocalDay(new Date("2026-11-01T06:30:00Z"), 4, "America/New_York")).toBe("2026-10-31");
  });
});

describe("day arithmetic", () => {
  it("addDays across DST and year boundaries", () => {
    expect(addDays("2026-03-07", 2)).toBe("2026-03-09");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("addMonths clamps to month end", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
  });
});

describe("week boundaries", () => {
  // 2026-11-05 is a Thursday
  it("Monday start (English)", () => {
    expect(startOfWeek("2026-11-05", 1)).toBe("2026-11-02");
    expect(endOfWeek("2026-11-05", 1)).toBe("2026-11-08");
    expect(startOfWeek("2026-11-02", 1)).toBe("2026-11-02");
    expect(startOfWeek("2026-11-08", 1)).toBe("2026-11-02");
  });
  it("Saturday start (Arabic)", () => {
    expect(startOfWeek("2026-11-05", 6)).toBe("2026-10-31");
    expect(endOfWeek("2026-11-05", 6)).toBe("2026-11-06");
    expect(startOfWeek("2026-11-07", 6)).toBe("2026-11-07");
  });
  it("defaults per language", () => {
    expect(defaultWeekStartsOn("ar")).toBe(6);
    expect(defaultWeekStartsOn("en")).toBe(1);
  });
});

describe("month boundaries", () => {
  it("start/end of month incl. leap February", () => {
    expect(startOfMonth("2026-11-05")).toBe("2026-11-01");
    expect(endOfMonth("2026-11-05")).toBe("2026-11-30");
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
  });
});
