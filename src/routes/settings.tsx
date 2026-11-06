import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BellRing, Check, Database, Download, FileWarning, Keyboard, Monitor, Moon, Smartphone, Sprout, Sun, Upload } from "lucide-react";
import { usePrefs, type Theme } from "@/components/app/preferences";
import { Modal } from "@/components/app/Modal";
import { DANGER_BTN, OUTLINE_BTN, PRIMARY_BTN } from "@/components/ui/button";
import { BackupError, parseBackup, type ParsedBackup } from "@/lib/backup";
import { buildZipExport, exportZipFileName } from "@/lib/exportZip";
import { formatDate, formatNumber, type Locale } from "@/lib/i18n";
import { isStandalone } from "@/lib/pwa";
import {
  exportSnapshot,
  flushAll,
  importSnapshot,
  metaActions,
  resetAll,
  seedSampleData,
  settings as settingsApi,
  useStore,
} from "@/lib/store";
import { COLLECTION_KEYS, type DashboardCard } from "@/lib/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Tilth" },
      { name: "description", content: "Language, appearance, your day and your data in Tilth." },
      { property: "og:title", content: "Settings — Tilth" },
      { property: "og:description", content: "Language, appearance, your day and your data in Tilth." },
    ],
  }),
  component: SettingsPage,
});

const COLLECTIONS = [
  "tasks",
  "notes",
  "habits",
  "habitLogs",
  "focusSessions",
  "xpLedger",
  "achievements",
  "shopItems",
  "purchases",
] as const;
const DAY_START_HOURS = [0, 4] as const;
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const DASHBOARD_CARDS: DashboardCard[] = [
  "priorities",
  "progress",
  "deadlines",
  "habits",
  "focus",
  "level",
  "achievements",
];
const BACKUP_STALE_MS = 7 * 24 * 60 * 60 * 1000;

function SettingsPage() {
  const { t } = usePrefs();
  return (
    <section>
      <p className="mb-2 text-sm font-medium text-primary">{t.nav.settings}</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
        {t.pages.settings.title}
      </h1>
      <p className="mt-2 text-muted-foreground">{t.pages.settings.body}</p>

      <div className="mt-8 grid items-start gap-4 md:grid-cols-2">
        <LanguageSection />
        <YourDaySection />
        <ThemeSection />
        <DashboardCardsSection />
        <AppSection />
        <NotificationsSection />
        <ShortcutsSection />
      </div>

      <div className="mt-4">
        <DataSection />
      </div>

      <div className="mt-4">
        <StoreStatus />
      </div>
    </section>
  );
}

function SkeletonPanel() {
  return (
    <fieldset className="panel" aria-busy="true" aria-hidden="true">
      <div className="mt-4 space-y-2">
        <div className="h-5 w-1/3 animate-pulse rounded bg-accent/30" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-accent/30" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-accent/30" />
      </div>
    </fieldset>
  );
}

function LanguageSection() {
  const { t, locale, setLocale } = usePrefs();
  const ready = useStore((s) => s.ready);
  const pick = (l: Locale) => {
    setLocale(l);
    if (ready) settingsApi.update({ language: l });
  };
  return (
    <fieldset className="panel">
      <legend className="panel-title">{t.settings.language}</legend>
      <div className="segmented" role="radiogroup" aria-label={t.settings.language}>
        {(["en", "ar"] as const).map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={locale === l}
            onClick={() => pick(l)}
            className="segment"
          >
            {l === "en" ? "English" : "العربية"}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function ThemeSection() {
  const { t, theme, setTheme } = usePrefs();
  const ready = useStore((s) => s.ready);
  const pick = (th: Theme) => {
    setTheme(th);
    if (ready) settingsApi.update({ theme: th });
  };
  const options: Array<{ value: Theme; label: string; icon: ReactNode }> = [
    { value: "light", label: t.settings.light, icon: <Sun className="size-4" aria-hidden /> },
    { value: "dark", label: t.settings.dark, icon: <Moon className="size-4" aria-hidden /> },
    { value: "system", label: t.settings.system, icon: <Monitor className="size-4" aria-hidden /> },
  ];
  return (
    <fieldset className="panel">
      <legend className="panel-title">{t.settings.theme}</legend>
      <div className="segmented" role="radiogroup" aria-label={t.settings.theme}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={theme === o.value}
            onClick={() => pick(o.value)}
            className="segment"
          >
            {o.icon} {o.label}
          </button>
        ))}
      </div>
      {theme === "system" && (
        <p className="mt-3 text-xs text-muted-foreground">{t.settings.systemHint}</p>
      )}
    </fieldset>
  );
}

function YourDaySection() {
  const { t, locale } = usePrefs();
  const ready = useStore((s) => s.ready);
  const settings = useStore((s) => s.settings);
  const [draft, setDraft] = useState(String(settings.dailyFocusTargetMinutes));

  useEffect(() => {
    setDraft(String(settings.dailyFocusTargetMinutes));
  }, [settings.dailyFocusTargetMinutes]);

  if (!ready) return <SkeletonPanel />;

  const commitTarget = () => {
    const n = Math.min(1440, Math.max(0, Math.round(Number(draft) || 0)));
    setDraft(String(n));
    if (n !== settings.dailyFocusTargetMinutes) settingsApi.update({ dailyFocusTargetMinutes: n });
  };

  return (
    <fieldset className="panel">
      <legend className="panel-title">{t.settings.yourDay}</legend>

      <div className="mt-2">
        <p className="text-sm font-medium">{t.settings.dayStart}</p>
        <p className="text-xs text-muted-foreground">{t.settings.dayStartHint}</p>
        <div className="segmented" role="radiogroup" aria-label={t.settings.dayStart}>
          {DAY_START_HOURS.map((h) => (
            <button
              key={h}
              type="button"
              role="radio"
              aria-checked={settings.dayStartHour === h}
              onClick={() => settingsApi.update({ dayStartHour: h })}
              className="segment tabular-nums"
            >
              {dayHourLabel(h)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium">{t.settings.weekStart}</p>
        <div
          className="mt-2 grid max-w-sm grid-cols-4 gap-1.5 sm:grid-cols-7"
          role="radiogroup"
          aria-label={t.settings.weekStart}
        >
          {WEEKDAYS.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={settings.weekStartsOn === d}
              onClick={() => settingsApi.update({ weekStartsOn: d })}
              className="segment justify-center"
            >
              {weekdayShort(locale, d)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="focus-target" className="text-sm font-medium">
          {t.settings.focusTarget}
        </label>
        <div className="mt-2 flex items-center gap-2">
          <input
            id="focus-target"
            type="number"
            inputMode="numeric"
            min={0}
            max={1440}
            step={5}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitTarget}
            className="w-24 rounded-md border border-input bg-background px-2 py-1.5 text-sm tabular-nums text-foreground"
          />
          <span className="text-sm text-muted-foreground">{t.settings.minutes}</span>
        </div>
      </div>
    </fieldset>
  );
}

function DashboardCardsSection() {
  const { t } = usePrefs();
  const ready = useStore((s) => s.ready);
  const cards = useStore((s) => s.settings.dashboardCards);
  if (!ready) return <SkeletonPanel />;

  return (
    <fieldset className="panel">
      <legend className="panel-title">{t.settings.dashboardCards}</legend>
      <p className="text-xs text-muted-foreground">{t.settings.dashboardHint}</p>
      <ul className="mt-3 space-y-1">
        {DASHBOARD_CARDS.map((c) => (
          <li
            key={c}
            className="flex items-center justify-between gap-4 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/20"
          >
            <span className="text-sm">{t.settings.cards[c]}</span>
            <Switch
              checked={cards[c]}
              onChange={(v) => settingsApi.update({ dashboardCards: { ...cards, [c]: v } })}
              label={t.settings.cards[c]}
            />
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

type InstallPromptEvent = {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Install app (PWA) — uses beforeinstallprompt where supported. */
function AppSection() {
  const { t } = usePrefs();
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as unknown as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    setInstalled(isStandalone());
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPromptEvent(null);
  };

  return (
    <fieldset className="panel">
      <legend className="panel-title">{t.pwa.sectionTitle}</legend>
      <p className="text-sm text-muted-foreground">{t.pwa.installBody}</p>
      {installed ? (
        <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary">
          <Check className="size-4" aria-hidden /> {t.pwa.installed}
        </p>
      ) : promptEvent ? (
        <button type="button" onClick={() => void install()} className={PRIMARY_BTN + " mt-3"}>
          <Smartphone className="size-4" aria-hidden /> {t.pwa.install}
        </button>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{t.pwa.installUnsupported}</p>
      )}
    </fieldset>
  );
}

/** Quiet daily digest — off by default; local notifications while the app is open. */
function NotificationsSection() {
  const { t } = usePrefs();
  const ready = useStore((s) => s.ready);
  const digest = useStore((s) => s.settings.digest);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");

  // Read the browser permission after mount (no hydration drift).
  useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  if (!ready) return <SkeletonPanel />;

  const enabled = digest?.enabled ?? false;
  const morningAt = digest?.morningAt ?? "08:00";
  const eveningAt = digest?.eveningAt ?? "21:00";

  const askPermission = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPerm(p);
  };

  return (
    <fieldset className="panel">
      <legend className="panel-title">{t.notif.title}</legend>
      <p className="text-xs text-muted-foreground">{t.notif.hint}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t.notif.whileOpen}</p>
      <div className="mt-3 flex items-center justify-between gap-4">
        <span className="text-sm">{enabled ? t.notif.on : t.notif.off}</span>
        <Switch
          checked={enabled}
          onChange={(v) => settingsApi.update({ digest: { enabled: v, morningAt, eveningAt } })}
          label={t.notif.title}
        />
      </div>
      <div className="mt-3">
        {perm === "granted" ? (
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
            <Check className="size-3.5" aria-hidden /> {t.notif.on}
          </p>
        ) : perm === "denied" ? (
          <p className="text-xs text-destructive">{t.notif.denied}</p>
        ) : perm === "unsupported" ? null : (
          <button type="button" onClick={() => void askPermission()} className={OUTLINE_BTN + " px-3 py-1.5"}>
            <BellRing className="size-4" aria-hidden /> {t.notif.allow}
          </button>
        )}
      </div>
    </fieldset>
  );
}

/** The keyboard shortcuts that exist, documented where they live. */
function ShortcutsSection() {
  const { t } = usePrefs();
  const rows: Array<[string, string]> = [
    [t.settings.shortcuts.palette, "Ctrl/⌘ K"],
    [t.settings.shortcuts.focusStart, "Space"],
    [t.settings.shortcuts.escape, "Esc"],
  ];
  return (
    <fieldset className="panel">
      <legend className="panel-title">{t.settings.shortcutsTitle}</legend>
      <ul className="mt-3 space-y-1.5 text-sm">
        {rows.map(([label, keys]) => (
          <li key={label} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">
              <Keyboard className="me-1.5 inline size-3.5" aria-hidden />
              {label}
            </span>
            <kbd className="rounded border border-border bg-accent/40 px-1.5 py-0.5 font-sans text-xs">
              {keys}
            </kbd>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function DataSection() {
  const { t, locale } = usePrefs();
  const ready = useStore((s) => s.ready);
  const persisted = useStore((s) => s.persisted);
  const lastExportedAt = useStore((s) => s.meta.lastExportedAt);
  const [flash, setFlash] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetWord, setResetWord] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 6000);
    return () => window.clearTimeout(id);
  }, [flash]);

  if (!ready) return <SkeletonPanel />;

  const stale =
    !lastExportedAt || Date.now() - new Date(lastExportedAt).getTime() > BACKUP_STALE_MS;

  const doExport = () => {
    const blob = new Blob([buildZipExport(exportSnapshot())], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportZipFileName();
    a.click();
    URL.revokeObjectURL(url);
    metaActions.update({ lastExportedAt: new Date().toISOString() });
    setFlash(t.data.exportDone);
  };

  const onFile = async (f: File) => {
    try {
      setPending(parseBackup(await f.text()));
      setImportErr(null);
    } catch (e) {
      setPending(null);
      setImportErr(
        e instanceof BackupError
          ? e.code === "newer-schema"
            ? t.data.errNewer
            : e.code === "empty"
              ? t.data.errEmpty
              : t.data.errInvalid
          : t.data.errInvalid,
      );
    }
  };

  const confirmImport = async () => {
    if (!pending) return;
    const snap = pending.snapshot;
    setPending(null);
    try {
      await importSnapshot(snap);
      setFlash(t.data.importDone);
    } catch {
      setFlash(t.data.importFailed);
    }
  };

  return (
    <>
      <fieldset className="panel">
        <legend className="panel-title">{t.data.title}</legend>
        <p className="text-sm text-muted-foreground">{t.data.localOnly}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t.data.backupWhy}</p>

        <div className="mt-3 flex items-center justify-between gap-4 border-b border-border/60 py-1.5 text-sm">
          <span className="text-muted-foreground">{t.data.persisted}</span>
          <span className="font-medium">
            {persisted === null ? t.debug.unknown : persisted ? t.data.granted : t.data.notGranted}
          </span>
        </div>

        {stale && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-accent/60 bg-accent/20 px-4 py-3">
            <div className="flex items-start gap-2">
              <FileWarning className="mt-0.5 size-4 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-medium">{t.data.reminderTitle}</p>
                <p className="text-xs text-muted-foreground">{t.data.reminderBody}</p>
              </div>
            </div>
            <button type="button" onClick={doExport} className={OUTLINE_BTN}>
              {t.data.exportBtn}
            </button>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={doExport} className={PRIMARY_BTN}>
            <Download className="size-4" aria-hidden /> {t.data.export}
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className={OUTLINE_BTN}>
            <Upload className="size-4" aria-hidden /> {t.data.import}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t.data.exportHint}</p>
        <p className="text-xs text-muted-foreground">{t.data.importHint}</p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void onFile(f);
          }}
        />

        {importErr && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {importErr}
          </p>
        )}
        {flash && (
          <p className="mt-3 text-sm font-medium text-primary" role="status">
            {flash}
          </p>
        )}

        <div className="mt-5 border-t border-border/60 pt-4">
          <button
            type="button"
            onClick={() => {
              setResetWord("");
              setResetOpen(true);
            }}
            className={DANGER_BTN}
          >
            {t.data.reset}
          </button>
          <p className="mt-2 text-xs text-muted-foreground">{t.data.resetHint}</p>
        </div>
      </fieldset>

      {pending && (
        <Modal title={t.data.importTitle} onClose={() => setPending(null)}>
          <h2 className="font-display text-lg font-semibold">{t.data.importTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t.data.importBody}</p>
          {pending.exportedAt && (
            <p className="mt-3 text-sm font-medium">
              {t.data.importFrom.replace(
                "{date}",
                formatDate(locale, new Date(pending.exportedAt), { dateStyle: "medium" }),
              )}
            </p>
          )}
          {pending.migratedFrom !== null && (
            <p className="mt-1 text-xs text-muted-foreground">{t.data.migratedNote}</p>
          )}
          <ul className="mt-3 space-y-1 text-sm">
            {COLLECTION_KEYS.map((c) => (
              <li key={c} className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t.data.collections[c]}</span>
                <span className="font-medium tabular-nums">
                  {formatNumber(locale, pending.counts[c])}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setPending(null)} className={OUTLINE_BTN}>
              {t.data.cancel}
            </button>
            <button type="button" onClick={() => void confirmImport()} className={PRIMARY_BTN}>
              {t.data.replaceBtn}
            </button>
          </div>
        </Modal>
      )}

      {resetOpen && (
        <Modal title={t.data.resetTitle} onClose={() => setResetOpen(false)}>
          <h2 className="font-display text-lg font-semibold">{t.data.resetTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t.data.resetBody}</p>
          <button type="button" onClick={doExport} className={OUTLINE_BTN + " mt-4 w-full"}>
            <Download className="size-4" aria-hidden /> {t.data.resetExportFirst}
          </button>
          <label htmlFor="reset-confirm" className="mt-4 block text-sm font-medium">
            {t.data.resetWordPrompt}
          </label>
          <input
            id="reset-confirm"
            value={resetWord}
            onChange={(e) => setResetWord(e.target.value)}
            autoComplete="off"
            className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setResetOpen(false)} className={OUTLINE_BTN}>
              {t.data.cancel}
            </button>
            <button
              type="button"
              disabled={resetWord.trim() !== t.data.resetWord}
              onClick={() => {
                setResetOpen(false);
                void resetAll();
              }}
              className={DANGER_BTN}
            >
              {t.data.resetBtn}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={
        "rtl-flip relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border transition-colors " +
        (checked ? "bg-primary" : "bg-muted")
      }
    >
      <span
        aria-hidden
        className={
          "pointer-events-none absolute start-0.5 block size-4 rounded-full bg-background shadow transition-transform " +
          (checked ? "translate-x-[22px]" : "translate-x-0")
        }
      />
    </button>
  );
}

/** Temporary debug view of the data layer. */
function StoreStatus() {
  const { t, locale } = usePrefs();
  const ready = useStore((s) => s.ready);
  const error = useStore((s) => s.error);
  const persisted = useStore((s) => s.persisted);
  const schemaVersion = useStore((s) => s.meta.schemaVersion);
  const pending = useStore((s) => s.pending);
  const lastSyncAt = useStore((s) => s.lastSyncAt);
  const lastMergeAt = useStore((s) => s.lastMergeAt);
  const settings = useStore((s) => s.settings);

  if (!ready) {
    return (
      <fieldset className="panel" aria-busy="true">
        <legend className="panel-title">{t.debug.title}</legend>
        <div className="mt-4 space-y-2" aria-hidden="true">
          <div className="h-4 w-2/3 animate-pulse rounded bg-accent/30" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-accent/30" />
          <div className="h-4 w-3/5 animate-pulse rounded bg-accent/30" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t.debug.loading}</p>
      </fieldset>
    );
  }

  const rows: Array<[string, string]> = [
    [t.debug.schema, formatNumber(locale, schemaVersion)],
    [
      t.debug.storage,
      persisted === null ? t.debug.unknown : persisted ? t.debug.granted : t.debug.notGranted,
    ],
    [t.debug.dayStart, dayHourLabel(settings.dayStartHour)],
    [t.debug.weekStart, weekdayName(locale, settings.weekStartsOn)],
    [
      t.debug.focusTarget,
      formatNumber(locale, settings.dailyFocusTargetMinutes) + " " + t.debug.minutes,
    ],
    [t.debug.pending, formatNumber(locale, pending.length)],
    [
      t.debug.lastSync,
      lastSyncAt
        ? formatDate(locale, new Date(lastSyncAt), { dateStyle: "short", timeStyle: "medium" })
        : t.debug.never,
    ],
    [
      t.debug.lastMerge,
      lastMergeAt
        ? formatDate(locale, new Date(lastMergeAt), { dateStyle: "short", timeStyle: "medium" })
        : t.debug.never,
    ],
  ];

  return (
    <fieldset className="panel">
      <legend className="panel-title">{t.debug.title}</legend>
      <dl className="mt-3 grid gap-x-8 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <Row key={label} label={label} value={value} />
        ))}
      </dl>

      <table className="mt-5 w-full text-sm">
        <caption className="sr-only">{t.debug.collections}</caption>
        <thead>
          <tr className="text-xs uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="py-1 text-start font-medium">
              {t.debug.collections}
            </th>
            <th scope="col" className="py-1 text-end font-medium">
              {t.debug.records}
            </th>
            <th scope="col" className="py-1 text-end font-medium">
              {t.debug.softDeleted}
            </th>
          </tr>
        </thead>
        <tbody>
          {COLLECTIONS.map((c) => (
            <CollectionCount key={c} collection={c} locale={locale} />
          ))}
        </tbody>
      </table>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {import.meta.env.DEV && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => seedSampleData()}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/40"
          >
            <Sprout className="size-4" aria-hidden />
            {t.debug.seed}
          </button>
          <button
            type="button"
            onClick={() => void flushAll()}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/40"
          >
            <Database className="size-4" aria-hidden />
            {t.debug.flush}
          </button>
        </div>
      )}
    </fieldset>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function CollectionCount({
  collection,
  locale,
}: {
  collection: (typeof COLLECTIONS)[number];
  locale: Locale;
}) {
  const list = useStore((s) => s[collection]);
  const live = list.filter((r) => !r.deletedAt).length;
  const soft = list.length - live;
  return (
    <tr className="border-t border-border">
      <td className="py-1.5">{collection}</td>
      <td className="py-1.5 text-end tabular-nums">{formatNumber(locale, live)}</td>
      <td className="py-1.5 text-end tabular-nums">{soft > 0 ? formatNumber(locale, soft) : "—"}</td>
    </tr>
  );
}

function dayHourLabel(hour: number): string {
  return String(hour).padStart(2, "0") + ":00";
}

function weekdayName(locale: Locale, weekStartsOn: number): string {
  // 2023-01-01 was a Sunday, so the 1st + weekStartsOn lands on that weekday.
  const day = new Date(Date.UTC(2023, 0, 1 + weekStartsOn));
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).format(day);
}

function weekdayShort(locale: Locale, d: number): string {
  const day = new Date(Date.UTC(2023, 0, 1 + d));
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    weekday: "short",
    timeZone: "UTC",
  }).format(day);
}
