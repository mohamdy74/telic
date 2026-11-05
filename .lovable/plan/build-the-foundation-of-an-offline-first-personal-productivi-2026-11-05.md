Build the foundation of an offline-first personal productivity app. This step is foundation only: no feature logic yet.

CONSTRAINTS

- Use the project's existing framework. Do not switch frameworks.

- Routes (each with its own head metadata/title): / , /tasks, /habits, /focus, /rewards, /insights, /settings. Each renders a well-designed empty-state placeholder for now.

- Languages: English and Arabic (RTL). Lightweight i18n: a typed dictionary (en/ar), a t() helper, and Intl.PluralRules for plurals (Arabic has 6 plural forms; no string concatenation). Format numbers and dates with Intl.

- Set <html dir> and <html lang> in an effect so server/client markup matches. Use CSS logical properties everywhere (margin-inline-start, padding-inline, inset-inline, text-align: start). Directional icons (chevrons, arrows) must flip in RTL.

- Fonts: Sora (headings), Manrope (body), IBM Plex Sans Arabic (Arabic). Self-host them (no Google Fonts CDN) so they work offline later.

- Theme: "Forest & Moss". Dark mode = deep forest green surfaces; light mode = warm off-white; moss and sage accents. Define all colors as CSS variables/design tokens, including an --accent variable that can be swapped later for unlockable themes. Light/dark toggle.

- Layout: desktop = slim sidebar + command bar (Ctrl/Cmd+K opens a palette with navigation only for now). Mobile = bottom tab bar. Keyboard access everywhere (visible focus rings, logical tab order, Esc closes dialogs).

- Subtle motion; respect prefers-reduced-motion.

- Icons: lucide. Charts later: recharts.

ARCHITECTURE RULES

- Create or update [AGENTS.md](http://AGENTS.md) with: folder structure, the rules above (logical properties only, no hardcoded colors, all strings via t(), no localStorage for app data, pure logic lives in src/lib and is unit-tested), and the offline-first decision.

- Save to memory: palette, languages (EN/AR), offline-first.

DO NOT build tasks, habits, focus, rewards, storage, or PWA yet.

When done: list files created, and tell me exactly how to verify (what to click, what should happen in EN and AR).