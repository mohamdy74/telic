import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "./quickAdd";

const T = "2026-11-05";

describe("parseQuickAdd", () => {
  it("keeps plain text untouched", () => {
    expect(parseQuickAdd("Buy milk", T)).toEqual({
      title: "Buy milk",
      priority: undefined,
      tags: [],
      dueDate: undefined,
    });
  });

  it("parses priority, tags and a due date (EN)", () => {
    expect(parseQuickAdd("Fix login bug !high #work #backend tomorrow", T)).toEqual({
      title: "Fix login bug",
      priority: "high",
      tags: ["work", "backend"],
      dueDate: "2026-11-06",
    });
  });

  it("parses Arabic priority, tag and بكرة (AR)", () => {
    expect(parseQuickAdd("اجتماع الموكلاء !عالي #شغل بكرة", T)).toEqual({
      title: "اجتماع الموكلاء",
      priority: "high",
      tags: ["شغل"],
      dueDate: "2026-11-06",
    });
  });

  it("parses النهاردة as today", () => {
    expect(parseQuickAdd("!منخفض تقرير المصاريف النهاردة", T)).toEqual({
      title: "تقرير المصاريف",
      priority: "low",
      tags: [],
      dueDate: T,
    });
  });

  it("maps medium and low aliases (EN + AR)", () => {
    expect(parseQuickAdd("x !med", T).priority).toBe("medium");
    expect(parseQuickAdd("x !low", T).priority).toBe("low");
    expect(parseQuickAdd("x !متوسط", T).priority).toBe("medium");
  });

  it("keeps unknown !flags in the title", () => {
    expect(parseQuickAdd("Call !urgent Sam", T).title).toBe("Call !urgent Sam");
  });

  it("lowercases tags", () => {
    expect(parseQuickAdd("Plan #Q4 #Roadmap", T).tags).toEqual(["q4", "roadmap"]);
  });

  it("ignores empty input", () => {
    expect(parseQuickAdd("   ", T).title).toBe("");
  });

  it("EN date words set today and tomorrow", () => {
    expect(parseQuickAdd("Email Sam today", T).dueDate).toBe(T);
    expect(parseQuickAdd("Email Sam tmr", T).dueDate).toBe("2026-11-06");
  });

  it("a later date word wins", () => {
    expect(parseQuickAdd("Ship it today tomorrow", T).dueDate).toBe("2026-11-06");
  });
});
