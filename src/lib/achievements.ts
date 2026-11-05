import type {
  AchievementUnlock,
  FocusSession,
  Habit,
  HabitLog,
  LocalDay,
  Task,
  XpLedgerEntry,
} from "./types";

/*
 * Achievements: data-defined, pure, and impossible to farm with trivial
 * exploits. Every predicate reads ALREADY-VALIDATED data:
 * - a "validated task completion" is a live xpLedger entry with sourceType
 *   "task" — the rewards engine only writes those for tasks that passed the
 *   minimum-age, duplicate and cap checks (an instantly completed task has
 *   no entry and counts for nothing);
 * - a "validated habit done-log" is a live "habit" entry (once per habit
 *   per localDay);
 * - a "validated focus session" is a completed work session (completed, not
 *   a break, not soft-deleted) — the same sessions the engine pays XP for;
 * - levels read totalsFromLedger, backups read meta.lastExportedAt,
 *   purchases read live "shop" entries (dormant until the shop ships).
 * Each definition below names the data it depends on.
 * Unlocks are stored ONCE in the achievements collection (id + unlockedAt
 * + localDay); evaluateAchievements returns only ids not yet unlocked.
 * Like the rest of the rewards engine this is a self-cheating guardrail,
 * not security: local data can always be edited via import.
 */

export type AchievementId =
  | "firstTask"
  | "tasksTen"
  | "tasksFifty"
  | "tasksTwoHundred"
  | "firstHabit"
  | "streakSeven"
  | "streakThirty"
  | "streakHundred"
  | "firstFocus"
  | "focusTenHours"
  | "focusFiftyHours"
  | "perfectDay"
  | "earlyBirdFive"
  | "comeback"
  | "levelFive"
  | "levelTen"
  | "firstPurchase"
  | "firstBackup"
  | "consistentMonth"
  | "zenThree"
  | "focusTargetWeek";

/** Everything the pure predicates need; assembled by the store (progressState). */
export interface AchievementState {
  today: LocalDay;
  timeZone: string;
  weekStartsOn: number;
  dailyFocusTargetMinutes: number;
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  focusSessions: FocusSession[];
  xpLedger: XpLedgerEntry[];
  lastExportedAt: string | undefined;
}

export interface Achievement {
  id: AchievementId;
  /** lucide icon name, mapped in src/components/app/achievementIcons.ts. */
  icon: string;
  predicate: (s: AchievementState) => boolean;
  /** current/target where a number is meaningful; null otherwise. */
  progress: (s: AchievementState) => { current: number; target: number } | null;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "firstTask", icon: "Sprout", predicate: () => false, progress: () => null },
  { id: "tasksTen", icon: "ListTodo", predicate: () => false, progress: () => null },
  { id: "tasksFifty", icon: "Layers", predicate: () => false, progress: () => null },
  { id: "tasksTwoHundred", icon: "BookOpen", predicate: () => false, progress: () => null },
  { id: "firstHabit", icon: "Leaf", predicate: () => false, progress: () => null },
  { id: "streakSeven", icon: "Flame", predicate: () => false, progress: () => null },
  { id: "streakThirty", icon: "Mountain", predicate: () => false, progress: () => null },
  { id: "streakHundred", icon: "Gem", predicate: () => false, progress: () => null },
  { id: "firstFocus", icon: "Timer", predicate: () => false, progress: () => null },
  { id: "focusTenHours", icon: "Hourglass", predicate: () => false, progress: () => null },
  { id: "focusFiftyHours", icon: "Clock", predicate: () => false, progress: () => null },
  { id: "perfectDay", icon: "Sun", predicate: () => false, progress: () => null },
  { id: "earlyBirdFive", icon: "Sunrise", predicate: () => false, progress: () => null },
  { id: "comeback", icon: "Undo2", predicate: () => false, progress: () => null },
  { id: "levelFive", icon: "Award", predicate: () => false, progress: () => null },
  { id: "levelTen", icon: "Trophy", predicate: () => false, progress: () => null },
  { id: "firstPurchase", icon: "ShoppingBag", predicate: () => false, progress: () => null },
  { id: "firstBackup", icon: "Download", predicate: () => false, progress: () => null },
  { id: "consistentMonth", icon: "TrendingUp", predicate: () => false, progress: () => null },
  { id: "zenThree", icon: "BellOff", predicate: () => false, progress: () => null },
  { id: "focusTargetWeek", icon: "Target", predicate: () => false, progress: () => null },
];

/** Ids whose predicate now holds and which have no live unlock record yet. */
export function evaluateAchievements(
  _s: AchievementState,
  _unlocks: AchievementUnlock[],
): AchievementId[] {
  return [];
}

/** Most recent live unlocks, newest first. */
export function latestUnlocks(
  unlocks: AchievementUnlock[],
  limit: number,
): AchievementUnlock[] {
  return unlocks.filter((u) => !u.deletedAt).slice(0, limit);
}
