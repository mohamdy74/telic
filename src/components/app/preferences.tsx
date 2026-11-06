import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { dictionaries, dirOf, type Dict, type Locale } from "@/lib/i18n";
import { DEFAULT_ACCENT, isAccentId } from "@/lib/themes";
import type { AccentId } from "@/lib/types";

export type Theme = "light" | "dark" | "system";
type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  accent: AccentId;
  setAccent: (a: AccentId) => void;
  t: Dict;
};

const PrefCtx = createContext<Ctx | null>(null);
// UI preferences only (not app data) — persisted lightly.
const KEY = "tilth.prefs";

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ar");
  const [theme, setThemeState] = useState<Theme>("dark");
  const [accent, setAccentState] = useState<AccentId>(DEFAULT_ACCENT);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(KEY) || "{}");
      if (saved.locale === "en" || saved.locale === "ar") setLocaleState(saved.locale);
      if (saved.theme === "light" || saved.theme === "dark" || saved.theme === "system") {
        setThemeState(saved.theme);
      }
      if (typeof saved.accent === "string" && isAccentId(saved.accent))
        setAccentState(saved.accent);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = locale;
    html.dir = dirOf(locale);
    window.localStorage.setItem(KEY, JSON.stringify({ locale, theme, accent }));
  }, [locale, theme, accent]);

  // Resolve the visual theme: an explicit choice, or the OS preference when "system".
  useEffect(() => {
    const html = document.documentElement;
    const apply = (dark: boolean) => html.classList.toggle("dark", dark);
    if (theme !== "system") {
      apply(theme === "dark");
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    apply(mq.matches);
    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  // Accent: color tokens only — no layout shift when it loads or changes.
  useEffect(() => {
    document.documentElement.dataset["accent"] = accent;
  }, [accent]);

  const setLocale = useCallback((l: Locale) => setLocaleState(l), []);
  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const setAccent = useCallback((a: AccentId) => setAccentState(a), []);

  return (
    <PrefCtx.Provider
      value={{ locale, setLocale, theme, setTheme, accent, setAccent, t: dictionaries[locale] }}
    >
      {children}
    </PrefCtx.Provider>
  );
}

export function usePrefs() {
  const c = useContext(PrefCtx);
  if (!c) throw new Error("usePrefs outside provider");
  return c;
}
