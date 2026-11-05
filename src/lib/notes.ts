import type { Note } from "./types";

/** Sorts notes for the list: pinned first, then most recently updated (id tiebreak). */
export function sortNotes(list: Note[]): Note[] {
  return [...list].reverse(); // RED stub
}

/** Instant local search over title + body. */
export function filterNotes(list: Note[], q: string): Note[] {
  return []; // RED stub
}

/** Escaped Markdown subset -> HTML, one dir="auto" block element per paragraph. */
export function mdToHtml(md: string): string {
  void md; // RED stub
  return "";
}

/** One Markdown file per note: heading + body. */
export function noteToMarkdown(n: Note): string {
  void n; // RED stub
  return "";
}
