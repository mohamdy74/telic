import { createFileRoute } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { usePrefs } from "@/components/app/preferences";
import { formatDate } from "@/lib/i18n";

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

function SettingsPage() {
  const { t, locale, setLocale, theme, setTheme } = usePrefs();
  return (
    <section>
      <p className="mb-2 text-sm font-medium text-primary">{t.nav.settings}</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{t.pages.settings.title}</h1>
      <p className="mt-2 text-muted-foreground">{t.pages.settings.body}</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <fieldset className="panel">
          <legend className="panel-title">{t.settings.language}</legend>
          <div className="segmented" role="radiogroup" aria-label={t.settings.language}>
            {(["en", "ar"] as const).map((l) => (
              <button key={l} type="button" role="radio" aria-checked={locale === l} onClick={() => setLocale(l)} className="segment">
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
            <button type="button" role="radio" aria-checked={theme === "light"} onClick={() => setTheme("light")} className="segment">
              <Sun className="size-4" aria-hidden /> {t.settings.light}
            </button>
            <button type="button" role="radio" aria-checked={theme === "dark"} onClick={() => setTheme("dark")} className="segment">
              <Moon className="size-4" aria-hidden /> {t.settings.dark}
            </button>
          </div>
        </fieldset>
      </div>
    </section>
  );
}
