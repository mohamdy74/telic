import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS } from "./achievements";
import { THEME_UNLOCKS } from "./rewardsConfig";
import { DEFAULT_ACCENT, isThemeUnlocked, resolveAccent, THEMES } from "./themes";
import { ACCENT_IDS } from "./types";

const state = (level: number, unlockedAchievements: string[] = []) => ({
  level,
  unlockedAchievements,
});

describe("themes", () => {
  it("ships five accents, moss first, each with its own hue", () => {
    expect(THEMES.map((th) => th.id)).toEqual(["moss", "sage", "pine", "clay", "dusk"]);
    expect(ACCENT_IDS[0]).toBe("moss");
    expect(DEFAULT_ACCENT).toBe("moss");
    expect(new Set(THEMES.map((th) => th.hue)).size).toBe(THEMES.length);
  });

  it("every accent has an unlock rule; achievement rules reference real achievements", () => {
    const known = new Set(ACHIEVEMENTS.map((a) => a.id));
    let achievementGates = 0;
    for (const id of ACCENT_IDS) {
      const rule = THEME_UNLOCKS[id];
      expect(rule).toBeDefined();
      if (rule.type === "achievement") {
        achievementGates++;
        expect(known.has(rule.achievementId)).toBe(true);
      }
    }
    expect(achievementGates).toBeGreaterThanOrEqual(2);
  });

  it("moss is unlocked from the start", () => {
    expect(isThemeUnlocked("moss", state(1))).toBe(true);
  });

  it("level-gated themes open at their level, not one below", () => {
    const sage = THEME_UNLOCKS["sage"];
    if (sage.type !== "level") throw new Error("sage must be level-gated");
    expect(isThemeUnlocked("sage", state(sage.level))).toBe(true);
    expect(isThemeUnlocked("sage", state(sage.level - 1))).toBe(false);
    const dusk = THEME_UNLOCKS["dusk"];
    if (dusk.type !== "level") throw new Error("dusk must be level-gated");
    expect(isThemeUnlocked("dusk", state(dusk.level))).toBe(true);
    expect(isThemeUnlocked("dusk", state(dusk.level - 1))).toBe(false);
  });

  it("achievement-gated themes follow the unlock collection", () => {
    const clay = THEME_UNLOCKS["clay"];
    if (clay.type !== "achievement") throw new Error("clay must be achievement-gated");
    expect(isThemeUnlocked("clay", state(1, []))).toBe(false);
    expect(isThemeUnlocked("clay", state(1, [clay.achievementId]))).toBe(true);
    const pine = THEME_UNLOCKS["pine"];
    if (pine.type !== "achievement") throw new Error("pine must be achievement-gated");
    expect(isThemeUnlocked("pine", state(1, []))).toBe(false);
    expect(isThemeUnlocked("pine", state(1, [pine.achievementId]))).toBe(true);
  });

  it("resolveAccent keeps a valid, unlocked accent", () => {
    expect(resolveAccent("dusk", state(10))).toBe("dusk");
    expect(resolveAccent("moss", state(1))).toBe("moss");
  });

  it("resolveAccent falls back to moss for legacy or unknown ids", () => {
    expect(resolveAccent("forest", state(10))).toBe("moss");
    expect(resolveAccent("neon", state(10))).toBe("moss");
  });

  it("resolveAccent falls back to moss when a saved accent is locked again (imported data)", () => {
    expect(resolveAccent("sage", state(2))).toBe("moss");
    expect(resolveAccent("clay", state(5, []))).toBe("moss");
  });
});

/*
 * WCAG AA contrast, computed from the design-system accent tokens that
 * src/styles.css derives from --accent-hue (keep this table in sync when
 * styles.css changes):
 *   light: --primary oklch(0.42 0.08 H) on card oklch(0.99 0.005 95) /
 *          background oklch(0.975 0.008 95), --primary-foreground
 *          oklch(0.98 0.01 95), --accent oklch(0.9 0.05 H),
 *          --accent-foreground oklch(0.3 0.06 H);
 *   dark:  --primary oklch(0.78 0.09 H) on card oklch(0.25 0.02 70) /
 *          background oklch(0.205 0.018 70), --primary-foreground
 *          oklch(0.2 0.04 158), --accent oklch(0.34 0.06 H),
 *          --accent-foreground oklch(0.9 0.06 H).
 */
const ok = (L: number, C: number, H: number): [number, number, number] => {
  const rad = (H * Math.PI) / 180;
  const a = C * Math.cos(rad);
  const b = C * Math.sin(rad);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const clip = (x: number) => Math.min(1, Math.max(0, x));
  return [
    clip(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clip(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clip(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
};
const lin = (x: number) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
const lum = (c: [number, number, number]) =>
  0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a: number, b: number) => {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
};
const AA = 4.5;

describe("accent contrast (WCAG AA)", () => {
  const card = { light: ok(0.99, 0.005, 95), dark: ok(0.25, 0.02, 70) };
  const background = { light: ok(0.975, 0.008, 95), dark: ok(0.205, 0.018, 70) };
  const primaryFg = { light: ok(0.98, 0.01, 95), dark: ok(0.2, 0.04, 158) };
  const tokens = (mode: "light" | "dark") => ({
    primary: (mode === "light" ? [0.42, 0.08] : [0.78, 0.09]) as [number, number],
    accent: (mode === "light" ? [0.9, 0.05] : [0.34, 0.06]) as [number, number],
    accentFg: (mode === "light" ? [0.3, 0.06] : [0.9, 0.06]) as [number, number],
  });

  for (const th of THEMES) {
    for (const mode of ["light", "dark"] as const) {
      it(th.id + " " + mode + ": text on accent meets AA", () => {
        const tk = tokens(mode);
        const primary = ok(tk.primary[0], tk.primary[1], th.hue);
        const accent = ok(tk.accent[0], tk.accent[1], th.hue);
        const accentFg = ok(tk.accentFg[0], tk.accentFg[1], th.hue);
        expect(ratio(lum(primaryFg[mode]), lum(primary))).toBeGreaterThanOrEqual(AA);
        expect(ratio(lum(accentFg), lum(accent))).toBeGreaterThanOrEqual(AA);
        expect(ratio(lum(primary), lum(card[mode]))).toBeGreaterThanOrEqual(AA);
        expect(ratio(lum(primary), lum(background[mode]))).toBeGreaterThanOrEqual(AA);
      });
    }
  }
});
