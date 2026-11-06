import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarClock,
  CheckCircle2,
  Circle,
  Coins,
  ListTodo,
  Sparkles,
  Sprout,
  Target,
  Timer,
  Trophy,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { usePrefs } from "@/components/app/preferences";
import { ACHIEVEMENT_ICONS } from "@/components/app/achievementIcons";
import { formatDate, formatNumber } from "@/lib/i18n";
import {
  dailyProgress,
  habitsDueToday,
  todaysPriorities,
  upcomingDeadlines,
  type DailyProgress,
  type HabitDue,
} from "@/lib/dashboard";
import { workMinutesToday } from "@/lib/focusTime";
import { latestUnlocks } from "@/lib/achievements";
import { totalsFromLedger, xpAwardedOnDay } from "@/lib/rewards";
import { DAILY_XP_CAP } from "@/lib/rewardsConfig";
import { habits as habitsApi, tasks as tasksApi, todayLocal, useStore } from "@/lib/store";
import { currentTimeZone } from "@/lib/dates";
import { digestFor } from "@/lib/digest";
import type { Task } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today — Tilth" },
      {
        name: "description",
        content: "Your daily dashboard: priorities, habits, focus and progress in one calm view.",
      },
      { property: "og:title", content: "Today — Tilth" },
      {
        property: "og:description",
        content: "Your daily dashboard: priorities, habits, focus and progress in one calm view.",
      },
    ],
  }),
  component: DashboardPage,
});

const PRIMARY_BTN =
  "inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground " +
  "transition-colors hover:bg-primary/90";
const OUTLINE_BTN =
  "inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium " +
  "text-foreground transition-colors hover:bg-accent/40";
const LINK_FOOTER = "text-xs font-medium text-primary transition-colors hover:text-primary/80";
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60";

const RING_R = 45; // pure geometry, workerd-safe at module level
const RING_C = 2 * Math.PI * RING_R;
const MAX_ROWS = 5;

const PRIORITY_DOT: Record<Task["priority"], string> = {
  high: "bg-destructive",
  medium: "bg-primary",
  low: "bg-muted-foreground/50",
};

function DashboardPage() {
  const { t, locale } = usePrefs();
  const ready = useStore((s) => s.ready);
  const allTasks = useStore((s) => s.tasks);
  const allHabits = useStore((s) => s.habits);
  const allLogs = useStore((s) => s.habitLogs);
  const allSessions = useStore((s) => s.focusSessions);
  const cards = useStore((s) => s.settings.dashboardCards);
  const target = useStore((s) => s.settings.dailyFocusTargetMinutes);
  const dayStartHour = useStore((s) => s.settings.dayStartHour);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(id);
  }, [toast]);

  if (!ready) return <DashboardSkeleton />;

  const today = todayLocal();
  const liveTasks = allTasks.filter((x) => !x.deletedAt);
  const liveHabits = allHabits.filter((x) => !x.deletedAt);
  const liveLogs = allLogs.filter((x) => !x.deletedAt);
  const liveSessions = allSessions.filter((x) => !x.deletedAt);

  const priorities = todaysPriorities(liveTasks, today);
  const progress = dailyProgress(liveTasks, liveHabits, liveLogs, today);
  const deadlines = upcomingDeadlines(liveTasks, today);
  const dueHabits = habitsDueToday(liveHabits, liveLogs, today);
  const focusMinutes = workMinutesToday(liveSessions, today);
  const firstRun =
    liveTasks.length === 0 && liveHabits.length === 0 && liveSessions.length === 0;
  const anyCard = Object.values(cards).some((v) => v);

  // Quiet morning/evening summary — the "my day" line under the title.
  const digest = digestFor({
    tasks: liveTasks,
    habits: liveHabits,
    logs: liveLogs,
    sessions: liveSessions,
    today,
    hour: new Date().getHours(),
    dayStartHour,
    timeZone: currentTimeZone(),
  });
  const greetingWord = digest.greeting === "morning" ? t.dig.morning : t.dig.evening;
  const digestLine =
    digest.greeting === "morning"
      ? digest.tasksDue === 0 && digest.overdue === 0 && digest.habitsDue === 0
        ? t.dig.quietDay
        : [
            t.dig.tasksDue.replace("{n}", formatNumber(locale, digest.tasksDue)),
            ...(digest.overdue > 0
              ? [t.dig.overdue.replace("{n}", formatNumber(locale, digest.overdue))]
              : []),
            t.dig.habitsDue.replace("{n}", formatNumber(locale, digest.habitsDue)),
          ].join(" · ")
      : digest.completedToday === 0 && digest.stillOpen === 0 && digest.tomorrowOpen === 0
        ? t.dig.allDone
        : [
            t.dig.completedToday.replace("{n}", formatNumber(locale, digest.completedToday)),
            t.dig.focusToday.replace("{n}", formatNumber(locale, digest.focusMinutes)),
            ...(digest.stillOpen > 0
              ? [t.dig.stillOpen.replace("{n}", formatNumber(locale, digest.stillOpen))]
              : []),
            ...(digest.tomorrowOpen > 0
              ? [t.dig.tomorrow.replace("{n}", formatNumber(locale, digest.tomorrowOpen))]
              : []),
          ].join(" · ");

  const completeTask = (id: string) => {
    tasksApi.complete(id);
    setToast(t.tasks.toasts.completed);
  };

  const toggleHabit = (h: HabitDue) => {
    if (h.done) habitsApi.unlog(h.habit.id, today);
    else habitsApi.log(h.habit.id, "done", today);
  };

  const footerLink = (to: string, label: string) => (
    <Link to={to} className={LINK_FOOTER}>
      {label}
    </Link>
  );

  return (
    <section>
      <p className="mb-2 text-sm font-medium text-primary">{t.nav.dashboard}</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
        {t.pages.dashboard.title}
      </h1>
      <p className="mt-2 text-muted-foreground">{t.pages.dashboard.body}</p>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{greetingWord}</span>
        <span>{digestLine}</span>
      </p>

      {firstRun ? (
        <WelcomePanel />
      ) : !anyCard ? (
        <div className="empty-card mt-6">
          <p className="font-display text-lg font-semibold">{t.dash.hiddenCards}</p>
          <Link to="/settings" className={OUTLINE_BTN + " mt-2"}>
            {t.nav.settings}
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.priorities && (
            <PrioritiesCard
              items={priorities.slice(0, MAX_ROWS)}
              moreCount={Math.max(0, priorities.length - MAX_ROWS)}
              today={today}
              onComplete={completeTask}
              footer={footerLink("/tasks", t.dash.viewAll)}
            />
          )}
          {cards.progress && <ProgressCard progress={progress} />}
          {cards.deadlines && (
            <DeadlinesCard
              items={deadlines.slice(0, MAX_ROWS)}
              moreCount={Math.max(0, deadlines.length - MAX_ROWS)}
              today={today}
              footer={footerLink("/tasks", t.dash.viewAll)}
            />
          )}
          {cards.habits && (
            <HabitsCard items={dueHabits} onToggle={toggleHabit} footer={footerLink("/habits", t.dash.viewAll)} />
          )}
          {cards.focus && (
            <FocusCard minutes={focusMinutes} target={target} footer={footerLink("/focus", t.dash.startFocus)} />
          )}
          {cards.level && <LevelCard />}
          {cards.achievements && <AchievementsCard />}
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="animate-pop fixed inset-x-0 bottom-20 z-50 mx-auto flex w-fit max-w-[90vw] items-center rounded-full border border-border bg-card px-4 py-2 shadow-elevated md:bottom-6"
        >
          <span className="text-sm">{toast}</span>
        </div>
      )}
    </section>
  );
}

/* ---------------- welcome ---------------- */

function WelcomePanel() {
  const { t } = usePrefs();
  return (
    <div className="panel mt-6 p-6 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent/40 text-primary">
        <Sprout className="size-6" aria-hidden />
      </span>
      <h2 className="mt-3 font-display text-xl font-semibold">{t.dash.welcome.title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t.dash.welcome.body}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Link to="/tasks" className={PRIMARY_BTN}>
          {t.dash.welcome.addTask}
        </Link>
        <Link to="/habits" className={OUTLINE_BTN}>
          {t.dash.welcome.addHabit}
        </Link>
      </div>
    </div>
  );
}

/* ---------------- card shell ---------------- */

function Card({
  title,
  icon,
  footer,
  children,
}: {
  title: string;
  icon: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="panel flex h-full flex-col p-4">
      <div className="mb-3 flex items-center gap-2 text-muted-foreground">
        <span className="text-primary">{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="flex-1">{children}</div>
      {footer !== undefined && (
        <div className="mt-3 border-t border-border pt-3 text-start">{footer}</div>
      )}
    </div>
  );
}

function EmptyBody({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full min-h-24 flex-col justify-center py-1">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

function MoreRow({ n, label }: { n: number; label: string }) {
  if (n <= 0) return null;
  return <li className="pt-1 text-xs text-muted-foreground">{label}</li>;
}

/* ---------------- cards ---------------- */

function PrioritiesCard({
  items,
  moreCount,
  today,
  onComplete,
  footer,
}: {
  items: Task[];
  moreCount: number;
  today: string;
  onComplete: (id: string) => void;
  footer?: ReactNode;
}) {
  const { t, locale } = usePrefs();
  return (
    <Card
      title={t.settings.cards.priorities}
      icon={<ListTodo className="size-4" aria-hidden />}
      footer={footer}
    >
      {items.length === 0 ? (
        <EmptyBody title={t.tasks.empty.today.title} body={t.tasks.empty.today.body} />
      ) : (
        <ul className="space-y-1.5">
          {items.map((x) => (
            <li key={x.id} className="flex items-center gap-2">
              <span className={"size-2 shrink-0 rounded-full " + PRIORITY_DOT[x.priority]} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm">{x.title}</span>
              {(x.dueDate ?? today) < today && (
                <span className="shrink-0 text-xs text-destructive">{t.tasks.view.overdue}</span>
              )}
              <button
                type="button"
                onClick={() => onComplete(x.id)}
                aria-label={t.tasks.markDone}
                className={"shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:text-primary " + FOCUS_RING}
              >
                <CheckCircle2 className="size-5" aria-hidden />
              </button>
            </li>
          ))}
          <MoreRow n={moreCount} label={t.dash.andMore.replace("{n}", formatNumber(locale, moreCount))} />
        </ul>
      )}
    </Card>
  );
}

function ProgressCard({ progress }: { progress: DailyProgress }) {
  const { t, locale } = usePrefs();
  const ratio = progress.ratio;
  return (
    <Card
      title={t.settings.cards.progress}
      icon={<Target className="size-4" aria-hidden />}
    >
      <div className="flex h-full flex-col items-center justify-center gap-3 py-2 text-center">
        {ratio === null ? (
          <>
            <span className="grid size-16 place-items-center rounded-full bg-accent/40">
              <Target className="size-7 text-muted-foreground" aria-hidden />
            </span>
            <p className="max-w-56 text-sm text-muted-foreground">{t.dash.progressEmpty}</p>
          </>
        ) : (
          <>
            <svg viewBox="0 0 100 100" className="size-28" role="img" aria-label={t.settings.cards.progress}>
              <circle cx="50" cy="50" r={RING_R} fill="none" strokeWidth="8" className="stroke-accent/40" />
              <circle
                cx="50"
                cy="50"
                r={RING_R}
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                className="stroke-primary transition-all"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - ratio)}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <p className="text-sm text-muted-foreground tabular-nums">
              {formatNumber(locale, progress.done) +
                " / " +
                formatNumber(locale, progress.total) +
                " · " +
                formatNumber(locale, Math.round(ratio * 100)) +
                "%"}
            </p>
          </>
        )}
      </div>
    </Card>
  );
}

function DeadlinesCard({
  items,
  moreCount,
  today,
  footer,
}: {
  items: Task[];
  moreCount: number;
  today: string;
  footer?: ReactNode;
}) {
  const { t, locale } = usePrefs();
  return (
    <Card
      title={t.settings.cards.deadlines}
      icon={<CalendarClock className="size-4" aria-hidden />}
      footer={footer}
    >
      {items.length === 0 ? (
        <EmptyBody title={t.dash.deadlinesEmpty} body={t.tasks.empty.upcoming.body} />
      ) : (
        <ul className="space-y-1.5">
          {items.map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{x.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatDate(locale, new Date((x.dueDate ?? today) + "T12:00:00Z"), {
                  dateStyle: "medium",
                })}
              </span>
            </li>
          ))}
          <MoreRow n={moreCount} label={t.dash.andMore.replace("{n}", formatNumber(locale, moreCount))} />
        </ul>
      )}
    </Card>
  );
}

function HabitsCard({
  items,
  onToggle,
  footer,
}: {
  items: HabitDue[];
  onToggle: (h: HabitDue) => void;
  footer?: ReactNode;
}) {
  const { t } = usePrefs();
  return (
    <Card
      title={t.settings.cards.habits}
      icon={<Sprout className="size-4" aria-hidden />}
      footer={footer}
    >
      {items.length === 0 ? (
        <EmptyBody title={t.habits.empty.today.title} body={t.habits.empty.today.body} />
      ) : (
        <ul className="space-y-1">
          {items.map((h) => (
            <li key={h.habit.id}>
              <button
                type="button"
                onClick={() => onToggle(h)}
                aria-pressed={h.done}
                aria-label={h.habit.name}
                className={"flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-start transition-colors hover:bg-accent/40 " + FOCUS_RING}
              >
                <span
                  className={
                    "min-w-0 truncate text-sm " +
                    (h.done ? "text-muted-foreground line-through" : "")
                  }
                >
                  {h.habit.name}
                </span>
                {h.done ? (
                  <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden />
                ) : (
                  <Circle className="size-5 shrink-0 text-muted-foreground/50" aria-hidden />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function FocusCard({ minutes, target, footer }: { minutes: number; target: number; footer?: ReactNode }) {
  const { t, locale } = usePrefs();
  const pct = target <= 0 ? 0 : Math.min(100, Math.round((minutes / target) * 100));
  return (
    <Card
      title={t.settings.cards.focus}
      icon={<Timer className="size-4" aria-hidden />}
      footer={footer}
    >
      <div className="flex h-full flex-col justify-center gap-2 py-2">
        <p className="font-display text-4xl font-semibold tabular-nums">
          {formatNumber(locale, minutes)}
          <span className="text-base font-normal text-muted-foreground">
            {" / " + formatNumber(locale, target) + " " + t.focus.minutes}
          </span>
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-accent/40">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: pct + "%" }} />
        </div>
      </div>
    </Card>
  );
}

/* ---------------- level (rewards readout) ---------------- */

function LevelCard() {
  const { t, locale } = usePrefs();
  const ledger = useStore((s) => s.xpLedger);
  const totals = totalsFromLedger(ledger);
  const todayXp = xpAwardedOnDay(ledger, todayLocal());
  const todayPct =
    DAILY_XP_CAP <= 0 ? 0 : Math.min(100, Math.round((todayXp / DAILY_XP_CAP) * 100));
  const pct =
    totals.xpForNextLevel <= 0
      ? 0
      : Math.min(100, Math.round((totals.xpIntoLevel / totals.xpForNextLevel) * 100));
  return (
    <Card title={t.settings.cards.level} icon={<Sparkles className="size-4" aria-hidden />}>
      <div className="flex h-full flex-col justify-center gap-2 py-2">
        <p className="font-display text-4xl font-semibold tabular-nums">
          {formatNumber(locale, totals.level)}
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-accent/40">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: pct + "%" }} />
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatNumber(locale, totals.xpIntoLevel) +
            " / " +
            formatNumber(locale, totals.xpForNextLevel) +
            " " +
            t.dash.xpUnit}
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-accent/40" aria-hidden>
          <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: todayPct + "%" }} />
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatNumber(locale, todayXp) +
            " / " +
            formatNumber(locale, DAILY_XP_CAP) +
            " " +
            t.rew.todayXp}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">

          <Coins className="size-3.5 text-primary" aria-hidden />
          {formatNumber(locale, totals.coins) + " " + t.dash.coins}
        </p>
      </div>
    </Card>
  );
}

/* ---------------- achievements (latest unlocks) ---------------- */

function AchievementsCard() {
  const { t, locale } = usePrefs();
  const unlocks = useStore((s) => s.achievements);
  const recent = latestUnlocks(unlocks, 3);
  return (
    <Card
      title={t.settings.cards.achievements}
      icon={<Trophy className="size-4" aria-hidden />}
      footer={
        <Link to="/rewards" className={LINK_FOOTER}>
          {t.dash.viewAll}
        </Link>
      }
    >
      {recent.length === 0 ? (
        <EmptyBody title={t.dash.achievementsEmptyTitle} body={t.dash.achievementsEmptyBody} />
      ) : (
        <ul className="space-y-1.5">
          {recent.map((u) => {
            const Icon = ACHIEVEMENT_ICONS[u.achievementId] ?? Trophy;
            const name =
              (t.ach as Record<string, { name: string }>)[u.achievementId]?.name ?? u.achievementId;
            return (
              <li key={u.id} className="flex items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(locale, new Date(u.unlockedAt), { dateStyle: "medium" })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ---------------- skeleton ---------------- */

function DashboardSkeleton() {
  return (
    <section aria-busy="true">
      <div className="mb-2 h-4 w-14 animate-pulse rounded bg-accent/30" />
      <div className="h-9 w-64 max-w-full animate-pulse rounded bg-accent/30" />
      <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-accent/30" />
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-accent/30" />
        ))}
      </div>
    </section>
  );
}
