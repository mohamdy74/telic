import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Coffee,
  Pause,
  Play,
  Timer,
  Volume2,
  VolumeX,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePrefs } from "@/components/app/preferences";
import { Modal } from "@/components/app/Modal";
import { OUTLINE_BTN, PRIMARY_BTN } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDate, formatNumber } from "@/lib/i18n";
import { focus as focusApi, todayLocal, useStore } from "@/lib/store";
import {
  actualMinutes,
  groupByDay,
  isActive,
  isOverdue,
  nextBreakMinutes,
  remainingMs,
  workCompletedToday,
  workMinutesToday,
} from "@/lib/focusTime";
import type { FocusSession } from "@/lib/types";

export const Route = createFileRoute("/focus")({
  head: () => ({
    meta: [
      { title: "Focus — Tilth" },
      {
        name: "description",
        content: "Deep focus sessions with a timer that survives reloads and background tabs.",
      },
      { property: "og:title", content: "Focus — Tilth" },
      {
        property: "og:description",
        content: "Deep focus sessions with a timer that survives reloads and background tabs.",
      },
    ],
  }),
  component: FocusPage,
});

function FocusPage() {
  const { t, locale } = usePrefs();
  const ready = useStore((s) => s.ready);
  const allSessions = useStore((s) => s.focusSessions);
  const allTasks = useStore((s) => s.tasks);
  const target = useStore((s) => s.settings.dailyFocusTargetMinutes);
  const active = useStore((s) => s.focusSessions.find((x) => isActive(x)));
  const [mode, setMode] = useState<"pomodoro" | "custom">("pomodoro");
  const [customWork, setCustomWork] = useState(25);
  const [customBreak, setCustomBreak] = useState(5);
  const [linkedTaskId, setLinkedTaskId] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [breakReady, setBreakReady] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [tick, setTick] = useState(0);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;


  // localStorage is a tiny UI pref (see AGENTS.md); read after mount to avoid hydration drift.
  useEffect(() => {
    try {
      if (window.localStorage.getItem("tilth.focus-sound") === "0") setSoundOn(false);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    try {
      window.localStorage.setItem("tilth.focus-sound", next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  // The interval only triggers re-render; time is always computed from timestamps.
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [active]);

  // Re-check on tab focus/visibility so a session that ended while away completes instantly.
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    document.addEventListener("visibilitychange", bump);
    window.addEventListener("focus", bump);
    return () => {
      document.removeEventListener("visibilitychange", bump);
      window.removeEventListener("focus", bump);
    };
  }, []);

  const showToast = (msg: string) => toast(msg);

  const startWork = () => {
    const minutes = mode === "pomodoro" ? 25 : customWork;
    focusApi.start(mode, minutes, linkedTaskId === "" ? undefined : linkedTaskId);
    setBreakReady(null);
  };

  const startBreakSession = () => {
    const short = mode === "pomodoro" ? 5 : customBreak;
    const minutes =
      breakReady ??
      nextBreakMinutes(workCompletedToday(useStore.getState().focusSessions, todayLocal()), short, 15);
    focusApi.start("break", minutes);
    setBreakReady(null);
  };

  const togglePause = () => {
    if (!active) return;
    if (active.pausedAt) focusApi.resume(active.id);
    else focusApi.pause(active.id);
  };

  const distraction = () => {
    if (active) focusApi.distraction(active.id);
  };

  const confirmCancel = () => {
    if (active) focusApi.end(active.id, false);
    setConfirming(false);
  };

  // Completed only when the session RAN to endsAt (overdue check on every tick).
  useEffect(() => {
    if (!active || active.pausedAt !== undefined || !isOverdue(active, Date.now())) return;
    const s = active;
    focusApi.end(s.id, true);
    if (soundRef.current) chime();
    if (s.mode !== "break") {
      const short = s.mode === "pomodoro" ? 5 : customBreak;
      const done = workCompletedToday(useStore.getState().focusSessions, todayLocal());
      setBreakReady(nextBreakMinutes(done, short, 15));
    }
    showToast(t.focus.toasts.completed);
  }, [active, tick, customBreak, t]);

  // Space = start/pause, Esc = cancel (with confirm). Never while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirming) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (active) togglePause();
        else if (ready) startWork();
      }
      if (e.key === "Escape" && active) setConfirming(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, confirming, ready, mode, customWork, linkedTaskId]);

  if (!ready) return <FocusSkeleton />;

  const today = todayLocal();
  const liveSessions = allSessions.filter((s) => !s.deletedAt);
  const doneMinutes = workMinutesToday(liveSessions, today);
  const openTasks = allTasks.filter((x) => !x.deletedAt && x.status !== "done");
  const taskTitles = new Map(allTasks.filter((x) => !x.deletedAt).map((x) => [x.id, x.title]));
  const pct = target <= 0 ? 0 : Math.min(100, Math.round((doneMinutes / target) * 100));

  return (
    <section>
      <p className="mb-2 text-sm font-medium text-primary">{t.nav.focus}</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{t.pages.focus.title}</h1>
      <p className="mt-2 text-muted-foreground">{t.pages.focus.body}</p>

      <div className="mt-6">
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{t.focus.todaysFocus}</span>
          <span className="tabular-nums">
            {formatNumber(locale, doneMinutes) + " / " + formatNumber(locale, target) + " " + t.focus.minutes}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-accent/40">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: pct + "%" }} />
        </div>
      </div>

      {active ? (
        <ActivePanel
          active={active}
          taskTitle={taskTitles.get(active.linkedTaskId ?? "")}
          onTogglePause={togglePause}
          onDistraction={distraction}
          onCancelRequest={() => setConfirming(true)}
        />
      ) : (
        <div className="panel mt-6 space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              options={[
                { value: "pomodoro", label: t.focus.mode.pomodoro },
                { value: "custom", label: t.focus.mode.custom },
              ]}
              value={mode}
              onChange={(v) => setMode(v === "custom" ? "custom" : "pomodoro")}
              label={t.nav.focus}
            />
            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={soundOn}
              className={OUTLINE_BTN + " px-3 py-1.5"}
            >
              {soundOn ? (
                <Volume2 className="size-4" aria-hidden />
              ) : (
                <VolumeX className="size-4" aria-hidden />
              )}
              {t.focus.sound}
            </button>
          </div>
          {mode === "pomodoro" ? (
            <p className="text-sm text-muted-foreground">{t.focus.pomodoroHint}</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">{t.focus.workMinutes}</span>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={customWork}
                  onChange={(e) => setCustomWork(clampNum(e.target.value, 1, 180))}
                  className="h-9 w-24 rounded-md border border-border bg-background px-3 text-sm tabular-nums outline-none"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">{t.focus.breakMinutes}</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={customBreak}
                  onChange={(e) => setCustomBreak(clampNum(e.target.value, 1, 60))}
                  className="h-9 w-24 rounded-md border border-border bg-background px-3 text-sm tabular-nums outline-none"
                />
              </label>
            </div>
          )}
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">{t.focus.linkedTask}</span>
            <select
              value={linkedTaskId}
              onChange={(e) => setLinkedTaskId(e.target.value)}
              className="h-9 w-full max-w-sm rounded-md border border-border bg-card px-2 text-sm text-foreground"
            >
              <option value="">{t.focus.none}</option>
              {openTasks.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
            </select>
          </label>
          {breakReady !== null ? (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={startBreakSession} className={PRIMARY_BTN}>
                <Coffee className="size-4" aria-hidden />
                {t.focus.startBreak}
                <span className="tabular-nums">
                  {"(" + formatNumber(locale, breakReady) + " " + t.focus.minutes + ")"}
                </span>
              </button>
              <span className="text-xs text-muted-foreground">{t.focus.toasts.breakReady}</span>
            </div>
          ) : (
            <button type="button" onClick={startWork} className={PRIMARY_BTN}>
              <Play className="size-4" aria-hidden />
              {t.focus.start}
            </button>
          )}
          <p className="text-xs text-muted-foreground">{t.focus.notifications}</p>
        </div>
      )}

      <HistorySection sessions={liveSessions} taskTitles={taskTitles} />

      {confirming && active && (
        <Modal title={t.focus.cancelTitle} onClose={() => setConfirming(false)}>
          <h2 className="font-display text-lg font-semibold">{t.focus.cancelTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t.focus.cancelBody}</p>
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={() => setConfirming(false)} className={OUTLINE_BTN}>
              {t.focus.keep}
            </button>
            <button type="button" onClick={confirmCancel} className={OUTLINE_BTN + " text-destructive"}>
              {t.focus.cancel}
            </button>
          </div>
        </Modal>
      )}

    </section>
  );
}

/* ---------------- active session ---------------- */

function ActivePanel({
  active,
  taskTitle,
  onTogglePause,
  onDistraction,
  onCancelRequest,
}: {
  active: FocusSession;
  taskTitle: string | undefined;
  onTogglePause: () => void;
  onDistraction: () => void;
  onCancelRequest: () => void;
}) {
  const { t, locale } = usePrefs();
  // Wall-clock math on every render — never interval counting.
  const remaining = remainingMs(active, Date.now());
  const total = active.plannedMinutes * 60_000;
  const elapsedPct = Math.min(100, Math.round(((total - remaining) / total) * 100));
  const paused = active.pausedAt !== undefined;
  return (
    <div className="panel mt-6 p-6 text-center">
      <p className="text-sm font-medium text-primary">
        {active.mode === "break" ? t.focus.break : t.focus.mode[active.mode]}
        {taskTitle !== undefined && <span className="text-muted-foreground">{" — " + taskTitle}</span>}
      </p>
      <p className="mt-4 font-display text-6xl font-semibold tabular-nums md:text-7xl">{clock(remaining)}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatNumber(locale, active.plannedMinutes) + " " + t.focus.minutes}
      </p>
      <div className="mx-auto mt-4 h-1.5 max-w-sm overflow-hidden rounded-full bg-accent/40">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: elapsedPct + "%" }} />
      </div>
      {paused && <p className="mt-3 text-sm text-muted-foreground">{t.focus.pause}</p>}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={onTogglePause} className={OUTLINE_BTN}>
          {paused ? (
            <Play className="size-4" aria-hidden />
          ) : (
            <Pause className="size-4" aria-hidden />
          )}
          {paused ? t.focus.resume : t.focus.pause}
        </button>
        <button type="button" onClick={onDistraction} className={OUTLINE_BTN}>
          <Zap className="size-4" aria-hidden />
          {t.focus.distract}
          {active.distractions.length > 0 && (
            <span className="tabular-nums">{"(" + formatNumber(locale, active.distractions.length) + ")"}</span>
          )}
        </button>
        <button type="button" onClick={onCancelRequest} className={OUTLINE_BTN + " text-destructive"}>
          {t.focus.cancel}
        </button>
      </div>
      <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <kbd className="rounded border border-border bg-accent/40 px-1.5 py-0.5 font-sans text-[10px]">Space</kbd>
        <kbd className="rounded border border-border bg-accent/40 px-1.5 py-0.5 font-sans text-[10px]">Esc</kbd>
      </p>
    </div>
  );
}

/* ---------------- history ---------------- */

function HistorySection({
  sessions,
  taskTitles,
}: {
  sessions: FocusSession[];
  taskTitles: Map<string, string>;
}) {
  const { t, locale } = usePrefs();
  const groups = groupByDay(sessions);
  const days = [...groups.keys()].sort((a, b) => b.localeCompare(a));
  if (days.length === 0) return <FocusEmpty />;
  return (
    <div className="mt-8">
      <h2 className="text-sm font-semibold text-muted-foreground">{t.focus.history}</h2>
      {days.map((day) => (
        <div key={day} className="mt-3">
          <p className="text-xs font-medium text-muted-foreground">
            {formatDate(locale, new Date(day + "T12:00:00Z"), { dateStyle: "full" })}
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {[...(groups.get(day) ?? [])]
              .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
              .map((s) => {
                const actual = actualMinutes(s);
                const linked = taskTitles.get(s.linkedTaskId ?? "");
                return (
                  <li key={s.id} className="panel flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                    {s.completed ? (
                      <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden />
                    ) : (
                      <XCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                    <span className="font-medium">
                      {s.mode === "break" ? t.focus.break : t.focus.mode[s.mode]}
                    </span>
                    {linked !== undefined && <span className="truncate text-xs text-muted-foreground">{linked}</span>}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDate(locale, new Date(s.startedAt), { timeStyle: "short" })}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatNumber(locale, s.plannedMinutes) +
                        " " +
                        t.focus.planned +
                        " / " +
                        (actual === null ? "—" : formatNumber(locale, actual)) +
                        " " +
                        t.focus.actual}
                    </span>
                    {s.distractions.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Zap className="size-3" aria-hidden />
                        {formatNumber(locale, s.distractions.length)}
                      </span>
                    )}
                    {!s.completed && <span className="text-xs text-destructive">{t.focus.incomplete}</span>}
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ---------------- skeleton / empty / shared ---------------- */

function FocusSkeleton() {
  return (
    <section aria-busy="true">
      <div className="mb-2 h-4 w-16 animate-pulse rounded bg-accent/30" />
      <div className="h-9 w-56 animate-pulse rounded bg-accent/30" />
      <div className="mt-6 h-2 w-full animate-pulse rounded-full bg-accent/30" />
      <div className="mt-4 h-56 animate-pulse rounded-xl bg-accent/30" />
      <div className="mt-6 space-y-2">
        <div className="h-10 animate-pulse rounded-lg bg-accent/30" />
        <div className="h-10 animate-pulse rounded-lg bg-accent/30" />
      </div>
    </section>
  );
}

function FocusEmpty() {
  const { t } = usePrefs();
  return (
    <div className="empty-card mt-4">
      <span className="grid size-12 place-items-center rounded-full bg-accent/40 text-primary">
        <Timer className="size-6" aria-hidden />
      </span>
      <p className="font-display text-lg font-semibold">{t.focus.empty.title}</p>
      <p className="text-sm text-muted-foreground">{t.focus.empty.body}</p>
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div className="segmented m-0" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className="segment"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- pure helpers ---------------- */

function clock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ":" + (s < 10 ? "0" + s : s);
}

function clampNum(v: string, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Best-effort WebAudio chime + vibration; never throws. */
function chime() {
  try {
    const ctx = new AudioContext();
    void ctx.resume();
    const ding = (freq: number, at: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.25, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.65);
      osc.start(at);
      osc.stop(at + 0.7);
    };
    const t0 = ctx.currentTime + 0.05;
    ding(784, t0);
    ding(988, t0 + 0.35);
  } catch {
    /* audio is best-effort */
  }
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([160, 90, 160]);
  } catch {
    /* ignore */
  }
}
