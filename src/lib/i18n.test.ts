import { describe, expect, it } from "vitest";
import { dictionaries, plural, dirOf } from "./i18n";

describe("i18n", () => {
  it("uses Arabic dual form for 2", () => {
    expect(plural("ar", dictionaries.ar.daysStreak, 2)).toBe("يومان متتاليان");
  });
  it("uses Arabic 'few' form for 3", () => {
    expect(plural("ar", dictionaries.ar.daysStreak, 3)).toBe("٣ أيام متتالية");
  });
  it("uses Arabic 'many' form for 11", () => {
    expect(plural("ar", dictionaries.ar.daysStreak, 11)).toBe("١١ يومًا متتاليًا");
  });
  it("Arabic is RTL, English LTR", () => {
    expect(dirOf("ar")).toBe("rtl");
    expect(dirOf("en")).toBe("ltr");
  });
});
