import { addDays, startOfWeek } from "./dates";
import type { AchievementState } from "./achievements";
import type { NewXpEntry } from "./rewards";
import { DAILY_CHALLENGE_COINS, WEEKLY_CHALLENGE_COINS } from "./rewardsConfig";
import { isScheduledOn, logsByDay } from "./streaks";
import type { LocalDay } from "./types";

/*
 * Challenges: deterministic, pure, coins-only bonuses.
 * - DAILY: 3 challenges picked from the pool by the localDay (same day ->
 *   same set). WEEKLY: 2 picked by the week-start day.
 * - Completion reads the same validated data as achievements: live ledger
 *   entries, completed work sessions, habit done-logs.
 * - A completed challenge grants a coin bonus ONCE per challenge per
 *   period: a ledger entry with sourceType "challenge", sourceId the
 *   challenge id, localDay the period anchor (today / week start), xp 0
 *   and a positive coins value. Zero XP means bonuses NEVER count toward
 *   DAILY_XP_CAP and never advance levels; the ledger identity rule makes
 *   the grant once-per-period. Undoing the underlying actions keeps the
 *   bonus (positive reinforcement) but can never trigger a second grant.
 */

export type ChallengeId =
  | "d-tasks-3"
  | "d-tasks-5"
  | "d-focus-1"
  | "d-focus-2"
  | "d-habits-all"
  | "d-xp-100"
  | "d-focus-45"
  | "w-tasks-15"
  | "w-focus-6"
  | "w-habits-12"
  | "w-xp-400"
  | "w-target-4";

export type ChallengePeriod = "daily" | "weekly";

/** Same pure-state shape as achievements (assembled by the store). */
export type ChallengeState = AchievementState;

export interface ChallengeDef {
  id: ChallengeId;
  period: ChallengePeriod;
  bonusCoins: number;
  /** current progress and the goal for the current period; goal 0 = nothing to do. */
  progress: (s: ChallengeState) => { current: number; goal: number };
}

const live = <T extends { deletedAt?: string | undefined }>(l: T[]) => l.filter((r) => !r.deletedAt);

function liveLedger(s: ChallengeState) {
  return live(s.xpLedger);
}

/** Distinct validated sources of one type within a day window (inclusive). */
function countEntries(
  s: ChallengeState,
  sourceType: "task" | "habit" | "focus",
  from: LocalDay,
  to: LocalDay,
): number {
  const ids = new Set<string>();
  for (const e of liveLedger(s)) {
    if (e.sourceType !== sourceType) continue;
    if (e.localDay < from || e.localDay > to) continue;
    ids.add(e.sourceId);
  }
  return ids.size;
}

/** XP awarded inside a day window (live entries, inclusive ends). */
function xpInWindow(s: ChallengeState, from: LocalDay, to: LocalDay): number {
  return liveLedger(s).reduce(
    (sum, e) => (e.localDay >= from && e.localDay <= to ? sum + e.xp : sum),
    0,
  );
}

function completedWorkSessions(s: ChallengeState) {
  return s.focusSessions.filter(
    (x) => !x.deletedAt && x.completed && x.mode !== "break" && x.endedAt !== undefined,
  );
}

/** Completed work-session count on one day. */
function workSessionsOn(s: ChallengeState, day: LocalDay): number {
  return completedWorkSessions(s).filter((x) => x.localDay === day).length;
}

/** Completed work-session planned minutes on one day. */
function plannedMinutesOn(s: ChallengeState, day: LocalDay): number {
  return completedWorkSessions(s)
    .filter((x) => x.localDay === day)
    .reduce((sum, x) => sum + x.plannedMinutes, 0);
}

/** Done habit check-ins (distinct habit+day) inside a day window. */
function doneHabitLogsInWindow(s: ChallengeState, from: LocalDay, to: LocalDay): Set<string> {
  const out = new Set<string>();
  for (const l of live(s.habitLogs)) {
    if (l.status !== "done") continue;
    if (l.localDay < from || l.localDay > to) continue;
    out.add(l.habitId + ":" + l.localDay);
  }
  return out;
}

/** Days in the window meeting the daily focus target (completed work minutes). */
function targetDaysMet(s: ChallengeState, from: LocalDay, to: LocalDay): number {
  if (s.dailyFocusTargetMinutes <= 0) return 0;
  let met = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (plannedMinutesOn(s, d) >= s.dailyFocusTargetMinutes) met++;
  }
  return met;
}

/** Habits due today and how many are done (done-logs, once per habit per day). */
function habitsDueToday(s: ChallengeState): { due: number; done: number } {
  let due = 0;
  let done = 0;
  for (const h of live(s.habits)) {
    if (h.archived || !isScheduledOn(h.schedule, s.today)) continue;
    due++;
    const by = logsByDay(live(s.habitLogs).filter((l) => l.habitId === h.id));
    if (by.get(s.today)?.status === "done") done++;
  }
  return { due, done };
}

function weekWindow(s: ChallengeState): { from: LocalDay; to: LocalDay } {
  const from = startOfWeek(s.today, s.weekStartsOn);
  return { from, to: addDays(from, 6) };
}

export const DAILY_CHALLENGES: ChallengeDef[] = [
  {
    id: "d-tasks-3",
    period: "daily",
    bonusCoins: DAILY_CHALLENGE_COINS,
    progress: (s) => ({ current: countEntries(s, "task", s.today, s.today), goal: 3 }),
  },
  {
    id: "d-tasks-5",
    period: "daily",
    bonusCoins: DAILY_CHALLENGE_COINS,
    progress: (s) => ({ current: countEntries(s, "task", s.today, s.today), goal: 5 }),
  },
  {
    id: "d-focus-1",
    period: "daily",
    bonusCoins: DAILY_CHALLENGE_COINS,
    progress: (s) => ({ current: workSessionsOn(s, s.today), goal: 1 }),
  },
  {
    id: "d-focus-2",
    period: "daily",
    bonusCoins: DAILY_CHALLENGE_COINS,
    progress: (s) => ({ current: workSessionsOn(s, s.today), goal: 2 }),
  },
  {
    id: "d-habits-all",
    period: "daily",
    bonusCoins: DAILY_CHALLENGE_COINS,
    progress: (s) => {
      const hd = habitsDueToday(s);
      return { current: hd.done, goal: hd.due };
    },
  },
  {
    id: "d-xp-100",
    period: "daily",
    bonusCoins: DAILY_CHALLENGE_COINS,
    progress: (s) => ({ current: xpInWindow(s, s.today, s.today), goal: 100 }),
  },
  {
    id: "d-focus-45",
    period: "daily",
    bonusCoins: DAILY_CHALLENGE_COINS,
    progress: (s) => ({ current: plannedMinutesOn(s, s.today), goal: 45 }),
  },
];

export const WEEKLY_CHALLENGES: ChallengeDef[] = [
  {
    id: "w-tasks-15",
    period: "weekly",
    bonusCoins: WEEKLY_CHALLENGE_COINS,
    progress: (s) => {
      const w = weekWindow(s);
      return { current: countEntries(s, "task", w.from, w.to), goal: 15 };
    },
  },
  {
    id: "w-focus-6",
    period: "weekly",
    bonusCoins: WEEKLY_CHALLENGE_COINS,
    progress: (s) => {
      const w = weekWindow(s);
      return {
        current: completedWorkSessions(s).filter(
          (x) => x.localDay >= w.from && x.localDay <= w.to,
        ).length,
        goal: 6,
      };
    },
  },
  {
    id: "w-habits-12",
    period: "weekly",
    bonusCoins: WEEKLY_CHALLENGE_COINS,
    progress: (s) => {
      const w = weekWindow(s);
      return { current: doneHabitLogsInWindow(s, w.from, w.to).size, goal: 12 };
    },
  },
  {
    id: "w-xp-400",
    period: "weekly",
    bonusCoins: WEEKLY_CHALLENGE_COINS,
    progress: (s) => {
      const w = weekWindow(s);
      return { current: xpInWindow(s, w.from, w.to), goal: 400 };
    },
  },
  {
    id: "w-target-4",
    period: "weekly",
    bonusCoins: WEEKLY_CHALLENGE_COINS,
    progress: (s) => {
      const w = weekWindow(s);
      return { current: targetDaysMet(s, w.from, w.to), goal: 4 };
    },
  },
];

/** FNV-1a hash: stable across runs and engines (no Math.random anywhere). */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Picks count defs deterministically: rank by hash(seed:id), restore pool order. */
function selectCount(pool: ChallengeDef[], seed: string, count: number): ChallengeDef[] {
  const ranked = pool
    .map((def, i) => ({ def, i, h: hashSeed(seed + ":" + def.id) }))
    .sort((a, b) => (a.h === b.h ? (a.def.id < b.def.id ? -1 : 1) : a.h - b.h));
  return ranked
    .slice(0, count)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.def);
}

/** The 3 daily challenges for a localDay; deterministic (same day -> same set). */
export function dailyChallenges(day: LocalDay): ChallengeDef[] {
  return selectCount(DAILY_CHALLENGES, "daily:" + day, 3);
}

/** The 2 weekly challenges for a week-start day; deterministic. */
export function weeklyChallenges(weekStart: LocalDay): ChallengeDef[] {
  return selectCount(WEEKLY_CHALLENGES, "weekly:" + weekStart, 2);
}

/** Ledger entries to add: one coins-only bonus per completed, unclaimed challenge. */
export function computeChallengeGrants(s: ChallengeState): NewXpEntry[] {
  const weekStart = startOfWeek(s.today, s.weekStartsOn);
  const defs: Array<{ def: ChallengeDef; anchor: LocalDay }> = [
    ...dailyChallenges(s.today).map((def) => ({ def, anchor: s.today })),
    ...weeklyChallenges(weekStart).map((def) => ({ def, anchor: weekStart })),
  ];
  const claimed = new Set(
    liveLedger(s)
      .filter((e) => e.sourceType === "challenge")
      .map((e) => e.sourceId + ":" + e.localDay),
  );
  const grants: NewXpEntry[] = [];
  for (const { def, anchor } of defs) {
    if (claimed.has(def.id + ":" + anchor)) continue;
    const p = def.progress(s);
    if (p.goal > 0 && p.current >= p.goal) {
      grants.push({
        sourceType: "challenge",
        sourceId: def.id,
        localDay: anchor,
        xp: 0,
        coins: def.bonusCoins,
      });
    }
  }
  return grants;
}
