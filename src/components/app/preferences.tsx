import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { dictionaries, dirOf, type Dict, type Locale } from "@/lib/i18n";

type Theme = "light" | "dark";
type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  t: Dict;
};

const PrefCtx = createContext<Ctx | null>(null);
// UI preferences only (not app data) — persisted lightly.
const KEY = "grove.prefs";

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(KEY) || "{}");
      if (saved.locale === "en" || saved.locale === "ar") setLocaleState(saved.locale);
      if (saved.theme === "light" || saved.theme === "dark") setThemeState(saved.theme);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = locale;
    html.dir = dirOf(locale);
    html.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(KEY, JSON.stringify({ locale, theme }));
  }, [locale, theme]);

  const setLocale = useCallback((l: Locale) => setLocaleState(l), []);
  const setTheme = useCallback((t: Theme) => setThemeState(t), []);

  return (
    <PrefCtx.Provider value={{ locale, setLocale, theme, setTheme, t: dictionaries[locale] }}>
      {children}
    </PrefCtx.Provider>
  );
}

export function usePrefs() {
  const c = useContext(PrefCtx);
  if (!c) throw new Error("usePrefs outside provider");
  return c;
}
