import { describe, expect, it } from "vitest";
import { totalsFromLedger } from "./rewards";
import { buyShopItem, markPurchaseUsed, purchaseHistory, refundPurchase } from "./shop";
import type { Purchase, ShopItem, XpLedgerEntry } from "./types";

const DAY = "2026-11-05";
const NEXT_DAY = "2026-11-06";
const NOW = "2026-11-05T12:00:00.000Z";
const LATER = "2026-11-05T18:00:00.000Z";

const rec = (id: string) => ({ id, createdAt: NOW, updatedAt: NOW });

const item = (id: string, price: number): ShopItem =>
  ({ ...rec(id), name: "Reward " + id, price }) as ShopItem;

const xpEntry = (id: string, xp: number, day = DAY): XpLedgerEntry =>
  ({ ...rec(id), sourceType: "task", sourceId: id, localDay: day, xp, coins: 0 }) as XpLedgerEntry;

const purchase = (id: string, over: Partial<Purchase> = {}): Purchase =>
  ({ ...rec(id), itemId: "a", name: "Reward a", price: 15, localDay: DAY, ...over }) as Purchase;

describe("shop", () => {
  it("buy creates a purchase snapshot and a coins-only negative ledger entry", () => {
    const res = buyShopItem({
      items: [item("a", 15)],
      purchases: [],
      ledger: [xpEntry("x", 30)],
      itemId: "a",
      today: DAY,
      purchaseId: "p1",
      now: NOW,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.entry).toEqual({ sourceType: "shop", sourceId: "p1", localDay: DAY, xp: 0, coins: -15 });
      expect(res.purchase).toMatchObject({
        id: "p1",
        itemId: "a",
        name: "Reward a",
        price: 15,
        localDay: DAY,
        createdAt: NOW,
      });
      expect(res.purchase.usedAt).toBeUndefined();
      const applied = [xpEntry("x", 30), { ...rec("p1"), ...res.entry } as XpLedgerEntry];
      expect(totalsFromLedger(applied).coins).toBe(0);
    }
  });

  it("a rapid double-tap buys exactly once: a pending purchase blocks the same item that day", () => {
    const ledger = [xpEntry("x", 60)]; // 30 coins
    const first = buyShopItem({
      items: [item("a", 15)],
      purchases: [],
      ledger,
      itemId: "a",
      today: DAY,
      purchaseId: "p1",
      now: NOW,
    });
    expect(first.ok).toBe(true);
    const second = buyShopItem({
      items: [item("a", 15)],
      purchases: [purchase("p1")],
      ledger,
      itemId: "a",
      today: DAY,
      purchaseId: "p2",
      now: NOW,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("pending-today");
  });

  it("buying again works after the purchase was used or refunded", () => {
    const used = markPurchaseUsed([purchase("p1")], "p1", true, LATER);
    expect(used?.usedAt).toBe(LATER);
    const again = buyShopItem({
      items: [item("a", 15)],
      purchases: [purchase("p1", { usedAt: LATER })],
      ledger: [xpEntry("x", 60)],
      itemId: "a",
      today: DAY,
      purchaseId: "p2",
      now: LATER,
    });
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.purchase.id).toBe("p2");
    const afterRefund = buyShopItem({
      items: [item("a", 15)],
      purchases: [purchase("p1", { deletedAt: LATER })],
      ledger: [xpEntry("x", 60)],
      itemId: "a",
      today: DAY,
      purchaseId: "p3",
      now: LATER,
    });
    expect(afterRefund.ok).toBe(true);
    if (afterRefund.ok) expect(afterRefund.purchase.id).toBe("p3");
  });

  it("two items on the same day get distinct purchase ids", () => {
    const one = buyShopItem({
      items: [item("a", 10), item("b", 10)],
      purchases: [],
      ledger: [xpEntry("x", 60)],
      itemId: "a",
      today: DAY,
      purchaseId: "p1",
      now: NOW,
    });
    const two = buyShopItem({
      items: [item("a", 10), item("b", 10)],
      purchases: one.ok ? [one.purchase] : [],
      ledger: [xpEntry("x", 60)],
      itemId: "b",
      today: DAY,
      purchaseId: "p2",
      now: NOW,
    });
    expect(one.ok && two.ok).toBe(true);
    if (one.ok && two.ok) {
      expect(one.purchase.id).not.toBe(two.purchase.id);
      expect(one.entry.sourceId).not.toBe(two.entry.sourceId);
      const applied = [
        xpEntry("x", 60),
        { ...rec("p1"), ...one.entry } as XpLedgerEntry,
        { ...rec("p2"), ...two.entry } as XpLedgerEntry,
      ];
      expect(totalsFromLedger(applied).coins).toBe(10);
    }
  });

  it("insufficient coins denies the buy and the balance never goes negative", () => {
    const ledger = [xpEntry("x", 40)]; // 20 coins
    const denied = buyShopItem({
      items: [item("a", 25)],
      purchases: [],
      ledger,
      itemId: "a",
      today: DAY,
      purchaseId: "p1",
      now: NOW,
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.reason).toBe("insufficient-coins");
    expect(totalsFromLedger(ledger).coins).toBe(20);
    const exact = buyShopItem({
      items: [item("b", 20)],
      purchases: [],
      ledger,
      itemId: "b",
      today: DAY,
      purchaseId: "p2",
      now: NOW,
    });
    expect(exact.ok).toBe(true);
    if (exact.ok) {
      const after = [xpEntry("x", 40), { ...rec("p2"), ...exact.entry } as XpLedgerEntry];
      expect(totalsFromLedger(after).coins).toBe(0);
      const next = buyShopItem({
        items: [item("c", 1)],
        purchases: [exact.purchase],
        ledger: after,
        itemId: "c",
        today: DAY,
        purchaseId: "p3",
        now: NOW,
      });
      expect(next.ok).toBe(false);
      expect(totalsFromLedger(after).coins).toBe(0);
    }
  });

  it("missing or soft-deleted items deny with not-found", () => {
    const missing = buyShopItem({
      items: [item("a", 10)],
      purchases: [],
      ledger: [xpEntry("x", 40)],
      itemId: "zz",
      today: DAY,
      purchaseId: "p1",
      now: NOW,
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.reason).toBe("not-found");
    const deleted = buyShopItem({
      items: [{ ...item("a", 10), deletedAt: LATER }],
      purchases: [],
      ledger: [xpEntry("x", 40)],
      itemId: "a",
      today: DAY,
      purchaseId: "p2",
      now: NOW,
    });
    expect(deleted.ok).toBe(false);
    if (!deleted.ok) expect(deleted.reason).toBe("not-found");
  });

  it("a non-positive or fractional price denies with invalid-price", () => {
    for (const price of [0, -5, 2.5]) {
      const res = buyShopItem({
        items: [item("a", price)],
        purchases: [],
        ledger: [xpEntry("x", 400)],
        itemId: "a",
        today: DAY,
        purchaseId: "p1",
        now: NOW,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.reason).toBe("invalid-price");
    }
  });

  it("refund restores the coins on the same day", () => {
    const entry = {
      ...rec("p1"),
      sourceType: "shop",
      sourceId: "p1",
      localDay: DAY,
      xp: 0,
      coins: -15,
    } as XpLedgerEntry;
    const ledger = [xpEntry("x", 30), entry]; // 15 - 15 = 0 coins
    const res = refundPurchase({ purchases: [purchase("p1")], ledger, purchaseId: "p1", today: DAY, now: LATER });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.purchase.deletedAt).toBe(LATER);
      expect(res.revoked.map((e) => e.id)).toEqual(["p1"]);
      const refunded = [xpEntry("x", 30), { ...entry, deletedAt: LATER, updatedAt: LATER }];
      expect(totalsFromLedger(refunded).coins).toBe(15);
    }
  });

  it("refund denies after the day changed, once used, already refunded, or missing", () => {
    const entry = { ...rec("p1"), sourceType: "shop", sourceId: "p1", localDay: DAY, xp: 0, coins: -15 } as XpLedgerEntry;
    const ledger = [xpEntry("x", 30), entry];
    const cases: Array<[Purchase, string, RefundDenyLike]> = [
      [purchase("p1"), NEXT_DAY, "not-today"],
      [purchase("p1", { usedAt: LATER }), DAY, "used"],
      [purchase("p1", { deletedAt: LATER }), DAY, "refunded"],
    ];
    for (const [p, today, reason] of cases) {
      const res = refundPurchase({ purchases: [p], ledger, purchaseId: "p1", today, now: LATER });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.reason).toBe(reason);
    }
    const missing = refundPurchase({ purchases: [purchase("p1")], ledger, purchaseId: "zz", today: DAY, now: LATER });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.reason).toBe("not-found");
  });

  it("markPurchaseUsed toggles usedAt and refuses refunded purchases", () => {
    const used = markPurchaseUsed([purchase("p1")], "p1", true, LATER);
    expect(used?.usedAt).toBe(LATER);
    const unused = markPurchaseUsed([purchase("p1", { usedAt: LATER })], "p1", false, NOW);
    expect(unused?.usedAt).toBeUndefined();
    expect(markPurchaseUsed([purchase("p1", { deletedAt: LATER })], "p1", true, NOW)).toBeNull();
  });

  it("purchase history keeps refunded rows and sorts newest first", () => {
    const rows = [
      purchase("p1", { createdAt: "2026-11-05T10:00:00.000Z", updatedAt: "2026-11-05T10:00:00.000Z" }),
      purchase("p2", { createdAt: "2026-11-05T14:00:00.000Z", updatedAt: "2026-11-05T14:00:00.000Z" }),
      purchase("p3", { createdAt: "2026-11-05T12:00:00.000Z", updatedAt: "2026-11-05T12:00:00.000Z", deletedAt: LATER }),
    ];
    const h = purchaseHistory(rows);
    expect(h.map((p) => p.id)).toEqual(["p2", "p3", "p1"]);
    expect(h.some((p) => p.deletedAt !== undefined)).toBe(true);
  });
});

type RefundDenyLike = "not-found" | "refunded" | "used" | "not-today";
