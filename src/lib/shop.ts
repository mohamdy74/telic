import { revokeXp, totalsFromLedger, type NewXpEntry } from "./rewards";
import type { ISODate, LocalDay, Purchase, ShopItem, XpLedgerEntry } from "./types";

/*
 * Pure shop engine. Buying writes TWO records through the store:
 * a Purchase (history + used/refunded state, snapshots of name and
 * price so deleting the item never rewrites history) and an xpLedger
 * entry (sourceType "shop", sourceId = the purchase id, coins =
 * -price, xp 0) — the ledger stays the ONLY source of the balance,
 * so a refund is just a soft-delete of that entry.
 *
 * Guardrails (honest, not security — local data can be edited):
 * - the balance is checked before every buy: it can never go negative;
 * - double-tap/rapid clicks are idempotent: while a purchase of the
 *   same item from the same localDay is still unused, the next buy is
 *   denied ("pending-today");
 * - refunds only on the purchase localDay and only while unused;
 * - each purchase gets its own unique id (crypto.randomUUID at the
 *   store wiring point) which is also the ledger sourceId.
 */

export type BuyDenyReason = "not-found" | "invalid-price" | "insufficient-coins" | "pending-today";

export type BuyOutcome =
  | { ok: true; purchase: Purchase; entry: NewXpEntry }
  | { ok: false; reason: BuyDenyReason };

export interface BuyInput {
  items: ShopItem[];
  purchases: Purchase[];
  ledger: XpLedgerEntry[];
  itemId: string;
  today: LocalDay;
  purchaseId: string;
  now: ISODate;
}

export function buyShopItem(input: BuyInput): BuyOutcome {
  void input; // stub (RED)
  void totalsFromLedger;
  return { ok: false, reason: "not-found" };
}

export type RefundDenyReason = "not-found" | "refunded" | "used" | "not-today";

export type RefundOutcome =
  | { ok: true; purchase: Purchase; revoked: XpLedgerEntry[]; now: ISODate }
  | { ok: false; reason: RefundDenyReason };

export interface RefundInput {
  purchases: Purchase[];
  ledger: XpLedgerEntry[];
  purchaseId: string;
  today: LocalDay;
  now: ISODate;
}

export function refundPurchase(input: RefundInput): RefundOutcome {
  void input; // stub (RED)
  void revokeXp;
  return { ok: false, reason: "not-found" };
}

/** Sets or clears usedAt; null when the purchase is missing or refunded. */
export function markPurchaseUsed(
  purchases: Purchase[],
  purchaseId: string,
  used: boolean,
  now: ISODate,
): Purchase | null {
  void purchases; // stub (RED)
  void purchaseId;
  void used;
  void now;
  return null;
}

/** Purchase history: every purchase (refunds included), newest first. */
export function purchaseHistory(purchases: Purchase[]): Purchase[] {
  void purchases; // stub (RED)
  return [];
}
