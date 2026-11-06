import {
  COINS_PER_XP,
  DAILY_XP_CAP,
  HABIT_XP,
  TASK_MIN_AGE_MS,
  TASK_XP,
  XP_PER_FOCUS_MINUTE,
  levelFromXp,
} from "./rewardsConfig";
import type { FocusSession, ISODate, LocalDay, Task, XpLedgerEntry } from "./types";

/*
 * Pure rewards engine. XP and coins are DERIVED from the xpLedger
 * (no running totals anywhere). Entry identity is
 * (sourceType, sourceId, localDay): at most one live entry per identity.
 * Award entries carry coins: 0 — the coin balance is
 * floor(total positive XP / COINS_PER_XP) plus every entry coins value
 * (shop entries are negative), so odd XP remainders are never lost per-entry.
 *
 * ANTI-CHEAT HONESTY NOTE: the rules below (daily cap, task minimum age,
 * once-per-day habits, completed-work-only focus) are guardrails against
 * self-cheating and accidental double awards. They are NOT security: all
 * data lives in the local browser and can be edited via the import feature,
 * so a determined user can always forge ledger entries. That is accepted.
 *
 * Clock rule: awards use the localDay STORED ON THE EVENT (habit log day,
 * focus session day, task completion day captured at completion time),
 * never a recomputed "now" — so editing the device clock after the fact
 * cannot move an award to another day or re-open a capped one.
 */

export type XpSource = "task" | "habit" | "focus" | "shop";

export type DenyReason =
  "duplicate" | "daily-cap" | "task-too-new" | "focus-incomplete" | "focus-break";

export type NewXpEntry = Pick<
  XpLedgerEntry,
  "sourceType" | "sourceId" | "localDay" | "xp" | "coins"
>;

export type AwardResult = { entry: NewXpEntry | null; reason: DenyReason | null };

export type AwardEvent =
  | { kind: "task-completed"; task: Task & { completedAt: ISODate }; localDay: LocalDay }
  | { kind: "habit-done"; habitId: string; localDay: LocalDay }
  | { kind: "focus-completed"; session: FocusSession };

export type RevokeSource = {
  sourceType: XpSource;
  sourceId: string;
  localDay?: LocalDay | undefined;
};

export type RewardTotals = {
  xp: number;
  coins: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
};

function liveEntries(ledger: XpLedgerEntry[]): XpLedgerEntry[] {
  return ledger.filter((e) => !e.deletedAt);
}

function findLive(
  live: XpLedgerEntry[],
  sourceType: XpSource,
  sourceId: string,
  localDay: LocalDay,
) {
  return live.find(
    (e) => e.sourceType === sourceType && e.sourceId === sourceId && e.localDay === localDay,
  );
}

function xpAwardedOn(live: XpLedgerEntry[], localDay: LocalDay): number {
  return live.reduce((sum, e) => (e.localDay === localDay && e.xp > 0 ? sum + e.xp : sum), 0);
}

function denied(reason: DenyReason): AwardResult {
  return { entry: null, reason };
}

/** Cap-aware award: shrinks the XP to the remaining room, denies at zero room. */
function awardCapped(live: XpLedgerEntry[], entry: NewXpEntry, baseXp: number): AwardResult {
  const remaining = DAILY_XP_CAP - xpAwardedOn(live, entry.localDay);
  if (remaining <= 0) return denied("daily-cap");
  return { entry: { ...entry, xp: Math.min(baseXp, remaining) }, reason: null };
}

/**
 * Computes the ledger entry to add for a completed action, or null plus a
 * reason code when nothing should be awarded. Pure: reads only the event and
 * the ledger; never touches the store, Date.now() or localStorage.
 */
export function awardXp(event: AwardEvent, ledger: XpLedgerEntry[]): AwardResult {
  const live = liveEntries(ledger);
  if (event.kind === "task-completed") {
    const { task, localDay } = event;
    if (findLive(live, "task", task.id, localDay)) return denied("duplicate");
    if (Date.parse(task.completedAt) - Date.parse(task.createdAt) < TASK_MIN_AGE_MS) {
      return denied("task-too-new");
    }
    return awardCapped(
      live,
      { sourceType: "task", sourceId: task.id, localDay, xp: 0, coins: 0 },
      TASK_XP[task.priority],
    );
  }
  if (event.kind === "habit-done") {
    const { habitId, localDay } = event;
    if (findLive(live, "habit", habitId, localDay)) return denied("duplicate");
    return awardCapped(
      live,
      { sourceType: "habit", sourceId: habitId, localDay, xp: 0, coins: 0 },
      HABIT_XP,
    );
  }
  const { session } = event;
  if (!session.completed) return denied("focus-incomplete");
  if (session.mode === "break") return denied("focus-break");
  if (findLive(live, "focus", session.id, session.localDay)) return denied("duplicate");
  return awardCapped(
    live,
    { sourceType: "focus", sourceId: session.id, localDay: session.localDay, xp: 0, coins: 0 },
    session.plannedMinutes * XP_PER_FOCUS_MINUTE,
  );
}

/** Returns the live ledger entries matching the source (to be soft-deleted). */
export function revokeXp(source: RevokeSource, ledger: XpLedgerEntry[]): XpLedgerEntry[] {
  return liveEntries(ledger).filter(
    (e) =>
      e.sourceType === source.sourceType &&
      e.sourceId === source.sourceId &&
      (source.localDay === undefined || e.localDay === source.localDay),
  );
}

/** Derived totals: XP, coin balance and level position for the whole ledger. */
export function totalsFromLedger(ledger: XpLedgerEntry[]): RewardTotals {
  const live = liveEntries(ledger);
  const xp = live.reduce((sum, e) => sum + e.xp, 0);
  const coinAdjustments = live.reduce((sum, e) => sum + e.coins, 0);
  const { level, xpIntoLevel, xpForNextLevel } = levelFromXp(xp);
  return {
    xp,
    coins: Math.floor(xp / COINS_PER_XP) + coinAdjustments,
    level,
    xpIntoLevel,
    xpForNextLevel,
  };
}

/** XP awarded on one localDay (live entries) — the today-vs-cap readout. */
export function xpAwardedOnDay(ledger: XpLedgerEntry[], localDay: LocalDay): number {
  return xpAwardedOn(liveEntries(ledger), localDay);
}
