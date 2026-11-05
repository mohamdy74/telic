import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Coins, Lock, Palette, Pencil, Plus, RotateCcw, ShoppingBag, Sparkles, Target, Trash2, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { usePrefs } from "@/components/app/preferences";
import { ACHIEVEMENT_ICONS } from "@/components/app/achievementIcons";
import { startOfWeek } from "@/lib/dates";
import { formatDate, formatNumber } from "@/lib/i18n";
import { ACHIEVEMENTS, type Achievement, type AchievementState } from "@/lib/achievements";
import { dailyChallenges, weeklyChallenges, type ChallengeDef } from "@/lib/challenges";
import { totalsFromLedger, xpAwardedOnDay } from "@/lib/rewards";
import { purchaseHistory } from "@/lib/shop";
import { THEMES, isThemeUnlocked, type ThemeUnlockState } from "@/lib/themes";
import { DAILY_XP_CAP, THEME_UNLOCKS } from "@/lib/rewardsConfig";
import { progressState, settings as settingsApi, shop as shopApi, todayLocal, useStore } from "@/lib/store";
import type { AchievementUnlock, Purchase, ShopItem } from "@/lib/types";

export const Route = createFileRoute("/rewards")({
  head: () => ({
    meta: [
      { title: "Rewards — Tilth" },
      { name: "description", content: "Earn XP, level up and unlock rewards for meaningful progress." },
      { property: "og:title", content: "Rewards — Tilth" },
      { property: "og:description", content: "Earn XP, level up and unlock rewards for meaningful progress." },
    ],
  }),
  component: RewardsPage,
});

function RewardsPage() {
  const { t } = usePrefs();
  const ready = useStore((s) => s.ready);
  if (!ready) return <RewardsSkeleton />;
  return (
    <section>
      <p className="mb-2 text-sm font-medium text-primary">{t.nav.rewards}</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
        {t.pages.rewards.title}
      </h1>
      <p className="mt-2 text-muted-foreground">{t.pages.rewards.body}</p>
      <div className="mt-6 space-y-4">
        <LevelPanel />
        <ChallengesPanel />
        <ShopPanel />
        <ThemesPanel />
        <AchievementsGallery />
      </div>
    </section>
  );
}

/* ---------------- level & coins ---------------- */

function LevelPanel() {
  const { t, locale } = usePrefs();
  const ledger = useStore((s) => s.xpLedger);
  const totals = totalsFromLedger(ledger);
  const todayXp = xpAwardedOnDay(ledger, todayLocal());
  const levelPct =
    totals.xpForNextLevel <= 0
      ? 0
      : Math.min(100, Math.round((totals.xpIntoLevel / totals.xpForNextLevel) * 100));
  const todayPct =
    DAILY_XP_CAP <= 0 ? 0 : Math.min(100, Math.round((todayXp / DAILY_XP_CAP) * 100));
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center gap-2 text-muted-foreground">
        <span className="text-primary">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <h2 className="text-sm font-semibold">{t.rew.levelXp}</h2>
      </div>
      <div className="flex items-center gap-4">
        <p className="font-display text-5xl font-semibold tabular-nums">
          {formatNumber(locale, totals.level)}
        </p>
        <div className="flex-1 space-y-2">
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-accent/40" aria-hidden>
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: levelPct + "%" }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {formatNumber(locale, totals.xpIntoLevel) +
                " / " +
                formatNumber(locale, totals.xpForNextLevel) +
                " " +
                t.dash.xpUnit}
            </p>
          </div>
          <div>
            <div className="h-1.5 overflow-hidden rounded-full bg-accent/40" aria-hidden>
              <div
                className="h-full rounded-full bg-primary/70 transition-all"
                style={{ width: todayPct + "%" }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {formatNumber(locale, todayXp) +
                " / " +
                formatNumber(locale, DAILY_XP_CAP) +
                " " +
                t.rew.todayXp}
            </p>
          </div>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
        <Coins className="size-4 text-primary" aria-hidden />
        {formatNumber(locale, totals.coins) + " " + t.dash.coins}
      </p>
    </div>
  );
}

/* ---------------- challenges ---------------- */

function ChallengesPanel() {
  const { t } = usePrefs();
  const weekStartsOn = useStore((s) => s.settings.weekStartsOn);
  const ps = progressState(useStore());
  const today = todayLocal();
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center gap-2 text-muted-foreground">
        <span className="text-primary">
          <Target className="size-4" aria-hidden />
        </span>
        <h2 className="text-sm font-semibold">{t.rew.challenges}</h2>
      </div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t.rew.dailyChallenges}
      </h3>
      <ul className="mt-2 space-y-2">
        {dailyChallenges(today).map((d) => (
          <ChallengeRow key={d.id} def={d} ps={ps} />
        ))}
      </ul>
      <h3 className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t.rew.weeklyChallenges}
      </h3>
      <ul className="mt-2 space-y-2">
        {weeklyChallenges(startOfWeek(today, weekStartsOn)).map((d) => (
          <ChallengeRow key={d.id} def={d} ps={ps} />
        ))}
      </ul>
    </div>
  );
}

function ChallengeRow({ def, ps }: { def: ChallengeDef; ps: AchievementState }) {
  const { t, locale } = usePrefs();
  const p = def.progress(ps);
  const done = p.goal > 0 && p.current >= p.goal;
  const pct = p.goal <= 0 ? 0 : Math.min(100, Math.round((p.current / p.goal) * 100));
  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{t.chal[def.id].name}</p>
        {done ? (
          <span className="flex items-center gap-1 text-xs font-medium text-primary">
            <CheckCircle2 className="size-4" aria-hidden /> {t.rew.challengeDone}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
            <Coins className="size-3.5 text-primary" aria-hidden />
            {t.rew.bonus.replace("{n}", formatNumber(locale, def.bonusCoins))}
          </span>
        )}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-accent/40" aria-hidden>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: pct + "%" }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
        {formatNumber(locale, p.current) + " / " + formatNumber(locale, p.goal)}
      </p>
    </li>
  );
}

/* ---------------- achievements gallery ---------------- */

function AchievementsGallery() {
  const { t, locale } = usePrefs();
  const unlocks = useStore((s) => s.achievements);
  const ps = progressState(useStore());
  const live = unlocks.filter((u) => !u.deletedAt);
  const byId = new Map(live.map((u) => [u.achievementId, u] as const));
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-primary">
            <Trophy className="size-4" aria-hidden />
          </span>
          <h2 className="text-sm font-semibold">{t.settings.cards.achievements}</h2>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t.rew.unlockedCount
            .replace("{n}", formatNumber(locale, byId.size))
            .replace("{total}", formatNumber(locale, ACHIEVEMENTS.length))}
        </span>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ACHIEVEMENTS.map((a) => (
          <AchievementCard
            key={a.id}
            def={a}
            ps={ps}
            unlock={byId.get(a.id) ?? null}
          />
        ))}
      </ul>
    </div>
  );
}

function AchievementCard({
  def,
  ps,
  unlock,
}: {
  def: Achievement;
  ps: AchievementState;
  unlock: AchievementUnlock | null;
}) {
  const { t, locale } = usePrefs();
  const Icon = ACHIEVEMENT_ICONS[def.id] ?? Trophy;
  const unlocked = unlock !== null;
  const p = unlocked ? null : def.progress(ps);
  return (
    <li
      className={"rounded-lg border p-3 " + (unlocked ? "border-primary/40 bg-accent/20" : "border-border")}
    >
      <div className="flex items-start gap-3">
        <span
          className={
            "grid size-9 shrink-0 place-items-center rounded-full " +
            (unlocked ? "bg-primary/20 text-primary" : "bg-accent/40 text-muted-foreground")
          }
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-medium">{t.ach[def.id].name}</p>
            {unlocked ? null : <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.ach[def.id].desc}</p>
          {unlocked && unlock ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t.rew.unlockedOn.replace(
                "{date}",
                formatDate(locale, new Date(unlock.unlockedAt), { dateStyle: "medium" }),
              )}
            </p>
          ) : p ? (
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {formatNumber(locale, p.current) + " / " + formatNumber(locale, p.target)}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">{t.rew.locked}</p>
          )}
        </div>
      </div>
    </li>
  );
}

/* ---------------- shop ---------------- */

const SHOP_FIELD =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm " +
  "outline-none focus-visible:ring-2 focus-visible:ring-ring";
const SHOP_SAVE_BTN =
  "rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground " +
  "transition-colors hover:bg-primary/90";
const SHOP_QUIET_BTN =
  "rounded-md px-2 py-1 text-xs font-medium text-muted-foreground " +
  "transition-colors hover:bg-accent/40";
const SHOP_ICON_BTN = "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent/40";

interface ShopFormState {
  id: string | null;
  name: string;
  note: string;
  price: string;
}

type FlashState = { msg: string; undo?: (() => void) | undefined } | null;

function pendingPurchaseToday(
  purchases: Purchase[],
  itemId: string,
  today: string,
): Purchase | undefined {
  return purchases.find(
    (p) => !p.deletedAt && p.usedAt === undefined && p.itemId === itemId && p.localDay === today,
  );
}

function ShopPanel() {
  const { t, locale } = usePrefs();
  const ledger = useStore((s) => s.xpLedger);
  const shopItems = useStore((s) => s.shopItems);
  const purchases = useStore((s) => s.purchases);
  const coins = totalsFromLedger(ledger).coins;
  const today = todayLocal();
  const items = shopItems.filter((i) => !i.deletedAt);
  const [form, setForm] = useState<ShopFormState | null>(null);
  const [flash, setFlash] = useState<FlashState>(null);
  const flashUndo = flash?.undo;
  const nameOk = form !== null && form.name.trim().length > 0;
  const priceOk = form !== null && Number.isInteger(Number(form.price)) && Number(form.price) >= 1;

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 5000);
    return () => window.clearTimeout(id);
  }, [flash]);

  const buy = (item: ShopItem) => {
    const res = shopApi.buy(item.id);
    if (res.ok) {
      setFlash({ msg: t.shop.boughtToast.replace("{name}", item.name) });
    } else if (res.reason === "insufficient-coins") {
      setFlash({ msg: t.shop.needMoreCoins.replace("{n}", formatNumber(locale, item.price - coins)) });
    } else if (res.reason === "pending-today") {
      setFlash({ msg: t.shop.alreadyToday });
    }
  };

  const save = () => {
    if (!form || !nameOk || !priceOk) return;
    const name = form.name.trim();
    const price = Number(form.price);
    const note = form.note.trim();
    if (form.id) {
      shopApi.updateItem(form.id, { name, note: note || undefined, price });
    } else {
      shopApi.addItem({ name, note: note || undefined, price });
    }
    setForm(null);
  };

  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-primary">
            <ShoppingBag className="size-4" aria-hidden />
          </span>
          <h2 className="text-sm font-semibold">{t.shop.title}</h2>
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
          <Coins className="size-3.5 text-primary" aria-hidden />
          {formatNumber(locale, coins) + " " + t.dash.coins}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{t.shop.subtitle}</p>

      {form ? (
        <div className="mt-3 rounded-lg border border-border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                {t.shop.name}
              </span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t.shop.namePh}
                className={SHOP_FIELD}
              />
              {nameOk ? null : (
                <span className="mt-1 block text-xs text-destructive">{t.shop.nameRequired}</span>
              )}
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                {t.shop.price}
              </span>
              <input
                inputMode="numeric"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="1"
                className={SHOP_FIELD + " tabular-nums"}
              />
              {priceOk ? null : (
                <span className="mt-1 block text-xs text-destructive">{t.shop.priceInvalid}</span>
              )}
            </label>
          </div>
          <label className="mt-2 block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              {t.shop.note}
            </span>
            <input
              value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder={t.shop.notePh}
              className={SHOP_FIELD}
            />
          </label>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={save} className={SHOP_SAVE_BTN}>
              {t.shop.save}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/40"
            >
              {t.shop.cancel}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setForm({ id: null, name: "", note: "", price: "" })}
          className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/30"
        >
          <Plus className="size-4" aria-hidden /> {t.shop.addItem}
        </button>
      )}

      {items.length === 0 && !form ? (
        <div className="mt-3 rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm font-medium">{t.shop.emptyTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t.shop.emptyBody}</p>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => {
            const pending = pendingPurchaseToday(purchases, item.id, today);
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  {item.note ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.note}</p>
                  ) : null}
                  {pending ? (
                    <p className="mt-1 text-xs text-muted-foreground">{t.shop.alreadyToday}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatNumber(locale, item.price) + " " + t.dash.coins}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={t.shop.edit}
                    onClick={() =>
                      setForm({
                        id: item.id,
                        name: item.name,
                        note: item.note ?? "",
                        price: String(item.price),
                      })
                    }
                    className={SHOP_ICON_BTN}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={t.shop.delete}
                    onClick={() => {
                      shopApi.removeItem(item.id);
                      setFlash({
                        msg: t.shop.deletedToast,
                        undo: () => shopApi.restoreItem(item.id),
                      });
                    }}
                    className={SHOP_ICON_BTN}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => buy(item)}
                    disabled={!!pending}
                    className={SHOP_SAVE_BTN + " disabled:pointer-events-none disabled:opacity-50"}
                  >
                    {t.shop.buy}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t.shop.history}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">{t.shop.historyHint}</p>
      {purchaseHistory(purchases).length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{t.shop.historyEmpty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {purchaseHistory(purchases).map((p) => (
            <HistoryRow key={p.id} purchase={p} today={today} onFlash={setFlash} />
          ))}
        </ul>
      )}

      {flash && (
        <div
          role="status"
          className="animate-pop fixed inset-x-0 bottom-20 z-50 mx-auto flex w-fit max-w-[90vw] items-center rounded-full border border-border bg-card px-4 py-2 shadow-elevated md:bottom-6"
        >
          <span className="text-sm">{flash.msg}</span>
          {flashUndo && (
            <button
              type="button"
              onClick={() => {
                flashUndo();
                setFlash(null);
              }}
              className={SHOP_QUIET_BTN}
            >
              {t.shop.undo}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryRow({
  purchase,
  today,
  onFlash,
}: {
  purchase: Purchase;
  today: string;
  onFlash: (f: FlashState) => void;
}) {
  const { t, locale } = usePrefs();
  const refunded = purchase.deletedAt !== undefined;
  const used = purchase.usedAt !== undefined;
  const refundable = !refunded && !used && purchase.localDay === today;
  const day = formatDate(locale, new Date(purchase.localDay + "T12:00:00Z"), { dateStyle: "medium" });
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
      <div className="min-w-0 flex-1">
        <p
          className={
            "truncate text-sm font-medium " + (refunded ? "text-muted-foreground line-through" : "")
          }
        >
          {purchase.name}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
          {day + " · " + formatNumber(locale, purchase.price) + " " + t.dash.coins}
        </p>
      </div>
      {refunded ? (
        <span className="shrink-0 rounded-full bg-accent/50 px-2 py-0.5 text-xs text-muted-foreground">
          {t.shop.refundedLabel}
        </span>
      ) : used ? (
        <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
          {t.shop.usedLabel}
        </span>
      ) : null}
      {!refunded && (
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={used ? t.shop.unmarkUsed : t.shop.markUsed}
            onClick={() => shopApi.setUsed(purchase.id, !used)}
            className={SHOP_ICON_BTN}
          >
            {used ? (
              <RotateCcw className="size-4" aria-hidden />
            ) : (
              <CheckCircle2 className="size-4" aria-hidden />
            )}
          </button>
          {refundable && (
            <button
              type="button"
              onClick={() => {
                const res = shopApi.refund(purchase.id);
                if (res.ok) onFlash({ msg: t.shop.refundToast.replace("{name}", purchase.name) });
              }}
              className={SHOP_QUIET_BTN}
            >
              {t.shop.refund}
            </button>
          )}
        </span>
      )}
    </li>
  );
}

/* ---------------- accent themes ---------------- */

function ThemesPanel() {
  const { t, locale, accent, setAccent } = usePrefs();
  const ledger = useStore((s) => s.xpLedger);
  const unlocks = useStore((s) => s.achievements);
  const state: ThemeUnlockState = {
    level: totalsFromLedger(ledger).level,
    unlockedAchievements: unlocks.filter((u) => !u.deletedAt).map((u) => u.achievementId),
  };
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center gap-2 text-muted-foreground">
        <span className="text-primary">
          <Palette className="size-4" aria-hidden />
        </span>
        <h2 className="text-sm font-semibold">{t.themes.title}</h2>
      </div>
      <p className="text-xs text-muted-foreground">{t.themes.subtitle}</p>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {THEMES.map((th) => {
          const rule = THEME_UNLOCKS[th.id];
          const unlocked = isThemeUnlocked(th.id, state);
          let sub: string;
          if (!unlocked) {
            if (rule.type === "level") {
              sub = t.themes.unlockLevel.replace("{level}", formatNumber(locale, rule.level));
            } else if (rule.type === "achievement") {
              sub = t.themes.unlockAchievement.replace("{name}", t.ach[rule.achievementId].name);
            } else {
              sub = t.themes.default;
            }
          } else if (accent === th.id) {
            sub = t.themes.selected;
          } else {
            sub = rule.type === "default" ? t.themes.default : t.themes.current;
          }
          const base =
            "flex w-full items-center gap-3 rounded-lg border p-3 text-start transition-colors ";
          const cls =
            base +
            (accent === th.id
              ? "border-primary/60 bg-accent/30"
              : "border-border hover:bg-accent/20") +
            (unlocked ? "" : " cursor-not-allowed opacity-70");
          return (
            <li key={th.id}>
              <button
                type="button"
                disabled={!unlocked}
                aria-pressed={accent === th.id}
                onClick={() => {
                  if (!unlocked) return;
                  setAccent(th.id);
                  settingsApi.update({ accent: th.id });
                }}
                className={cls}
              >
                <span
                  className="size-5 shrink-0 rounded-full border border-border"
                  style={{ background: "oklch(0.58 0.1 " + th.hue + ")" }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{t.themes.names[th.id]}</span>
                  <span className="block text-xs text-muted-foreground">{sub}</span>
                </span>
                {unlocked ? null : (
                  <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------- skeleton ---------------- */

function RewardsSkeleton() {
  return (
    <section aria-busy="true">
      <div className="mb-2 h-4 w-14 animate-pulse rounded bg-accent/30" />
      <div className="h-9 w-64 max-w-full animate-pulse rounded bg-accent/30" />
      <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-accent/30" />
      <div className="mt-6 h-32 animate-pulse rounded-xl bg-accent/30" />
      <div className="mt-4 h-48 animate-pulse rounded-xl bg-accent/30" />
      <div className="mt-4 h-64 animate-pulse rounded-xl bg-accent/30" />
      <div className="mt-4 h-64 animate-pulse rounded-xl bg-accent/30" />
    </section>
  );
}
