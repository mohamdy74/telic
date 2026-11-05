import { createFileRoute } from "@tanstack/react-router";
import { Database, Moon, Sprout, Sun } from "lucide-react";
import { usePrefs } from "@/components/app/preferences";
import { formatDate, formatNumber, type Locale } from "@/lib/i18n";
import { flushAll, seedSampleData, useStore } from "@/lib/store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Grove" },
      { name: "description", content: "Choose your language and appearance in Grove." },
      { property: "og:title", content: "Settings — Grove" },
      { property: "og:description", content: "Choose your language and appearance in Grove." },
    ],
  }),
  component: SettingsPage,
});

const COLLECTIONS = ["tasks", "habits", "habitLogs", "focusSessions", "xpLedger"] as const;

function SettingsPage() {
  const { t, locale, setLocale, theme, setTheme } = usePrefs();
  return (
    <section>
      <p className="mb-2 text-sm font-medium text-primary">{t.nav.settings}</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
        {t.pages.settings.title}
      </h1>
      <p className="mt-2 text-muted-foreground">{t.pages.settings.body}</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <fieldset className="panel">
          <legend className="panel-title">{t.settings.language}</legend>
          <div className="segmented" role="radiogroup" aria-label={t.settings.language}>
            {(["en", "ar"] as const).map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={locale === l}
                onClick={() => setLocale(l)}
                className="segment"
              >
                {l === "en" ? "English" : "العربية"}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground" suppressHydrationWarning>
            {formatDate(locale, new Date())}
          </p>
        </fieldset>
        <fieldset className="panel">
          <legend className="panel-title">{t.settings.theme}</legend>
          <div className="segmented" role="radiogroup" aria-label={t.settings.theme}>
            <button
              type="button"
              role="radio"
              aria-checked={theme === "light"}
              onClick={() => setTheme("light")}
              className="segment"
            >
              <Sun className="size-4" aria-hidden /> {t.settings.light}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={theme === "dark"}
              onClick={() => setTheme("dark")}
              className="segment"
            >
              <Moon className="size-4" aria-hidden /> {t.settings.dark}
            </button>
          </div>
        </fieldset>
      </div>

      <div className="mt-4">
        <StoreStatus />
      </div>
    </section>
  );
}

/** Temporary debug view of the data layer. Real settings UI comes later. */
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
