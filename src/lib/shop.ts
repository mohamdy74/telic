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
  { ok: true; purchase: Purchase; entry: NewXpEntry } | { ok: false; reason: BuyDenyReason };

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
  const item = input.items.find((i) => i.id === input.itemId && !i.deletedAt);
  if (!item) return { ok: false, reason: "not-found" };
  if (!Number.isInteger(item.price) || item.price < 1) {
    return { ok: false, reason: "invalid-price" };
  }
  if (totalsFromLedger(input.ledger).coins < item.price) {
    return { ok: false, reason: "insufficient-coins" };
  }
  const pending = input.purchases.find(
    (p) =>
      !p.deletedAt &&
      p.usedAt === undefined &&
      p.itemId === input.itemId &&
      p.localDay === input.today,
  );
  if (pending) return { ok: false, reason: "pending-today" };
  const purchase: Purchase = {
    id: input.purchaseId,
    itemId: item.id,
    name: item.name,
    price: item.price,
    localDay: input.today,
    createdAt: input.now,
    updatedAt: input.now,
  };
  const entry: NewXpEntry = {
    sourceType: "shop",
    sourceId: purchase.id,
    localDay: input.today,
    xp: 0,
    coins: -item.price,
  };
  return { ok: true, purchase, entry };
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
  const p = input.purchases.find((x) => x.id === input.purchaseId);
  if (!p) return { ok: false, reason: "not-found" };
  if (p.deletedAt !== undefined) return { ok: false, reason: "refunded" };
  if (p.usedAt !== undefined) return { ok: false, reason: "used" };
  if (p.localDay !== input.today) return { ok: false, reason: "not-today" };
  const revoked = revokeXp({ sourceType: "shop", sourceId: input.purchaseId }, input.ledger);
  return {
    ok: true,
    purchase: { ...p, deletedAt: input.now, updatedAt: input.now },
    revoked,
    now: input.now,
  };
}

/** Sets or clears usedAt; null when the purchase is missing or refunded. */
export function markPurchaseUsed(
  purchases: Purchase[],
  purchaseId: string,
  used: boolean,
  now: ISODate,
): Purchase | null {
  const p = purchases.find((x) => x.id === purchaseId);
  if (!p || p.deletedAt !== undefined) return null;
  return { ...p, usedAt: used ? now : undefined, updatedAt: now };
}

/** Purchase history: every purchase (refunds included), newest first. */
export function purchaseHistory(purchases: Purchase[]): Purchase[] {
  return [...purchases].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
}
