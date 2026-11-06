import type { Note } from "./types";

/** Sorts notes for the list: pinned first, then most recently updated (id tiebreak). */
export function sortNotes(list: Note[]): Note[] {
  return [...list].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });
}

/** Instant local search over title + body. */
export function filterNotes(list: Note[], q: string): Note[] {
  const nq = q.trim().toLowerCase();
  if (!nq) return [...list];
  return list.filter(
    (n) => n.title.toLowerCase().includes(nq) || n.body.toLowerCase().includes(nq),
  );
}

/** HTML entity escaping — always applied before any inline Markdown transform. */
const esc = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Inline Markdown (after escaping): links, bold, italic, code.
 * Only http(s) links become anchors — anything else stays plain text.
 */
const inline = (s: string): string =>
  esc(s)
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

const isRule = (s: string) => /^\s*(---+|\*\*\*+)\s*$/.test(s);
const isHeading = (s: string) => /^#{1,3}\s+\S/.test(s);
const isQuote = (s: string) => /^\s*>\s?\S/.test(s);
const isUlItem = (s: string) => /^\s*[-*]\s+\S/.test(s);
const isOlItem = (s: string) => /^\s*\d+\.\s+\S/.test(s);
const isSpecial = (s: string) =>
  isRule(s) || isHeading(s) || isQuote(s) || isUlItem(s) || isOlItem(s);

/**
 * Escaped Markdown subset -> HTML, one block element per paragraph.
 * Every block carries dir="auto", so mixed Arabic/English notes read correctly.
 */
export function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === "") {
      i++;
      continue;
    }
    if (isRule(line)) {
      out.push('<hr dir="auto">');
      i++;
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const tag = "h" + h[1]!.length;
      out.push("<" + tag + ' dir="auto">' + inline(h[2]!.trim()) + "</" + tag + ">");
      i++;
      continue;
    }
    if (isQuote(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i]!)) {
        buf.push(lines[i]!.replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push('<blockquote dir="auto">' + inline(buf.join(" ").trim()) + "</blockquote>");
      continue;
    }
    if (isUlItem(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]!)) {
        items.push("<li>" + inline(lines[i]!.replace(/^\s*[-*]\s+/, "")) + "</li>");
        i++;
      }
      out.push('<ul dir="auto">' + items.join("") + "</ul>");
      continue;
    }
    if (isOlItem(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i]!)) {
        items.push("<li>" + inline(lines[i]!.replace(/^\s*\d+\.\s+/, "")) + "</li>");
        i++;
      }
      out.push('<ol dir="auto">' + items.join("") + "</ol>");
      continue;
    }
    // Paragraph: lines joined with <br>, ends at a blank or block-level line.
    const buf: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== "" && !isSpecial(lines[i]!)) {
      buf.push(inline(lines[i]!));
      i++;
    }
    out.push('<p dir="auto">' + buf.join("<br>") + "</p>");
  }
  return out.join("\n");
}

/** One Markdown file per note: heading + body. */
export function noteToMarkdown(n: Note): string {
  const body = n.body.replace(/\s+$/, "");
  return "# " + n.title + (body ? "\n\n" + body : "") + "\n";
}
