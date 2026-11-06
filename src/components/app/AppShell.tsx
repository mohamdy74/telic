import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ChevronRight,
  Ellipsis,
  FileText,
  Languages,
  Plus,
  Repeat,
  Search,
  StickyNote,
  SunMoon,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NAV, type NavKey } from "./nav";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePrefs } from "./preferences";
import { useStore } from "@/lib/store";
import { totalsFromLedger } from "@/lib/rewards";
import { resolveAccent } from "@/lib/themes";
import { isActive } from "@/lib/focusTime";
import { applyUpdate, registerPwa } from "@/lib/pwa";
import { toLocalDay } from "@/lib/dates";
import { eveningDigest, morningDigest } from "@/lib/digest";

type Cmd = { key: string; label: string; icon: LucideIcon; run: () => void };

// TIL-F06: the desktop sidebar groups nine peer destinations into four labeled
// sections; Settings is pinned at the bottom. TIL-F01: the mobile bar shows the
// four daily-action surfaces plus a "More" sheet holding the rest — so Rewards
// and every other route stays reachable on phones.
const NAV_GROUPS: { label: "plan" | "do" | "keep" | "grow"; keys: NavKey[] }[] = [
  { label: "plan", keys: ["dashboard", "calendar"] },
  { label: "do", keys: ["tasks", "habits", "focus"] },
  { label: "keep", keys: ["notes"] },
  { label: "grow", keys: ["rewards", "insights"] },
];
const MOBILE_PRIMARY: NavKey[] = ["dashboard", "tasks", "focus", "habits"];
const MOBILE_MORE: NavKey[] = ["calendar", "notes", "rewards", "insights", "settings"];
const navOf = (key: NavKey) => NAV.find((n) => n.key === key)!;

export function AppShell({ children }: { children: ReactNode }) {
  const { t, setAccent } = usePrefs();
  const [open, setOpen] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const activeSession = useStore((s) => s.focusSessions.find((x) => isActive(x)));
  const unlocks = useStore((s) => s.achievements);
  const ready = useStore((s) => s.ready);
  const settings = useStore((s) => s.settings);
  const settingsAccent = useStore((s) => s.settings.accent);
  const xpLedger = useStore((s) => s.xpLedger);
  const tasks = useStore((s) => s.tasks);
  const habits = useStore((s) => s.habits);
  const logs = useStore((s) => s.habitLogs);
  const sessions = useStore((s) => s.focusSessions);
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const moreActive = MOBILE_MORE.some((k) => pathname === navOf(k).to);
  const settingsItem = navOf("settings");
  const seenUnlocks = useRef<Set<string> | null>(null);

  // Sync the persisted accent (app data) into the live UI accent, resolving
  // unlock rules — also repairs legacy or re-locked values. Color-only, so
  // there is no layout shift on load or on change.
  useEffect(() => {
    if (!ready) return;
    setAccent(
      resolveAccent(settingsAccent, {
        level: totalsFromLedger(xpLedger).level,
        unlockedAchievements: unlocks.filter((u) => !u.deletedAt).map((u) => u.achievementId),
      }),
    );
  }, [ready, settingsAccent, xpLedger, unlocks, setAccent]);

  // Achievement unlock toast: the first run records existing unlocks
  // silently; only fresh unlocks afterwards toast, one at a time.
  useEffect(() => {
    const current = unlocks.filter((u) => !u.deletedAt);
    if (seenUnlocks.current === null) {
      seenUnlocks.current = new Set(current.map((u) => u.id));
      return;
    }
    const fresh = current.filter((u) => !seenUnlocks.current!.has(u.id));
    for (const u of fresh) seenUnlocks.current.add(u.id);
    const newest = fresh[fresh.length - 1];
    if (newest) {
      const name =
        (t.ach as Record<string, { name: string }>)[newest.achievementId]?.name ??
        newest.achievementId;
      toast(t.achUnlocked.replace("{name}", name), {
        icon: <Trophy className="size-4 text-primary" aria-hidden />,
      });
    }
  }, [unlocks, t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // PWA: register the service worker (published app only) and surface waiting updates.
  useEffect(() => {
    return registerPwa(() => setNeedRefresh(true));
  }, []);

  // Quiet daily digest: at most one morning and one evening summary per day,
  // only if the user turned it on, and only while the app is open — Tilth is
  // local-first, there is no push server to deliver anything else.
  useEffect(() => {
    if (!ready) return;
    const digest = settings.digest;
    if (!digest?.enabled) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const slotAt = (s: string) => {
      const [h = 0, m = 0] = s.split(":").map(Number);
      return h * 60 + m;
    };
    const fire = () => {
      const now = new Date();
      const today = toLocalDay(now, settings.dayStartHour, tz);
      const hour = now.getHours();
      const minutes = hour * 60 + now.getMinutes();
      const state = {
        tasks,
        habits,
        logs,
        sessions,
        today,
        hour,
        dayStartHour: settings.dayStartHour,
        timeZone: tz,
      };
      let slot: "morning" | "evening";
      let title: string;
      let body: string;
      if (hour < 17) {
        if (minutes < slotAt(digest.morningAt)) return;
        const d = morningDigest(state);
        slot = "morning";
        title = t.notif.morningTitle;
        const parts = [t.dig.tasksDue.replace("{n}", String(d.tasksDue))];
        if (d.overdue > 0) parts.push(t.dig.overdue.replace("{n}", String(d.overdue)));
        parts.push(t.dig.habitsDue.replace("{n}", String(d.habitsDue)));
        body =
          d.tasksDue === 0 && d.overdue === 0 && d.habitsDue === 0
            ? t.dig.quietDay
            : parts.join(" · ");
      } else {
        if (minutes < slotAt(digest.eveningAt)) return;
        const e = eveningDigest(state);
        slot = "evening";
        title = t.notif.eveningTitle;
        const parts = [
          t.dig.completedToday.replace("{n}", String(e.completedToday)),
          t.dig.focusToday.replace("{n}", String(e.focusMinutes)),
        ];
        if (e.stillOpen > 0) parts.push(t.dig.stillOpen.replace("{n}", String(e.stillOpen)));
        if (e.tomorrowOpen > 0) parts.push(t.dig.tomorrow.replace("{n}", String(e.tomorrowOpen)));
        body =
          e.completedToday === 0 && e.stillOpen === 0 && e.tomorrowOpen === 0
            ? t.dig.quietDay
            : parts.join(" · ");
      }
      try {
        const seen: Record<string, string> = JSON.parse(
          window.localStorage.getItem("tilth.digest") || "{}",
        );
        if (seen[slot] === today) return;
        new Notification(title, { body, tag: "tilth-digest-" + slot, icon: "/icons/icon-192.png" });
        seen[slot] = today;
        window.localStorage.setItem("tilth.digest", JSON.stringify(seen));
      } catch {
        /* ignore */
      }
    };
    fire();
    const id = window.setInterval(fire, 60_000);
    return () => window.clearInterval(id);
  }, [ready, settings, tasks, habits, logs, sessions, t]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#main" className="skip-link">
        {t.skip}
      </a>
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-60 flex-col border-e border-border bg-sidebar px-3 py-5 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Target className="size-4" aria-hidden />
          </span>
          <span className="font-display text-lg font-semibold">{t.appName}</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 text-start text-sm text-muted-foreground transition-colors hover:bg-accent/40"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 truncate">{t.command.open}</span>
          <kbd className="rounded border border-border px-1.5 text-[10px]">⌘K</kbd>
        </button>
        <nav aria-label="Main" className="flex flex-col gap-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                {t.navGroups[group.label]}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.keys.map((key) => {
                  const { to, icon: Icon } = navOf(key);
                  return (
                    <Link
                      key={key}
                      to={to}
                      activeOptions={{ exact: to === "/" }}
                      className="nav-link"
                      activeProps={{ "aria-current": "page", className: "nav-link-active" }}
                    >
                      <Icon className="size-4" aria-hidden />
                      {t.nav[key]}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-auto pt-5">
          <Link
            to={settingsItem.to}
            className="nav-link"
            activeProps={{ "aria-current": "page", className: "nav-link-active" }}
          >
            <settingsItem.icon className="size-4" aria-hidden />
            {t.nav.settings}
          </Link>
          <p className="mt-3 border-t border-border/60 px-2 pt-3 text-xs text-muted-foreground">
            {t.tagline}
          </p>
        </div>
      </aside>

      <main id="main" className="pb-24 md:ps-60 md:pb-0">
        <div className="mx-auto max-w-5xl px-5 py-8 md:px-10 md:py-12 animate-rise">{children}</div>
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="grid grid-cols-5">
          {MOBILE_PRIMARY.map((key) => {
            const { to, icon: Icon } = navOf(key);
            return (
              <Link
                key={key}
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="tab-link"
                activeProps={{ "aria-current": "page", className: "tab-link-active" }}
              >
                <Icon className="size-5" aria-hidden />
                <span className="w-full truncate text-center">{t.nav[key]}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={cn("tab-link", (moreOpen || moreActive) && "tab-link-active")}
          >
            <Ellipsis className="size-5" aria-hidden />
            <span className="w-full truncate text-center">{t.nav.more}</span>
          </button>
        </div>
      </nav>

      {needRefresh && (
        <div
          className="fixed inset-x-0 bottom-16 z-40 flex justify-center px-4 md:bottom-6"
          role="status"
        >
          <div className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 shadow-elevated">
            <span className="text-sm">{t.pwa.updateAvailable}</span>
            <span className="flex items-center gap-2">
              <button
                type="button"
                disabled={!!activeSession}
                onClick={() => {
                  void applyUpdate();
                  setNeedRefresh(false);
                }}
                className="rounded-md bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
              >
                {t.pwa.reload}
              </button>
              <button
                type="button"
                onClick={() => setNeedRefresh(false)}
                className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent/40"
              >
                {t.pwa.dismiss}
              </button>
            </span>
          </div>
        </div>
      )}

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl border-border bg-sidebar pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:hidden"
        >
          <SheetHeader className="px-2 pb-3 text-start">
            <SheetTitle className="text-sm font-semibold text-muted-foreground">
              {t.nav.more}
            </SheetTitle>
          </SheetHeader>
          <nav aria-label={t.nav.more} className="flex flex-col gap-0.5">
            {MOBILE_MORE.map((key) => {
              const { to, icon: Icon } = navOf(key);
              return (
                <Link
                  key={key}
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  activeOptions={{ exact: to === "/" }}
                  className="nav-link py-3"
                  activeProps={{ "aria-current": "page", className: "nav-link-active" }}
                >
                  <Icon className="size-4" aria-hidden />
                  {t.nav[key]}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>

      {/* One toast host — identical pill and 5s lifetime from every route (TIL-F04). */}
      <Toaster
        position="bottom-center"
        duration={5000}
        mobileOffset={{ bottom: "calc(76px + env(safe-area-inset-bottom))" }}
        offset={{ bottom: 24 }}
      />

      {open && <CommandPalette onClose={() => setOpen(false)} />}
    </div>
  );
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const { t, locale, setLocale, theme, setTheme } = usePrefs();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevFocus = useRef<Element | null>(null);

  const items = useMemo<Cmd[]>(() => {
    const nq = q.trim().toLowerCase();
    const cmds: Cmd[] = [
      {
        key: "newTask",
        label: t.command.newTask,
        icon: Plus,
        run: () => {
          try {
            window.sessionStorage.setItem("tilth.new-task", "1");
          } catch {
            /* ignore */
          }
          onClose();
          navigate({ to: "/tasks" });
        },
      },
      {
        key: "newNote",
        label: t.command.newNote,
        icon: StickyNote,
        run: () => {
          try {
            window.sessionStorage.setItem("tilth.new-note", "1");
          } catch {
            /* ignore */
          }
          onClose();
          navigate({ to: "/notes" });
        },
      },
      {
        key: "newHabit",
        label: t.command.newHabit,
        icon: Repeat,
        run: () => {
          try {
            window.sessionStorage.setItem("tilth.new-habit", "1");
          } catch {
            /* ignore */
          }
          onClose();
          navigate({ to: "/habits" });
        },
      },
      {
        key: "newFromTemplate",
        label: t.command.newFromTemplate,
        icon: FileText,
        run: () => {
          try {
            window.sessionStorage.setItem("tilth.new-note", "1");
          } catch {
            /* ignore */
          }
          onClose();
          navigate({ to: "/notes" });
        },
      },
      {
        key: "toggleLanguage",
        label: t.command.toggleLanguage,
        icon: Languages,
        run: () => {
          setLocale(locale === "ar" ? "en" : "ar");
          onClose();
        },
      },
      {
        key: "toggleTheme",
        label: t.command.toggleTheme,
        icon: SunMoon,
        run: () => {
          setTheme(theme === "dark" ? "light" : "dark");
          onClose();
        },
      },
      ...NAV.map((n): Cmd => ({
        key: n.key,
        label: t.nav[n.key],
        icon: n.icon,
        run: () => {
          onClose();
          navigate({ to: n.to });
        },
      })),
    ];
    return cmds.filter((c) => c.label.toLowerCase().includes(nq));
  }, [q, t, onClose, navigate, locale, setLocale, theme, setTheme]);

  useEffect(() => {
    prevFocus.current = document.activeElement;
    inputRef.current?.focus();
    return () => (prevFocus.current as HTMLElement | null)?.focus?.();
  }, []);
  useEffect(() => setIdx(0), [q]);

  const go = (i: number) => {
    const item = items[i];
    if (!item) return;
    item.run();
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start justify-center bg-overlay px-4 pt-[15vh] animate-fade"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.command.open}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-popover shadow-elevated animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          else if (e.key === "ArrowDown") {
            e.preventDefault();
            setIdx((i) => Math.min(i + 1, items.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIdx((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") go(idx);
          else if (e.key === "Tab") e.preventDefault();
        }}
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.command.placeholder}
            aria-label={t.command.placeholder}
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ul role="listbox" className="max-h-80 overflow-y-auto p-2">
          {items.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t.command.empty}
            </li>
          )}
          {items.map((n, i) => (
            <li
              key={n.key}
              role="option"
              aria-selected={i === idx}
              onMouseEnter={() => setIdx(i)}
              onClick={() => go(i)}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
            >
              <n.icon className="size-4" aria-hidden />
              <span className="flex-1">{n.label}</span>
              <ChevronRight className="size-4 opacity-60 rtl-flip" aria-hidden />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
