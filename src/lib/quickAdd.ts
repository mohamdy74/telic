import { addDays } from "./dates";
import type { LocalDay, Priority } from "./types";

/** Result of parsing a quick-add line. Undefined fields fall back to store defaults. */
export interface QuickAddResult {
  title: string;
  priority: Priority | undefined;
  tags: string[];
  dueDate: LocalDay | undefined;
}

const HIGH = ["high", "عالي", "عالية", "مهم"];
const MEDIUM = ["medium", "med", "متوسط"];
const LOW = ["low", "منخفض", "بسيط"];
const EN_TODAY = ["today", "tod"];
const EN_TOMORROW = ["tomorrow", "tmr", "tmrw"];
const AR_TODAY = ["النهاردة", "النهارده", "اليوم"];
const AR_TOMORROW = ["بكرة", "بكره", "غدا", "غدًا", "غداً"];

/**
 * Pure quick-add parser. Syntax: "!high" / "!عالي" sets priority, "#tag" adds
 * a tag, and date words (today/tomorrow/النهاردة/بكرة…) set the due day.
 * Unknown "!flags" stay in the title; a later date word wins.
 */
export function parseQuickAdd(input: string, today: LocalDay): QuickAddResult {
  let priority: Priority | undefined;
  let dueDate: LocalDay | undefined;
  const tags: string[] = [];
  const words: string[] = [];
  for (const raw of input.trim().split(/\s+/)) {
    if (raw === "") continue;
    const w = raw.toLowerCase();
    if (w.startsWith("#") && w.length > 1) {
      tags.push(w.slice(1));
      continue;
    }
    if (w.startsWith("!")) {
      const flag = w.slice(1);
      if (HIGH.includes(flag)) {
        priority = "high";
        continue;
      }
      if (MEDIUM.includes(flag)) {
        priority = "medium";
        continue;
      }
      if (LOW.includes(flag)) {
        priority = "low";
        continue;
      }
    }
    if (EN_TODAY.includes(w) || AR_TODAY.includes(raw)) {
      dueDate = today;
      continue;
    }
    if (EN_TOMORROW.includes(w) || AR_TOMORROW.includes(raw)) {
      dueDate = addDays(today, 1);
      continue;
    }
    words.push(raw);
  }
  return { title: words.join(" ").trim(), priority, tags, dueDate };
}
