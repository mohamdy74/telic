import { ACCENT_IDS, type AccentId } from "./types";
import { THEME_UNLOCKS } from "./rewardsConfig";

/*
 * Unlockable accent themes. A theme is a hue only — every other accent
 * token (primary, accent, ring, foregrounds, per light/dark mode) is
 * derived by src/styles.css from --accent-hue. The hue table below MUST
 * stay in sync with the [data-accent=...] rules in src/styles.css; the
 * contrast tests in themes.test.ts pin the derived pairs to WCAG AA.
 */

export interface AccentTheme {
  id: AccentId;
  /** OKLCH hue (0..360); lightness and chroma come from the design system. */
  hue: number;
}

export const THEMES: AccentTheme[] = [
  { id: "moss", hue: 150 },
  { id: "sage", hue: 128 },
  { id: "pine", hue: 172 },
  { id: "clay", hue: 45 },
  { id: "dusk", hue: 300 },
];

export const DEFAULT_ACCENT: AccentId = "moss";

export interface ThemeUnlockState {
  level: number;
  /** Live achievement ids (the achievements collection). */
  unlockedAchievements: string[];
}

export function isThemeUnlocked(accent: AccentId, state: ThemeUnlockState): boolean {
  const rule = THEME_UNLOCKS[accent];
  if (rule.type === "default") return true;
  if (rule.type === "level") return state.level >= rule.level;
  return state.unlockedAchievements.includes(rule.achievementId);
}

/** The accent to apply for a stored value: valid + unlocked, else moss. */
export function resolveAccent(saved: string, state: ThemeUnlockState): AccentId {
  return isAccentId(saved) && isThemeUnlocked(saved, state) ? saved : DEFAULT_ACCENT;
}

export function isAccentId(v: string): v is AccentId {
  return (ACCENT_IDS as readonly string[]).includes(v);
}

