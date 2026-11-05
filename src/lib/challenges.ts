import type { AchievementState } from "./achievements";
import type { NewXpEntry } from "./rewards";
import { DAILY_CHALLENGE_COINS, WEEKLY_CHALLENGE_COINS } from "./rewardsConfig";
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

export const DAILY_CHALLENGES: ChallengeDef[] = [
  { id: "d-tasks-3", period: "daily", bonusCoins: DAILY_CHALLENGE_COINS, progress: () => ({ current: 0, goal: 0 }) },
  { id: "d-tasks-5", period: "daily", bonusCoins: DAILY_CHALLENGE_COINS, progress: () => ({ current: 0, goal: 0 }) },
  { id: "d-focus-1", period: "daily", bonusCoins: DAILY_CHALLENGE_COINS, progress: () => ({ current: 0, goal: 0 }) },
  { id: "d-focus-2", period: "daily", bonusCoins: DAILY_CHALLENGE_COINS, progress: () => ({ current: 0, goal: 0 }) },
  { id: "d-habits-all", period: "daily", bonusCoins: DAILY_CHALLENGE_COINS, progress: () => ({ current: 0, goal: 0 }) },
  { id: "d-xp-100", period: "daily", bonusCoins: DAILY_CHALLENGE_COINS, progress: () => ({ current: 0, goal: 0 }) },
  { id: "d-focus-45", period: "daily", bonusCoins: DAILY_CHALLENGE_COINS, progress: () => ({ current: 0, goal: 0 }) },
];

export const WEEKLY_CHALLENGES: ChallengeDef[] = [
  { id: "w-tasks-15", period: "weekly", bonusCoins: WEEKLY_CHALLENGE_COINS, progress: () => ({ current: 0, goal: 0 }) },
  { id: "w-focus-6", period: "weekly", bonusCoins: WEEKLY_CHALLENGE_COINS, progress: () => ({ current: 0, goal: 0 }) },
  { id: "w-habits-12", period: "weekly", bonusCoins: WEEKLY_CHALLENGE_COINS, progress: () => ({ current: 0, goal: 0 }) },
  { id: "w-xp-400", period: "weekly", bonusCoins: WEEKLY_CHALLENGE_COINS, progress: () => ({ current: 0, goal: 0 }) },
  { id: "w-target-4", period: "weekly", bonusCoins: WEEKLY_CHALLENGE_COINS, progress: () => ({ current: 0, goal: 0 }) },
];

/** The 3 daily challenges for a localDay; deterministic (same day -> same set). */
export function dailyChallenges(_day: LocalDay): ChallengeDef[] {
  return DAILY_CHALLENGES.slice(0, 3);
}

/** The 2 weekly challenges for a week-start day; deterministic. */
export function weeklyChallenges(_weekStart: LocalDay): ChallengeDef[] {
  return WEEKLY_CHALLENGES.slice(0, 2);
}

/** Ledger entries to add: one coins-only bonus per completed, unclaimed challenge. */
export function computeChallengeGrants(_s: ChallengeState): NewXpEntry[] {
  return [];
}
