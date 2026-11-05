# Productivity Ecosystem — Version 1 (Core)

An offline-first personal productivity app. Everything is saved on your device with no account needed. It comes in English and Arabic (right-to-left), uses a Forest & Moss color palette, and can be installed on your phone or computer.

## What v1 includes
1. **Dashboard** (home page): today's priorities, daily progress ring, upcoming deadlines, habits due today, focus minutes, level/XP, and recent achievements. You can show or hide each card.
2. **Tasks**
   - Quick add.
   - Priority, due date, tags and subtasks.
   - Repeating tasks.
   - Today, Upcoming, Overdue and Completed views.
   - List view and Kanban board.
3. **Habits**
   - Daily, weekly or custom-day schedules.
   - Streaks with gentle recovery: a "skip" day doesn't break your streak.
   - A history heatmap and your consistency %.
4. **Focus**
   - Pomodoro and custom timers with breaks.
   - A daily focus target.
   - Session history, plus a button to log distractions.
5. **Rewards**
   - XP and levels, with a curve that gets slowly harder.
   - About 20 achievements.
   - Daily and weekly challenges.
   - A shop where you spend coins on rewards you set yourself.
   - Unlockable accent themes.
   - **Anti-cheat rules:**
     - XP is capped each day.
     - A task made and finished within 2 minutes earns nothing.
     - Completing, undoing and redoing a task never gives XP twice.
     - Each habit pays out once per day.
     - Focus XP counts only full sessions.
6. **Insights**
   - Weekly and monthly charts of tasks finished, habit consistency and focus time.
   - A few plain-language observations, such as "You complete most tasks before noon."
7. **Settings**
   - Language (EN/AR) and light/dark mode.
   - Export/import a backup file, and reset your data.

Next phases: Projects & Goals, Calendar & time blocking, Notes, and optional AI.

## Design
- **Colors:** deep forest green surfaces in dark mode, warm off-white in light mode, with moss and sage accents.
- **Fonts:** Sora for headings and Manrope for body text. IBM Plex Sans Arabic is used for Arabic.
- **Layout:**
  - On computers: a slim sidebar and a command bar (Ctrl/Cmd+K for quick add).
  - On phones: a bottom tab bar.
- **Polish:** subtle motion, well-designed empty states, and keyboard access throughout.

## Technical details
- Routes: `/` (dashboard), `/tasks`, `/habits`, `/focus`, `/rewards`, `/insights`, `/settings`. Each route has its own head metadata.
- **Storage:**
  - Data is kept in IndexedDB via `idb-keyval` and managed with a Zustand store.
  - The store loads after hydration, so the server-rendered page matches the client.
- **Rewards engine:** pure functions in `src/lib/rewards.ts`, with vitest tests for the caps and anti-exploit rules.
- **Language:** a lightweight i18n dictionary. The page's `dir` and `lang` are set in an effect, and the layout uses CSS logical properties so it works right-to-left.
- **Offline:** `vite-plugin-pwa` (generateSW) with a guarded registration wrapper, so it never registers in the preview or in dev. Offline works only in the published app.
- **Charts and icons:** recharts for charts, lucide icons.
- `AGENTS.md` gets the architecture rules, and memory saves the palette, languages and offline-first choice.
