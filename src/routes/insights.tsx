import { createFileRoute } from "@tanstack/react-router";
import { Clock, SkipForward, Timer, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePrefs } from "@/components/app/preferences";
import { currentTimeZone } from "@/lib/dates";
import { formatDate, formatNumber } from "@/lib/i18n";
import {
  focusMinutesByDay,
  habitConsistencyByDay,
  insightsReport,
  taskCompletionsByDay,
  type DayPoint,
  type InsightsReport,
  type Observation,
} from "@/lib/insights";
import { todayLocal, useStore } from "@/lib/store";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Insights — Tilth" },
      { name: "description", content: "Clear weekly and monthly trends across tasks, habits and focus." },
      { property: "og:title", content: "Insights — Tilth" },
      { property: "og:description", content: "Clear weekly and monthly trends across tasks, habits and focus." },
    ],
  }),
  component: InsightsPage,
});

const RANGE_ACTIVE =
  "rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors";
const RANGE_IDLE =
  "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/40";

interface ChartDatum {
  tick: string;
  day: string;
  value: number | null;
}

/** {placeholder} substitution for the i18n templates. */
function fill(tpl: string, params: Record<string, string>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(params)) out = out.split("{" + k + "}").join(v);
  return out;
}

function InsightsPage() {
  const { t, locale } = usePrefs();
  const ready = useStore((s) => s.ready);
  const tasks = useStore((s) => s.tasks);
  const habits = useStore((s) => s.habits);
  const habitLogs = useStore((s) => s.habitLogs);
  const focusSessions = useStore((s) => s.focusSessions);
  const xpLedger = useStore((s) => s.xpLedger);
  const dayStartHour = useStore((s) => s.settings.dayStartHour);
  const targetMinutes = useStore((s) => s.settings.dailyFocusTargetMinutes);
  const [range, setRange] = useState<"weekly" | "monthly">("weekly");

  if (!ready) return <InsightsSkeleton />;

  const rtl = locale === "ar";
  const today = todayLocal();
  const tz = currentTimeZone();
  const days = range === "weekly" ? 7 : 30;
  const report = insightsReport({
    tasks,
    habits,
    habitLogs,
    focusSessions,
    xpLedger,
    today,
    timeZone: tz,
    dayStartHour,
  });

  const taskSeries = taskCompletionsByDay(tasks, { today, days, dayStartHour, timeZone: tz });
  const habitSeries = habitConsistencyByDay(habits, habitLogs, { today, days });
  const focusSeries = focusMinutesByDay(focusSessions, { today, days });

  const totalOf = (s: DayPoint[]) => s.reduce((sum, p) => sum + (p.value ?? 0), 0);
  const taskTotal = totalOf(taskSeries);
  const focusTotal = totalOf(focusSeries);
  const habitValues = habitSeries
    .filter((p) => p.value !== null)
    .map((p) => p.value as number);
  const habitAvg = habitValues.length
    ? Math.round(habitValues.reduce((a, b) => a + b, 0) / habitValues.length)
    : 0;

  const dataOf = (series: DayPoint[]): ChartDatum[] =>
    series.map((p) => ({
      tick:
        range === "weekly"
          ? formatDate(locale, new Date(p.day + "T12:00:00Z"), { weekday: "short" })
          : formatDate(locale, new Date(p.day + "T12:00:00Z"), { day: "numeric" }),
      day: p.day,
      value: p.value,
    }));

  const tooltipStyle = {
    backgroundColor: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: "0.5rem",
    fontSize: "0.75rem",
    color: "var(--color-foreground)",
  };
  const dayOfPayload = (payload: unknown): string => {
    const rows = payload as { payload?: { day?: string } }[] | undefined;
    return rows?.[0]?.payload?.day ?? "";
  };
  const labelFormatter = (_label: unknown, payload: unknown) => {
    const day = dayOfPayload(payload);
    return day ? formatDate(locale, new Date(day + "T12:00:00Z"), { dateStyle: "medium" }) : "";
  };
  const valueFormatter = (unit: string) => (value: unknown) =>
    formatNumber(locale, Number(value)) + " " + unit;
  const axisTick = { fill: "var(--color-muted-foreground)", fontSize: 11 };
  const gridProps = {
    stroke: "var(--color-border)",
    strokeOpacity: 0.6,
    strokeDasharray: "3 3",
    vertical: false,
  };

  return (
    <section>
      <p className="mb-2 text-sm font-medium text-primary">{t.nav.insights}</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
        {t.pages.insights.title}
      </h1>
      <p className="mt-2 text-muted-foreground">{t.pages.insights.body}</p>

      {!report.hasAnyData ? (
        <EmptyInsights />
      ) : (
        <>
          <div className="mt-6 flex w-fit gap-1 rounded-lg border border-border p-1">
            {(["weekly", "monthly"] as const).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={range === r}
                onClick={() => setRange(r)}
                className={range === r ? RANGE_ACTIVE : RANGE_IDLE}
              >
                {r === "weekly" ? t.ins.weekly : t.ins.monthly}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartShell
              title={t.ins.charts.tasksTitle}
              summary={fill(t.ins.charts.tasksSummary, {
                total: formatNumber(locale, taskTotal),
              })}
              empty={taskTotal === 0}
              emptyMsg={t.ins.charts.emptyRange}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataOf(taskSeries)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis
                    dataKey="tick"
                    reversed={rtl}
                    tickLine={false}
                    interval={days > 7 ? 3 : 0}
                    axisLine={{ stroke: "var(--color-border)" }}
                    tick={axisTick}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={32}
                    orientation={rtl ? "right" : "left"}
                    tickLine={false}
                    axisLine={false}
                    tick={axisTick}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-accent)", opacity: 0.2 }}
                    contentStyle={tooltipStyle}
                    labelFormatter={labelFormatter}
                    formatter={valueFormatter(t.ins.charts.tasksUnit)}
                  />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartShell>

            <ChartShell
              title={t.ins.charts.habitTitle}
              summary={fill(t.ins.charts.habitSummary, {
                avg: formatNumber(locale, habitAvg),
              })}
              empty={habitValues.length === 0}
              emptyMsg={t.ins.charts.emptyRange}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dataOf(habitSeries)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis
                    dataKey="tick"
                    reversed={rtl}
                    tickLine={false}
                    interval={days > 7 ? 3 : 0}
                    axisLine={{ stroke: "var(--color-border)" }}
                    tick={axisTick}
                  />
                  <YAxis
                    domain={[0, 100]}
                    allowDecimals={false}
                    width={32}
                    orientation={rtl ? "right" : "left"}
                    tickLine={false}
                    axisLine={false}
                    tick={axisTick}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={labelFormatter}
                    formatter={valueFormatter(t.ins.charts.habitUnit)}
                  />
                  <Line
                    dataKey="value"
                    type="monotone"
                    connectNulls
                    dot={false}
                    strokeWidth={2}
                    stroke="var(--color-primary)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartShell>

            <ChartShell
              title={t.ins.charts.focusTitle}
              summary={fill(t.ins.charts.focusSummary, {
                total: formatNumber(locale, focusTotal),
                target: formatNumber(locale, targetMinutes),
              })}
              empty={focusTotal === 0}
              emptyMsg={t.ins.charts.emptyRange}
              wide
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataOf(focusSeries)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis
                    dataKey="tick"
                    reversed={rtl}
                    tickLine={false}
                    interval={days > 7 ? 3 : 0}
                    axisLine={{ stroke: "var(--color-border)" }}
                    tick={axisTick}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={32}
                    orientation={rtl ? "right" : "left"}
                    tickLine={false}
                    axisLine={false}
                    tick={axisTick}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-accent)", opacity: 0.2 }}
                    contentStyle={tooltipStyle}
                    labelFormatter={labelFormatter}
                    formatter={valueFormatter(t.ins.charts.focusUnit)}
                  />
                  <ReferenceLine
                    y={targetMinutes}
                    stroke="var(--color-muted-foreground)"
                    strokeDasharray="4 4"
                    label={{
                      value: fill(t.ins.charts.targetLabel, {
                        n: formatNumber(locale, targetMinutes),
                      }),
                      position: rtl ? "insideTopLeft" : "insideTopRight",
                      fontSize: 10,
                      fill: "var(--color-muted-foreground)",
                    }}
                  />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartShell>
          </div>
        </>
      )}

      <ObservationsPanel report={report} />
    </section>
  );
}

function ChartShell({
  title,
  summary,
  empty,
  emptyMsg,
  wide,
  children,
}: {
  title: string;
  summary: string;
  empty: boolean;
  emptyMsg: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={"panel" + (wide ? " xl:col-span-2" : "")}>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{summary}</p>
      {empty ? (
        <p className="mt-12 text-center text-sm text-muted-foreground">{emptyMsg}</p>
      ) : (
        <div className="mt-3 h-56" role="img" aria-label={title + " — " + summary}>
          {children}
        </div>
      )}
    </div>
  );
}

function EmptyInsights() {
  const { t } = usePrefs();
  return (
    <div className="panel mt-6 p-8 text-center">
      <p className="text-sm font-semibold">{t.ins.empty.title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{t.ins.empty.body}</p>
      {import.meta.env.DEV ? (
        <p className="mx-auto mt-2 max-w-sm text-xs text-muted-foreground">{t.ins.empty.seed}</p>
      ) : null}
    </div>
  );
}

function ObservationsPanel({ report }: { report: InsightsReport }) {
  const { t } = usePrefs();
  return (
    <div className="panel mt-4 p-4">
      <h2 className="text-sm font-semibold">{t.ins.obs.title}</h2>
      {report.observations.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t.ins.obs.insufficient}</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {report.observations.map((o) => (
            <ObservationCard key={o.id} obs={o} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ObservationCard({ obs }: { obs: Observation }) {
  const { t, locale } = usePrefs();
  const nums = {
    events: formatNumber(locale, obs.events),
    activeDays: formatNumber(locale, obs.activeDays),
  };
  let title = "";
  let basis = "";
  let Icon: LucideIcon = Clock;
  if (obs.id === "taskTimeOfDay") {
    const bucketMsg =
      obs.params["bucket"] === "morning"
        ? t.ins.obs.morning
        : obs.params["bucket"] === "afternoon"
          ? t.ins.obs.afternoon
          : t.ins.obs.evening;
    title = fill(bucketMsg, { pct: formatNumber(locale, Number(obs.params["pct"])) });
    basis = fill(t.ins.obs.basisTasks, nums);
  } else if (obs.id === "focusWeekday") {
    const weekdayName = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
      weekday: "long",
    }).format(new Date(Date.UTC(2023, 0, 1 + Number(obs.params["weekday"]))));
    title = fill(t.ins.obs.focusDay, { weekday: weekdayName });
    basis = fill(t.ins.obs.basisFocus, nums);
    Icon = Timer;
  } else {
    title = fill(t.ins.obs.skippedHabit, { habit: obs.params["habit"] ?? "" });
    basis = fill(t.ins.obs.basisSkips, nums);
    Icon = SkipForward;
  }
  return (
    <li className="flex items-start gap-3 rounded-lg border border-border p-3">
      <span className="mt-0.5 text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <div>
        <p className="text-sm">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{basis}</p>
      </div>
    </li>
  );
}

function InsightsSkeleton() {
  return (
    <section aria-busy="true">
      <div className="mb-2 h-4 w-14 animate-pulse rounded bg-accent/30" />
      <div className="h-9 w-64 max-w-full animate-pulse rounded bg-accent/30" />
      <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-accent/30" />
      <div className="mt-6 h-10 w-52 animate-pulse rounded bg-accent/30" />
      <div className="mt-4 h-64 animate-pulse rounded-xl bg-accent/30" />
      <div className="mt-4 h-64 animate-pulse rounded-xl bg-accent/30" />
    </section>
  );
}
