import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Sprout, Timer } from "lucide-react";
import { useState } from "react";
import { usePrefs } from "@/components/app/preferences";
import { OUTLINE_BTN } from "@/components/ui/button";
import { addDays, weekdayOf } from "@/lib/dates";
import { formatDate, formatNumber, type Locale } from "@/lib/i18n";
import { todayLocal, useStore } from "@/lib/store";
import { buildWeek, type WeekCell } from "@/lib/weekView";
import type { LocalDay, Priority } from "@/lib/types";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Tilth" },
      {
        name: "description",
        content: "Your week at a glance — tasks, habits and focus, day by day.",
      },
      { property: "og:title", content: "Calendar — Tilth" },
      {
        property: "og:description",
        content: "Your week at a glance — tasks, habits and focus, day by day.",
      },
    ],
  }),
  component: CalendarPage,
});

const CELL_BTN =
  "flex min-h-24 flex-col items-center gap-0.5 rounded-lg border p-1.5 text-center transition-colors hover:bg-accent/40";

const PRIORITY_DOT: Record<Priority, string> = {
  high: "bg-destructive",
  medium: "bg-primary",
  low: "bg-muted-foreground/50",
};

function CalendarPage() {
  const { t, locale } = usePrefs();
  const ready = useStore((s) => s.ready);
  const allTasks = useStore((s) => s.tasks);
  const allHabits = useStore((s) => s.habits);
  const allLogs = useStore((s) => s.habitLogs);
  const allSessions = useStore((s) => s.focusSessions);
  const weekStartsOn = useStore((s) => s.settings.weekStartsOn);
  const [anchor, setAnchor] = useState<LocalDay | null>(null);
  const [selected, setSelected] = useState<LocalDay | null>(null);

  if (!ready) return <CalendarSkeleton />;

  const today = todayLocal();
  const current = anchor ?? today;
  const cells = buildWeek({
    tasks: allTasks.filter((x) => !x.deletedAt),
    habits: allHabits.filter((x) => !x.deletedAt),
    logs: allLogs.filter((x) => !x.deletedAt),
    sessions: allSessions.filter((x) => !x.deletedAt),
    anchor: current,
    today,
    weekStartsOn,
  });

  const weekHasAnything = cells.some(
    (c) =>
      c.openTasks.length > 0 ||
      c.doneTasks.length > 0 ||
      c.habitsScheduled > 0 ||
      c.focusMinutes > 0,
  );
  const detail = cells.find((c) => c.day === selected) ?? null;

  return (
    <section>
      <p className="mb-2 text-sm font-medium text-primary">{t.nav.calendar}</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
        {t.pages.calendar.title}
      </h1>
      <p className="mt-2 text-muted-foreground">{t.pages.calendar.body}</p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setAnchor(addDays(current, -7))}
            aria-label={t.cal.prevWeek}
            className={OUTLINE_BTN + " px-2"}
          >
            <ChevronLeft className="size-4 rtl-flip" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setAnchor(addDays(current, 7))}
            aria-label={t.cal.nextWeek}
            className={OUTLINE_BTN + " px-2"}
          >
            <ChevronRight className="size-4 rtl-flip" aria-hidden />
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setAnchor(null);
            setSelected(null);
          }}
          disabled={anchor === null}
          className={OUTLINE_BTN}
        >
          {t.cal.today}
        </button>
      </div>

      {!weekHasAnything && <p className="mt-6 text-sm text-muted-foreground">{t.cal.empty}</p>}

      <div className="mt-4 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
        {cells.map((c) => {
          const active = selected === c.day;
          return (
            <button
              key={c.day}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(active ? null : c.day)}
              className={
                CELL_BTN +
                " " +
                (active
                  ? "border-primary bg-accent/40"
                  : c.isToday
                    ? "border-primary/60"
                    : "border-border")
              }
            >
              <span className="text-[10px] font-medium text-muted-foreground">
                {weekdayShort(locale, weekdayOf(c.day))}
              </span>
              <span
                className={
                  "text-sm font-semibold tabular-nums " + (c.isToday ? "text-primary" : "")
                }
              >
                {dayNumber(locale, c.day)}
              </span>
              <span className="flex flex-col items-center gap-0.5 text-[10px] leading-tight text-muted-foreground">
                {c.openTasks.length > 0 && (
                  <span className="tabular-nums">
                    {t.cal.tasksCount.replace("{n}", formatNumber(locale, c.openTasks.length))}
                  </span>
                )}
                {c.habitsScheduled > 0 && (
                  <span className="tabular-nums">
                    {t.cal.habitsCount
                      .replace("{n}", formatNumber(locale, c.habitsDone))
                      .replace("{m}", formatNumber(locale, c.habitsScheduled))}
                  </span>
                )}
                {c.focusMinutes > 0 && (
                  <span className="tabular-nums">
                    {t.cal.focusCount.replace("{n}", formatNumber(locale, c.focusMinutes))}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {detail && <DayDetail cell={detail} locale={locale} />}
    </section>
  );
}

/* ---------------- day detail ---------------- */

function DayDetail({ cell, locale }: { cell: WeekCell; locale: Locale }) {
  const { t } = usePrefs();
  const empty =
    cell.openTasks.length === 0 &&
    cell.doneTasks.length === 0 &&
    cell.habitsScheduled === 0 &&
    cell.focusMinutes === 0;
  return (
    <div className="panel mt-4 p-4">
      <h2 className="font-display text-lg font-semibold">
        {formatDate(locale, new Date(cell.day + "T12:00:00Z"), { dateStyle: "full" })}
      </h2>
      {empty ? (
        <p className="mt-2 text-sm text-muted-foreground">{t.cal.none}</p>
      ) : (
        <div className="mt-3 space-y-3 text-sm">
          {(cell.openTasks.length > 0 || cell.doneTasks.length > 0) && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t.cal.dayTasks}
              </h3>
              <ul className="mt-1.5 space-y-1">
                {cell.openTasks.map((x) => (
                  <li key={x.id} className="flex items-center gap-2">
                    <span
                      className={"size-2 shrink-0 rounded-full " + PRIORITY_DOT[x.priority]}
                      aria-hidden
                    />
                    <span className="min-w-0 truncate">{x.title}</span>
                  </li>
                ))}
                {cell.doneTasks.length > 0 && (
                  <li className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t.cal.dayDone}
                  </li>
                )}
                {cell.doneTasks.map((x) => (
                  <li key={x.id} className="flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full bg-primary/50" aria-hidden />
                    <span className="min-w-0 truncate text-muted-foreground line-through">
                      {x.title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {cell.habitsScheduled > 0 && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Sprout className="size-4 text-primary" aria-hidden />
              {t.cal.dayHabits +
                ": " +
                t.cal.habitsCount
                  .replace("{n}", formatNumber(locale, cell.habitsDone))
                  .replace("{m}", formatNumber(locale, cell.habitsScheduled))}
            </p>
          )}
          {cell.focusMinutes > 0 && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Timer className="size-4 text-primary" aria-hidden />
              {t.cal.dayFocus +
                ": " +
                t.cal.focusCount.replace("{n}", formatNumber(locale, cell.focusMinutes))}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- skeleton ---------------- */

function CalendarSkeleton() {
  return (
    <section aria-busy="true">
      <div className="mb-2 h-4 w-16 animate-pulse rounded bg-accent/30" />
      <div className="h-9 w-56 animate-pulse rounded bg-accent/30" />
      <div className="mt-6 h-8 w-72 animate-pulse rounded bg-accent/30" />
      <div className="mt-4 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-accent/30" />
        ))}
      </div>
    </section>
  );
}

/* ---------------- pure helpers ---------------- */

function dayNumber(locale: Locale, day: LocalDay): string {
  return formatNumber(locale, new Date(day + "T12:00:00Z").getUTCDate());
}

function weekdayShort(locale: Locale, d: number): string {
  // 2023-01-01 was a Sunday, so the 1st + d lands on that weekday.
  const day = new Date(Date.UTC(2023, 0, 1 + d));
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    weekday: "short",
    timeZone: "UTC",
  }).format(day);
}
