/*
 * Tunable reward-economy constants. Change values here, never in the engine.
 *
 * Coin sources and sinks:
 * - sources: coins are earned passively at 1 coin per COINS_PER_XP XP actually
 *   awarded (task completions, habit done-logs, completed work focus sessions).
 *   They are derived from the XP ledger, never stored as a running total.
 * - sinks: shop spending is recorded as ledger entries with sourceType
 *   "shop", xp 0 and a negative coins value. XP is never spent; only coins are.
 * - future: "challenge" / "achievement" entries may grant coins directly
 *   (positive coins value); totalsFromLedger counts them too.
 */

import type { Priority } from "./types";

/** XP awarded per completed task, by priority. */
export const TASK_XP: Record<Priority, number> = { low: 5, medium: 10, high: 20 };

/** XP for one habit done-log. */
export const HABIT_XP = 10;

/** XP per full planned minute of a completed work focus session. */
export const XP_PER_FOCUS_MINUTE = 1;

/** Max XP awarded per localDay, across all sources. */
export const DAILY_XP_CAP = 300;

/** 1 coin per COINS_PER_XP XP actually awarded (floored on the ledger total). */
export const COINS_PER_XP = 2;

/** A task completed less than this many ms after its creation earns 0 XP. */
export const TASK_MIN_AGE_MS = 120_000;

/*
 * Level curve — ONE convention (read before touching anything):
 *   xpForLevel(n) = round(100 * n^1.5) is the XP cost to advance FROM level n
 *   TO level n + 1. It is a per-step cost, NOT a cumulative total.
 *   Total XP required to reach level L (level 1 starts at 0 XP):
 *     totalXpForLevel(L) = sum of xpForLevel(n) for n = 1 .. L - 1
 */
export function xpForLevel(n: number): number {
  return Math.round(100 * Math.pow(n, 1.5));
}

/** Cumulative XP required to reach the given level from level 1. */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let n = 1; n < level; n++) total += xpForLevel(n);
  return total;
}

export interface LevelInfo {
  level: number;
  /** XP earned inside the current level. */
  xpIntoLevel: number;
  /** Per-step cost of the current level (see the convention above). */
  xpForNextLevel: number;
}

/** Where a total XP amount lands on the curve. */
export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  let remaining = Math.max(0, xp);
  let step = xpForLevel(level);
  while (remaining >= step) {
    remaining -= step;
    level += 1;
    step = xpForLevel(level);
  }
  return { level, xpIntoLevel: remaining, xpForNextLevel: step };
}
