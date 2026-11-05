import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Coins, Lock, Sparkles, Target, Trophy } from "lucide-react";
import { usePrefs } from "@/components/app/preferences";
import { ACHIEVEMENT_ICONS } from "@/components/app/achievementIcons";
import { startOfWeek } from "@/lib/dates";
import { formatDate, formatNumber } from "@/lib/i18n";
import { ACHIEVEMENTS, type Achievement, type AchievementState } from "@/lib/achievements";
import { dailyChallenges, weeklyChallenges, type ChallengeDef } from "@/lib/challenges";
import { totalsFromLedger, xpAwardedOnDay } from "@/lib/rewards";
import { DAILY_XP_CAP } from "@/lib/rewardsConfig";
import { progressState, todayLocal, useStore } from "@/lib/store";
import type { AchievementUnlock } from "@/lib/types";

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
  const ps = useStore(progressState);
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
  const ps = useStore(progressState);
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
    </section>
  );
}
