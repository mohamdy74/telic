import { describe, expect, it } from "vitest";
import { nextOccurrence } from "./recurrence";

describe("nextOccurrence", () => {
  it("daily every 2 days", () => {
    expect(nextOccurrence({ freq: "daily", interval: 2 }, "2026-11-05")).toBe("2026-11-07");
  });
  it("weekly on Mon/Thu from Thursday goes to next Monday", () => {
    expect(nextOccurrence({ freq: "weekly", interval: 1, byWeekday: [1, 4] }, "2026-11-05")).toBe("2026-11-09");
  });
  it("weekly on Mon/Thu from Monday goes to Thursday", () => {
    expect(nextOccurrence({ freq: "weekly", interval: 1, byWeekday: [1, 4] }, "2026-11-09")).toBe("2026-11-12");
  });
  it("monthly clamps Jan 31 to Feb 28", () => {
    expect(nextOccurrence({ freq: "monthly", interval: 1 }, "2026-01-31")).toBe("2026-02-28");
  });
});
