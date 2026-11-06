import { describe, expect, it } from "vitest";
import { NOTE_TEMPLATES, templateFor, type TemplateId } from "./templates";

describe("NOTE_TEMPLATES", () => {
  it("ships exactly the four Arabic-first templates", () => {
    expect(NOTE_TEMPLATES.map((x) => x.id)).toEqual([
      "study",
      "freelance",
      "content",
      "ramadan",
    ] as TemplateId[]);
  });

  it("carries hand-written, distinct Arabic and English copy with checkboxes", () => {
    expect(NOTE_TEMPLATES.length).toBe(4);
    for (const tpl of NOTE_TEMPLATES) {
      expect(tpl.title.ar.trim()).not.toBe("");
      expect(tpl.title.en.trim()).not.toBe("");
      expect(tpl.title.ar).not.toBe(tpl.title.en);
      expect(tpl.body.ar).toContain("- [ ]");
      expect(tpl.body.en).toContain("- [ ]");
      expect(tpl.body.ar).not.toBe(tpl.body.en);
    }
  });
});

describe("templateFor", () => {
  it("returns the hand-written copy for the asked locale", () => {
    expect(templateFor("study", "ar")?.title).toBe("مذاكرة");
    expect(templateFor("study", "en")?.title).toBe("Study session");
    expect(templateFor("freelance", "ar")?.title).toBe("عمل حر");
    expect(templateFor("content", "en")?.title).toBe("Content plan");
    expect(templateFor("ramadan", "ar")?.body).toContain("رمضان");
  });

  it("returns null for unknown ids", () => {
    expect(templateFor("nope", "ar")).toBeNull();
  });
});
