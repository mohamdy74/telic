import { describe, expect, it } from "vitest";
import { filterNotes, mdToHtml, noteToMarkdown, sortNotes } from "./notes";
import type { Note } from "./types";

const STAMP = "2026-01-01T00:00:00.000Z";
let seq = 0;
const note = (over: Partial<Note> = {}): Note => {
  seq++;
  return {
    id: "n" + seq,
    title: "Note " + seq,
    body: "body " + seq,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...over,
  };
};

describe("sortNotes", () => {
  it("pins first, then most recently updated", () => {
    const list = [
      note({ id: "plainRecent", updatedAt: "2026-01-03T00:00:00.000Z" }),
      note({ id: "pinnedOld", pinned: true, updatedAt: "2026-01-01T00:00:00.000Z" }),
      note({ id: "plainOld", updatedAt: "2026-01-02T00:00:00.000Z" }),
    ];
    expect(sortNotes(list).map((n) => n.id)).toEqual(["pinnedOld", "plainRecent", "plainOld"]);
  });

  it("breaks equal updatedAt ties by id so the order is stable", () => {
    const list = [
      note({ id: "b", updatedAt: "2026-01-02T00:00:00.000Z" }),
      note({ id: "a", updatedAt: "2026-01-02T00:00:00.000Z" }),
    ];
    expect(sortNotes(list).map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("never mutates the input list", () => {
    const list = [note({ id: "z" }), note({ id: "a" })];
    sortNotes(list);
    expect(list.map((n) => n.id)).toEqual(["z", "a"]);
  });
});

describe("filterNotes", () => {
  const list = [
    note({ id: "t1", title: "Grocery plan", body: "milk and bread" }),
    note({ id: "t2", title: "خطة الأسبوع", body: "خطة كاملة" }),
    note({ id: "t3", title: "Book notes", body: "خطة قراءة الكتاب" }),
  ];

  it("an empty query returns every note", () => {
    expect(filterNotes(list, "  ").map((n) => n.id)).toEqual(["t1", "t2", "t3"]);
  });

  it("matches the title or the body, case-insensitive", () => {
    expect(filterNotes(list, "grocery").map((n) => n.id)).toEqual(["t1"]);
    expect(filterNotes(list, "MILK").map((n) => n.id)).toEqual(["t1"]);
  });

  it("matches Arabic text", () => {
    expect(filterNotes(list, "خطة").map((n) => n.id)).toEqual(["t2", "t3"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterNotes(list, "zzz")).toEqual([]);
  });
});

describe("mdToHtml", () => {
  it("escapes raw HTML before anything else", () => {
    const html = mdToHtml("<script>alert(1)</script>");
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders headings with per-block direction", () => {
    expect(mdToHtml("# Title")).toBe('<h1 dir="auto">Title</h1>');
    expect(mdToHtml("### Deep")).toBe('<h3 dir="auto">Deep</h3>');
  });

  it("renders unordered and ordered lists", () => {
    expect(mdToHtml("- a\n- b")).toBe('<ul dir="auto"><li>a</li><li>b</li></ul>');
    expect(mdToHtml("1. a\n2. b")).toBe('<ol dir="auto"><li>a</li><li>b</li></ol>');
  });

  it("renders bold, italic, code and safe http links inline", () => {
    expect(mdToHtml("**b**")).toContain("<strong>b</strong>");
    expect(mdToHtml("*i*")).toContain("<em>i</em>");
    expect(mdToHtml("`c`")).toContain("<code>c</code>");
    const link = mdToHtml("[docs](https://example.com)");
    expect(link).toContain('href="https://example.com"');
    expect(link).toContain('rel="noopener noreferrer"');
  });

  it("never renders a javascript: link as an anchor", () => {
    expect(mdToHtml("[bad](javascript:alert(1))")).not.toContain("<a ");
  });

  it("renders blockquotes, rules and multi-line paragraphs", () => {
    expect(mdToHtml("> quoted")).toBe('<blockquote dir="auto">quoted</blockquote>');
    expect(mdToHtml("---")).toBe('<hr dir="auto">');
    expect(mdToHtml("line one\nline two")).toBe('<p dir="auto">line one<br>line two</p>');
  });

  it("gives every block dir=auto so mixed-direction notes read correctly", () => {
    const html = mdToHtml("# عربي\n\nhello");
    expect(html).toContain('<h1 dir="auto">عربي</h1>');
    expect(html).toContain('<p dir="auto">hello</p>');
  });

  it("empty input renders nothing", () => {
    expect(mdToHtml("")).toBe("");
  });
});

describe("noteToMarkdown", () => {
  it("writes the title as a heading followed by the body", () => {
    expect(noteToMarkdown(note({ title: "Plan", body: "step 1" }))).toBe("# Plan\n\nstep 1\n");
  });

  it("an empty body stays empty", () => {
    expect(noteToMarkdown(note({ title: "Plan", body: "" }))).toBe("# Plan\n");
  });
});

describe("notes perf guard", () => {
  it("filters 1000 notes instantly", () => {
    const big = Array.from({ length: 1000 }, (_, i) =>
      note({ id: "p" + i, title: "Plan " + i, body: "step " + i }),
    );
    const t0 = Date.now();
    const out = filterNotes(big, "step");
    expect(out).toHaveLength(1000);
    expect(Date.now() - t0).toBeLessThan(250);
  });
});
