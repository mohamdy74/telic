import type { FocusSession, ISODate, LocalDay, Task, XpLedgerEntry } from "./types";

/*
 * Pure rewards engine. XP and coins are DERIVED from the xpLedger
 * (no running totals anywhere). Entry identity is
 * (sourceType, sourceId, localDay): at most one live entry per identity.
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

export type XpSource = "task" | "habit" | "focus";

export type DenyReason =
  | "duplicate"
  | "daily-cap"
  | "task-too-new"
  | "focus-incomplete"
  | "focus-break";

export type NewXpEntry = Pick<XpLedgerEntry, "sourceType" | "sourceId" | "localDay" | "xp" | "coins">;

export type AwardResult = { entry: NewXpEntry | null; reason: DenyReason | null };

export type AwardEvent =
  | { kind: "task-completed"; task: Task & { completedAt: ISODate }; localDay: LocalDay }
  | { kind: "habit-done"; habitId: string; localDay: LocalDay }
  | { kind: "focus-completed"; session: FocusSession };

export type RevokeSource = { sourceType: XpSource; sourceId: string; localDay?: LocalDay | undefined };

export type RewardTotals = {
  xp: number;
  coins: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
};

/**
 * Computes the ledger entry to add for a completed action, or null plus a
 * reason code when nothing should be awarded.
 */
export function awardXp(event: AwardEvent, ledger: XpLedgerEntry[]): AwardResult {
  void event;
  void ledger;
  return { entry: null, reason: "duplicate" }; // RED stub
}

/** Returns the live ledger entries matching the source (to be soft-deleted). */
export function revokeXp(source: RevokeSource, ledger: XpLedgerEntry[]): XpLedgerEntry[] {
  void source;
  void ledger;
  return []; // RED stub
}

/** Derived totals: XP, coin balance and level position for the whole ledger. */
export function totalsFromLedger(ledger: XpLedgerEntry[]): RewardTotals {
  void ledger;
  return { xp: 0, coins: 0, level: 1, xpIntoLevel: 0, xpForNextLevel: 0 }; // RED stub
}
