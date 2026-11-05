import { describe, expect, it } from "vitest";
import { nextOccurrence } from "./recurrence";

describe("nextOccurrence", () => {
  it("daily every day", () => {
    expect(nextOccurrence({ freq: "daily", interval: 1 }, "2026-11-05")).toBe("2026-11-06");
  });

  it("daily every 2 days", () => {
    expect(nextOccurrence({ freq: "daily", interval: 2 }, "2026-11-05")).toBe("2026-11-07");
  });

  it("daily every 3 days", () => {
    expect(nextOccurrence({ freq: "daily", interval: 3 }, "2026-11-05")).toBe("2026-11-08");
  });

  it("weekly on Mon/Thu from Thursday goes to next Monday", () => {
    expect(nextOccurrence({ freq: "weekly", interval: 1, byWeekday: [1, 4] }, "2026-11-05")).toBe("2026-11-09");
  });

  it("weekly on Mon/Thu from Monday goes to Thursday", () => {
    expect(nextOccurrence({ freq: "weekly", interval: 1, byWeekday: [1, 4] }, "2026-11-09")).toBe("2026-11-12");
  });

  it("weekly on Saturday from Friday is the next day", () => {
    expect(nextOccurrence({ freq: "weekly", interval: 1, byWeekday: [6] }, "2026-11-06")).toBe("2026-11-07");
  });

  it("weekly with no days falls back to every 7 days", () => {
    expect(nextOccurrence({ freq: "weekly", interval: 1 }, "2026-11-05")).toBe("2026-11-12");
  });

  it("weekly every 2 weeks on Monday", () => {
    expect(nextOccurrence({ freq: "weekly", interval: 2, byWeekday: [1] }, "2026-11-09")).toBe("2026-11-23");
  });

  it("monthly clamps Jan 31 to Feb 28", () => {
    expect(nextOccurrence({ freq: "monthly", interval: 1 }, "2026-01-31")).toBe("2026-02-28");
  });

  it("monthly clamps Jan 30 to Feb 28", () => {
    expect(nextOccurrence({ freq: "monthly", interval: 1 }, "2026-01-30")).toBe("2026-02-28");
  });

  it("monthly clamps Mar 31 to Apr 30", () => {
    expect(nextOccurrence({ freq: "monthly", interval: 1 }, "2026-03-31")).toBe("2026-04-30");
  });

  it("monthly keeps the Feb 28 anchor into Mar 28", () => {
    expect(nextOccurrence({ freq: "monthly", interval: 1 }, "2026-02-28")).toBe("2026-03-28");
  });

  it("monthly from Dec 31 lands Jan 31", () => {
    expect(nextOccurrence({ freq: "monthly", interval: 1 }, "2026-12-31")).toBe("2027-01-31");
  });

  it("monthly in a leap year lands Feb 29", () => {
    expect(nextOccurrence({ freq: "monthly", interval: 1 }, "2028-01-31")).toBe("2028-02-29");
  });

  it("monthly every 3 months from Nov 30 clamps to Feb 28", () => {
    expect(nextOccurrence({ freq: "monthly", interval: 3 }, "2026-11-30")).toBe("2027-02-28");
  });
});
