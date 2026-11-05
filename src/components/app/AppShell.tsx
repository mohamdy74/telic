import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Plus, Search, Target, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NAV } from "./nav";
import { usePrefs } from "./preferences";

type Cmd = { key: string; label: string; icon: LucideIcon; run: () => void };

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = usePrefs();
  const [open, setOpen] = useState(false);

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#main" className="skip-link">{t.skip}</a>
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
        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV.map(({ key, to, icon: Icon }) => (
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
          ))}
        </nav>
        <p className="mt-auto px-2 text-xs text-muted-foreground">{t.tagline}</p>
      </aside>

      <main id="main" className="pb-24 md:ps-60 md:pb-0">
        <div className="mx-auto max-w-5xl px-5 py-8 md:px-10 md:py-12 animate-rise">{children}</div>
      </main>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-sidebar/95 backdrop-blur md:hidden">
        {NAV.filter((n) => n.key !== "insights" && n.key !== "settings").map(({ key, to, icon: Icon }) => (
          <Link
            key={key}
            to={to}
            activeOptions={{ exact: to === "/" }}
            className="tab-link"
            activeProps={{ "aria-current": "page", className: "tab-link-active" }}
          >
            <Icon className="size-5" aria-hidden />
            <span>{t.nav[key]}</span>
          </Link>
        ))}
      </nav>

      {open && <CommandPalette onClose={() => setOpen(false)} />}
    </div>
  );
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const { t } = usePrefs();
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
  }, [q, t, onClose, navigate]);

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
    <div className="fixed inset-0 z-50 grid place-items-start justify-center bg-overlay px-4 pt-[15vh] animate-fade" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.command.open}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-popover shadow-elevated animate-pop"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          else if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
          else if (e.key === "Enter") go(idx);
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
          {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">{t.command.empty}</li>}
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
