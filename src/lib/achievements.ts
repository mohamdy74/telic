import { daysBetween } from "./dates";
import { totalsFromLedger } from "./rewards";
import { consistency30, habitStreaks, isScheduledOn, logsByDay } from "./streaks";
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
 *   purchases read live "shop" entries (the /rewards shop).
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

const live = <T extends { deletedAt?: string | undefined }>(l: T[]) =>
  l.filter((r) => !r.deletedAt);

function liveLedgerEntries(s: AchievementState): XpLedgerEntry[] {
  return live(s.xpLedger);
}

/** Validated task completions: live ledger entries with sourceType "task". */
function validatedTaskEntries(s: AchievementState): XpLedgerEntry[] {
  return liveLedgerEntries(s).filter((e) => e.sourceType === "task");
}

/** Distinct validated tasks (a task redone on another day is still one task). */
function validatedTaskCount(s: AchievementState): number {
  return new Set(validatedTaskEntries(s).map((e) => e.sourceId)).size;
}

/** Validated habit done-logs: live ledger entries with sourceType "habit". */
function validatedHabitEntries(s: AchievementState): XpLedgerEntry[] {
  return liveLedgerEntries(s).filter((e) => e.sourceType === "habit");
}

/** Validated focus sessions: completed, not a break, not soft-deleted. */
function completedWorkSessions(s: AchievementState): FocusSession[] {
  return s.focusSessions.filter(
    (x) => !x.deletedAt && x.completed && x.mode !== "break" && x.endedAt !== undefined,
  );
}

/** Wall-clock hour (0..23) of an ISO timestamp in the given time zone. */
function wallHour(iso: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const h = parts.find((p) => p.type === "hour")?.value;
  return h === undefined ? 0 : Number(h);
}

/** Distinct activity days (localDays carrying a live entry), sorted. */
function activityDays(s: AchievementState): string[] {
  return [...new Set(liveLedgerEntries(s).map((e) => e.localDay))].sort();
}

/** True when any gap between two activity days leaves 7+ inactive days. */
function hasComebackGap(s: AchievementState): boolean {
  const days = activityDays(s);
  for (let i = 1; i < days.length; i++) {
    if (daysBetween(days[i - 1]!, days[i]!) >= 8) return true;
  }
  return false;
}

/** Best streak over all live, non-archived habits (habitStreaks is the source of truth). */
function bestStreak(s: AchievementState): number {
  let best = 0;
  for (const h of live(s.habits)) {
    if (h.archived) continue;
    best = Math.max(best, habitStreaks(h, live(s.habitLogs), s.today, s.weekStartsOn).best);
  }
  return best;
}

/** Total completed work-session minutes. */
function focusMinutes(s: AchievementState): number {
  return completedWorkSessions(s).reduce((sum, x) => sum + x.plannedMinutes, 0);
}

/**
 * Perfect-day progress over TODAY: due tasks done (validated completions
 * only — an instant completion has no ledger entry) plus due habits done.
 */
function perfectDayProgress(s: AchievementState): { current: number; target: number } {
  const validatedToday = new Set(
    validatedTaskEntries(s)
      .filter((e) => e.localDay === s.today)
      .map((e) => e.sourceId),
  );
  const dueTasks = live(s.tasks).filter((x) => x.dueDate === s.today);
  const doneTasks = dueTasks.filter((x) => x.status === "done" && validatedToday.has(x.id)).length;
  let dueHabits = 0;
  let doneHabits = 0;
  for (const h of live(s.habits)) {
    if (h.archived || !isScheduledOn(h.schedule, s.today)) continue;
    dueHabits++;
    const by = logsByDay(live(s.habitLogs).filter((l) => l.habitId === h.id));
    if (by.get(s.today)?.status === "done") doneHabits++;
  }
  return { current: doneTasks + doneHabits, target: dueTasks.length + dueHabits };
}

/** Validated tasks completed before 09:00 wall clock. */
function earlyBirdCount(s: AchievementState): number {
  const tasks = new Map(s.tasks.map((x) => [x.id, x] as const));
  return validatedTaskEntries(s).filter((e) => {
    const task = tasks.get(e.sourceId);
    return task?.completedAt !== undefined && wallHour(task.completedAt, s.timeZone) < 9;
  }).length;
}

/** Best 30-day consistency over live, non-archived habits (null = nothing scheduled). */
function bestConsistency(s: AchievementState): number | null {
  let best: number | null = null;
  for (const h of live(s.habits)) {
    if (h.archived) continue;
    const c = consistency30(
      h,
      live(s.habitLogs).filter((l) => l.habitId === h.id),
      s.today,
    );
    if (c !== null && (best === null || c > best)) best = c;
  }
  return best;
}

/** Longest run of distraction-free validated sessions, most recent first. */
function distractionFreeRun(s: AchievementState): number {
  const sessions = [...completedWorkSessions(s)].sort((a, b) =>
    a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0,
  );
  let run = 0;
  for (const x of sessions) {
    if (x.distractions.length > 0) break;
    run++;
  }
  return run;
}

/** Longest run of consecutive days meeting the daily focus target. */
function bestTargetRun(s: AchievementState): number {
  if (s.dailyFocusTargetMinutes <= 0) return 0;
  const byDay = new Map<string, number>();
  for (const x of completedWorkSessions(s)) {
    byDay.set(x.localDay, (byDay.get(x.localDay) ?? 0) + x.plannedMinutes);
  }
  const days = [...byDay.entries()]
    .filter(([, min]) => min >= s.dailyFocusTargetMinutes)
    .map(([d]) => d)
    .sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev !== null && daysBetween(prev, d) === 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }
  return best;
}

/** Live shop purchases (coins spent) — written by the /rewards shop. */
function purchaseCount(s: AchievementState): number {
  return liveLedgerEntries(s).filter((e) => e.sourceType === "shop" && e.coins < 0).length;
}

export const ACHIEVEMENTS: Achievement[] = [
  // Validated data: live "task" ledger entries.
  {
    id: "firstTask",
    icon: "Sprout",
    predicate: (s) => validatedTaskCount(s) >= 1,
    progress: (s) => ({ current: Math.min(validatedTaskCount(s), 1), target: 1 }),
  },
  // Validated data: distinct live "task" ledger entries.
  {
    id: "tasksTen",
    icon: "ListTodo",
    predicate: (s) => validatedTaskCount(s) >= 10,
    progress: (s) => ({ current: validatedTaskCount(s), target: 10 }),
  },
  {
    id: "tasksFifty",
    icon: "Layers",
    predicate: (s) => validatedTaskCount(s) >= 50,
    progress: (s) => ({ current: validatedTaskCount(s), target: 50 }),
  },
  {
    id: "tasksTwoHundred",
    icon: "BookOpen",
    predicate: (s) => validatedTaskCount(s) >= 200,
    progress: (s) => ({ current: validatedTaskCount(s), target: 200 }),
  },
  // Validated data: live "habit" ledger entries.
  {
    id: "firstHabit",
    icon: "Leaf",
    predicate: (s) => validatedHabitEntries(s).length >= 1,
    progress: (s) => ({ current: Math.min(validatedHabitEntries(s).length, 1), target: 1 }),
  },
  // Validated data: habit streaks over done logs (habitStreaks, streaks.ts).
  {
    id: "streakSeven",
    icon: "Flame",
    predicate: (s) => bestStreak(s) >= 7,
    progress: (s) => ({ current: bestStreak(s), target: 7 }),
  },
  {
    id: "streakThirty",
    icon: "Mountain",
    predicate: (s) => bestStreak(s) >= 30,
    progress: (s) => ({ current: bestStreak(s), target: 30 }),
  },
  {
    id: "streakHundred",
    icon: "Gem",
    predicate: (s) => bestStreak(s) >= 100,
    progress: (s) => ({ current: bestStreak(s), target: 100 }),
  },
  // Validated data: completed work sessions (the same ones the engine pays for).
  {
    id: "firstFocus",
    icon: "Timer",
    predicate: (s) => completedWorkSessions(s).length >= 1,
    progress: (s) => ({ current: Math.min(completedWorkSessions(s).length, 1), target: 1 }),
  },
  {
    id: "focusTenHours",
    icon: "Hourglass",
    predicate: (s) => focusMinutes(s) >= 600,
    progress: (s) => ({ current: focusMinutes(s), target: 600 }),
  },
  {
    id: "focusFiftyHours",
    icon: "Clock",
    predicate: (s) => focusMinutes(s) >= 3000,
    progress: (s) => ({ current: focusMinutes(s), target: 3000 }),
  },
  // Validated data: today due tasks (validated completions) + due habits (done logs).
  {
    id: "perfectDay",
    icon: "Sun",
    predicate: (s) => {
      const p = perfectDayProgress(s);
      return p.target > 0 && p.current === p.target;
    },
    progress: perfectDayProgress,
  },
  // Validated data: live "task" entries whose task completed before 09:00.
  {
    id: "earlyBirdFive",
    icon: "Sunrise",
    predicate: (s) => earlyBirdCount(s) >= 5,
    progress: (s) => ({ current: earlyBirdCount(s), target: 5 }),
  },
  // Validated data: activity days derived from live ledger entries.
  {
    id: "comeback",
    icon: "Undo2",
    predicate: hasComebackGap,
    progress: () => null,
  },
  // Validated data: level from totalsFromLedger over the live ledger.
  {
    id: "levelFive",
    icon: "Award",
    predicate: (s) => totalsFromLedger(s.xpLedger).level >= 5,
    progress: (s) => ({ current: totalsFromLedger(s.xpLedger).level, target: 5 }),
  },
  {
    id: "levelTen",
    icon: "Trophy",
    predicate: (s) => totalsFromLedger(s.xpLedger).level >= 10,
    progress: (s) => ({ current: totalsFromLedger(s.xpLedger).level, target: 10 }),
  },
  // Validated data: live "shop" entries with negative coins (the /rewards shop).
  {
    id: "firstPurchase",
    icon: "ShoppingBag",
    predicate: (s) => purchaseCount(s) >= 1,
    progress: (s) => ({ current: Math.min(purchaseCount(s), 1), target: 1 }),
  },
  // Validated data: meta.lastExportedAt, stamped on every real export.
  {
    id: "firstBackup",
    icon: "Download",
    predicate: (s) => s.lastExportedAt !== undefined,
    progress: () => null,
  },
  // Validated data: consistency30 over done logs (streaks.ts).
  {
    id: "consistentMonth",
    icon: "TrendingUp",
    predicate: (s) => {
      const c = bestConsistency(s);
      return c !== null && c >= 0.8;
    },
    progress: (s) => ({
      current: bestConsistency(s) === null ? 0 : Math.round(bestConsistency(s)! * 100),
      target: 80,
    }),
  },
  // Validated data: distraction-free completed work sessions, most recent first.
  {
    id: "zenThree",
    icon: "BellOff",
    predicate: (s) => distractionFreeRun(s) >= 3,
    progress: (s) => ({ current: distractionFreeRun(s), target: 3 }),
  },
  // Validated data: completed work minutes per day vs the focus target.
  {
    id: "focusTargetWeek",
    icon: "Target",
    predicate: (s) => bestTargetRun(s) >= 7,
    progress: (s) => ({ current: bestTargetRun(s), target: 7 }),
  },
];

/** Ids whose predicate now holds and which have no live unlock record yet. */
export function evaluateAchievements(
  s: AchievementState,
  unlocks: AchievementUnlock[],
): AchievementId[] {
  const seen = new Set(live(unlocks).map((u) => u.achievementId));
  const fresh: AchievementId[] = [];
  for (const def of ACHIEVEMENTS) {
    if (seen.has(def.id)) continue;
    if (def.predicate(s)) fresh.push(def.id);
  }
  return fresh;
}

/** Most recent live unlocks, newest first (ties broken by achievementId). */
export function latestUnlocks(unlocks: AchievementUnlock[], limit: number): AchievementUnlock[] {
  return live(unlocks)
    .sort((a, b) =>
      a.unlockedAt === b.unlockedAt
        ? a.achievementId < b.achievementId
          ? -1
          : 1
        : a.unlockedAt < b.unlockedAt
          ? 1
          : -1,
    )
    .slice(0, limit);
}
