import { addDays, addMonths, weekdayOf } from "./dates";
import type { LocalDay, RecurrenceRule } from "./types";

/** Next due day strictly after `from`. Instances are generated one at a time on completion. */
export function nextOccurrence(rule: RecurrenceRule, from: LocalDay): LocalDay {
  const n = Math.max(1, Math.floor(rule.interval || 1));
  if (rule.freq === "daily") return addDays(from, n);
  if (rule.freq === "monthly") return addMonths(from, n);
  const days = [...new Set(rule.byWeekday ?? [])].sort();
  if (days.length === 0) return addDays(from, 7 * n);
  const wd = weekdayOf(from);
  const later = days.find((d) => d > wd);
  if (later !== undefined) return addDays(from, later - wd);
  // wrap to the first selected weekday of the next active week
  return addDays(from, 7 - wd + days[0] + 7 * (n - 1));
}
