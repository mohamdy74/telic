<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Architecture (Tilth)

- Structure: `src/routes/*` = pages (one per module, own `head()`); `src/components/app/*` = shell, nav, preferences provider; `src/lib/*` = pure logic (i18n, future domain engines) with colocated `*.test.ts`.
- Offline-first: no backend/accounts; app data will live on-device (IndexedDB). Never use localStorage for app data (only tiny UI prefs like locale/theme). Multi-device sync stays a documented future decision point — if it ever lands, the reconciliation model is local-first (merge, never overwrite), not a server-side source of truth.
- All user-facing strings go through the typed dictionary in `src/lib/i18n.ts`; plurals via `plural()` (Intl.PluralRules), numbers/dates via Intl helpers. No string concatenation.
  Two deliberate exceptions: the root `ErrorComponent` crash boundary (it must render with zero context — the failure can be inside the provider itself) and physical key names in `<kbd>` (Space/Esc).
- RTL: use CSS logical properties / Tailwind logical utilities (ps/pe, ms/me, start/end, text-start). Directional icons get `rtl-flip`. `<html dir/lang>` is set in an effect.
- Dialogs (the per-route `Modal` copies and the ⌘K palette) manage keyboard focus: the panel receives focus on open, Tab is trapped inside it, and focus returns to the opener on close.
- Arabic-first: Arabic is the DEFAULT locale; SSR renders `<html lang="ar" dir="rtl">` and English users flip in a hydration effect. Arabic copy is natural MSA, never literal translations. `src/styles.css` raises Arabic line-height and zeroes letter-spacing under `[dir="rtl"]` (see the `:lang(ar)` rules).
- No hardcoded colors in components; all colors are oklch tokens in `src/styles.css`. Accent is driven by `--accent-hue` so themes can swap it.
- Fonts are self-hosted via @fontsource (no CDN) so they work offline.

## Data rules (schema v4)

- `localDay` is stored at creation time and never recomputed afterwards. A record's
  localDay must survive later changes of timezone or `dayStartHour`.
- `meta.schemaVersion` is 4 (`CURRENT_SCHEMA_VERSION` in `src/lib/types.ts`). Any
  stored-shape change bumps it and adds one entry to the ordered `migrations`
  array in `src/lib/migrations.ts` (index = from-version); migrations run on boot
  and on import. Exception: ADDITIVE OPTIONAL fields (absent in old records,
  defaulted on read) do not bump the version — e.g. `Task.seriesId`, `FocusSession.pausedAt`.
- Storage keys: one IndexedDB key per collection — `tasks`, `notes`, `habits`,
  `habitLogs`, `focusSessions`, `xpLedger`, `achievements`, `shopItems`,
  `purchases`, `settings`, `meta` (idb-keyval store
  "tilth"). Writing one collection never rewrites the others; writes are
  debounced (250 ms) and flushed on tab hide.
- The store boots client-side AFTER hydration (`bootStore()` effect in
  `__root.tsx`), so SSR HTML matches the client. UI must render a skeleton until
  `ready` is true.
- Multi-tab: `BroadcastChannel("tilth-sync")` + per-key rev counters; concurrent
  writes merge per record by `updatedAt` (`src/lib/storage/persistence.ts`).
- IDs are `crypto.randomUUID()`; every record carries ISO `createdAt`/`updatedAt`;
  deletion is soft (`deletedAt`) wherever undo matters.
- Recurrence is a stored rule on the task; only the NEXT instance is generated
  on completion (`tasks.complete`) — never pre-generate instances.
- Real pages so far: `/settings`, `/tasks`, `/notes`, `/habits`, `/focus`,
  `/rewards`, `/insights`, `/calendar`, `/` (the Today dashboard) — every
  nav section is a real page.
  The settings store-status panel is debug-only.

## Tasks page (/tasks)

- Quick add parses inline syntax in `src/lib/quickAdd.ts` (PURE:
  `parseQuickAdd(input, today)`): `!high` / `!عالي` (also `!med`/`!low` and AR
  aliases), `#tag` tokens, and date words (today/tomorrow/tmr and
  النهاردة/اليوم/بكرة/بكره/غدا…). Unknown `!flags` stay in the title; a later
  date word wins. Extend the alias sets in quickAdd.ts, never the route.
- Views bucket tasks purely from the stored `dueDate` (LocalDay) vs
  `todayLocal()`: today / upcoming / overdue; `inbox` = no due date;
  `completed` = `status === "done"`. Overdue always compares stored localDays —
  never recompute a record's day.
- Complete/uncomplete is an idempotent toggle through `tasks.complete` /
  `tasks.reopen` (`completedAt` set/cleared). The tasks UI NEVER writes
  `xpLedger` — `applyRewardEvent` in store.ts awards XP on
  complete and revokes it on reopen.
- Kanban: columns are `Task.status` (todo/doing/done); `kanbanOrder` is a
  per-task number reassigned wholesale by `tasks.reorder(ids)` after a drop.
  Board RTL: DOM order todo→doing→done flows with direction; column move
  buttons use `rtl-flip` chevrons. Drag & drop always has the button
  alternative.
- Recurring series: tasks with a rule carry `seriesId` (additive optional
  field). Generated instances inherit it via `tasks.complete`. Deleting a
  recurring task asks instance vs series; series = same `seriesId`, or same
  title+rule for legacy rows without one.
- Undo: complete/delete show a toast; undo reuses soft delete
  (`tasks.restore`) and removes a spawned next instance when one was created.
- ⌘K palette: "New task" sets sessionStorage `tilth.new-task`, routes to
  /tasks, and the page focuses the quick-add input (flag cleared on read).

## Habits page (/habits)

- Schedules: daily / weekly (specific weekdays) / custom days — all reduce to
  `HabitSchedule.days` (0=Sun..6=Sat); `isScheduledOn` in
  `src/lib/streaks.ts` is the single source of truth. Weekly-count habits
  ("3 times per week") are out of scope for v1.
- Streaks are pure functions in `src/lib/streaks.ts` (`habitStreaks`):
  a streak counts consecutive scheduled days that are done; a skipped day
  neither breaks nor extends it; gentle recovery protects at most
  `SKIP_LIMIT_PER_WEEK` (2) skips per week (week per
  `settings.weekStartsOn`) — a 3rd skip in the same week breaks;
  unscheduled days never break or extend; a missed scheduled day breaks;
  today never breaks until the day has ended. All of it runs on stored
  LocalDay strings — never recompute a record's day.
- Consistency: `consistency30` = done / (scheduled − skipped) over the
  last 30 days including today (formula documented in the code); skipped
  days leave the denominator, unscheduled days never count; null when
  nothing was scheduled.
- Logging is one HabitLog per (habitId, localDay): `habits.log` replaces the
  status (idempotent), `habits.unlog` soft-deletes. The habits UI NEVER
  writes `xpLedger` — `applyRewardEvent` awards on done-logs
  and revokes on skip/unlog.
- Heatmap (12 weeks): done / skipped / missed / upcoming / not-scheduled are
  distinct beyond color (solid fill, hollow ring, tint, tooltips via
  title/aria-label, and a legend). Clicking a scheduled day within the last 7
  days cycles done → skipped → clear (past-day logging). Week columns flow
  with inline direction, so the timeline mirrors automatically in RTL.
- Archive is `habits.update(id, { archived: true })`; the All-habits tab lists
  archived habits with restore + delete (soft delete, toast with undo).

## Focus page (/focus)

- Timer correctness (critical): the countdown NEVER counts with interval
  ticks. `remainingMs` in `src/lib/focusTime.ts` computes
  remaining time from stored timestamps (startedAt/endsAt/pausedAt) vs the
  wall clock on every render; the 500ms interval only triggers re-render.
  Background tabs and sleeping phones are therefore always correct; the
  overdue effect marks a session completed the moment the user returns
  after it ended (it re-runs on every tick and on visibilitychange).
- Pausing stores `FocusSession.pausedAt` (additive optional field);
  resuming shifts `endsAt` forward via the pure
  `shiftEndsAfterResume` (store actions `focus.pause` /
  `focus.resume`). The active session lives in the store, so a
  reload resumes it automatically.
- Modes: pomodoro (25 min work / 5 min break, long break 15 after every 4
  completed work sessions today, `nextBreakMinutes`) and custom
  (work/break minutes, UI state only). Breaks are separate sessions with
  `mode: "break"`. `linkedTaskId` optionally ties a session
  to a task.
- A session is completed ONLY when it ran to endsAt; cancel/early stop calls
  `focus.end(id, false)` and is saved with completed=false.
- Today's focus = planned minutes of completed work sessions whose stored
  localDay is today (`workMinutesToday`, breaks excluded), shown
  against `settings.dailyFocusTargetMinutes`.
- Completion plays a short WebAudio chime + vibration; the toggle persists in
  localStorage `tilth.focus-sound` (tiny UI pref). No push notifications
  in v1 — the UI says so. Keyboard: Space start/pause, Esc cancel (confirm
  modal).
- Sessions crossing midnight keep startedAt's localDay (`groupByDay`
  groups by the stored day, never recomputed).
- The focus UI NEVER writes `xpLedger` — `applyRewardEvent` awards
  on `focus.end(id, true)` for work sessions only (1 XP per planned minute).

## Notes page (/notes)

- Notes are free-form Markdown records in the `notes` collection (schema v4,
  additive migration): `title` + `body` (plain Markdown text), optional
  `linkedTaskId`, optional `pinned`. Notes sit OUTSIDE the XP economy — no
  reward events, no ledger entries; `applyRewardEvent` is never called for
  notes.
- The engine is pure in `src/lib/notes.ts` (notes.test.ts): `sortNotes`
  (pinned first, then updatedAt desc, id tiebreak — always returns a copy),
  `filterNotes` (case-insensitive contains over title + body; an empty query
  returns everything), `mdToHtml`, `noteToMarkdown`.
- `mdToHtml` escapes HTML FIRST, then applies a small inline subset (bold,
  italic, code, http(s)-only links with `rel="noopener noreferrer"` —
  `javascript:` targets never become anchors). Every block element carries
  `dir="auto"` so mixed Arabic/English notes read correctly; paragraph lines
  join with `<br>`. Supported blocks: h1–h3, unordered/ordered lists,
  blockquotes, rules, paragraphs.
- Store API (`notes` in store.ts): add/update/remove follow the habits
  pattern (soft delete via `deletedAt`). Deleting a note shows a toast with
  undo.
- Page: search box + new-note form; rows show title, a one-line body preview,
  a linked-task chip and updatedAt. Expanding a row opens the editor with a
  write/preview toggle (preview renders `mdToHtml` through child-selector
  styling — links, lists, blockquotes) and a linked-task select over live
  tasks.
- ⌘K palette: "New note" sets sessionStorage `tilth.new-note`, routes to
  /notes, and the page opens the new-note form (flag cleared on read).
- Note templates live in `src/lib/templates.ts` (templates.test.ts):
  `NOTE_TEMPLATES` is four hand-written bilingual templates (study, freelance,
  content plan, Ramadan). The Arabic and English copy were written separately
  for their locale — never machine-translated, never one skeleton with two
  word swaps. `templateFor(id, locale)` returns the locale's copy or null for
  unknown ids. The new-note form shows template chips that fill title + body
  in one tap.
- The bottom nav shows 8 tabs (every section except rewards).

## Calendar page (/calendar)

- PURE engine in `src/lib/weekView.ts` (weekView.test.ts):
  `weekDays(anchor, weekStartsOn)` returns the anchored week's seven LocalDays,
  oldest first (Monday start for weekStartsOn 1; Saturday — the Arabic
  default — for 6). `buildWeek` buckets tasks by their STORED `dueDate` only,
  counts habits via `isScheduledOn`, and sums PLANNED minutes of completed
  non-break sessions by their stored localDay (the workMinutesToday
  convention, not wall-clock elapsed time). Soft-deleted tasks, undated
  tasks, archived habits and incomplete sessions never reach a cell. Every
  cell works on stored LocalDay strings — a record's day is never recomputed.
- Page: `anchor` state (null = the current week, so the Today button is
  disabled then); prev/next chevrons (`rtl-flip`) step whole weeks. The grid
  is `grid-cols-4 sm:grid-cols-7` with weekday headers from `weekdayOf`;
  per-cell counts render only when nonzero, always through `formatNumber`.
  Tapping a cell opens a DayDetail panel below: the day's tasks with priority
  dots (done = line-through), habits done/scheduled and focus minutes — or
  the "nothing scheduled" line. An empty week shows the empty state, never
  a fake grid.

## Quiet digest (My Day)

- PURE engine in `src/lib/digest.ts` (digest.test.ts): `morningDigest` =
  open tasks due today, overdue, habits due (via `isScheduledOn`), and
  `firstTask` (priority, then dueDate, then createdAt). `eveningDigest` =
  `completedToday` (done tasks grouped by `toLocalDay(completedAt,
  dayStartHour, timeZone)` — the same convention as the insights engine),
  `habitsDone` (scheduled-today habits with a done log), `focusMinutes`
  (planned minutes of completed non-break sessions stored today),
  `stillOpen` (open due ≤ today) and `tomorrowOpen` (due tomorrow).
  `digestFor` picks the morning digest before 17:00 and the evening digest
  from 17:00.
- `settings.digest` is an ADDITIVE OPTIONAL field — `DigestPrefs`
  (enabled, morningAt/eveningAt "HH:MM") — so no schema bump (the
  additive-optional rule in Data rules). Absent = off.
- Silence is the default: the digest exists only if the user turns it on
  in Settings → Notifications. Delivery is the local Notification API,
  while the app is open — there is no push server and none is planned
  (Tilth is local-first). Without permission the toggle row shows an
  explicit allow button; denied shows a warning.
- AppShell effect: a 60 s interval fires AT MOST once per slot per day;
  localStorage `tilth.digest` (slot → day) is a tiny UI pref, not app
  data. Slot times are the user's morningAt/eveningAt; morning applies
  before 17:00. Notifications carry a tag so a repeat replaces, never
  stacks.
- The dashboard renders the same digest under the title as a plain text
  line (greeting + counts) — the summary is visible with notifications
  off entirely.

## Command palette & shortcuts (⌘K)

- Palette entries never mutate the store directly. Capture entries set a
  sessionStorage flag and navigate; the target page consumes it on mount
  and clears it on read: `tilth.new-task` (/tasks, focuses quick add),
  `tilth.new-note` (/notes, opens the new-note form), `tilth.new-habit`
  (/habits, opens the new-habit form). Instant entries: toggle language
  (ar ↔ en) and toggle theme (dark ↔ light).
- Settings documents ONLY shortcuts that are wired in code today:
  Ctrl/⌘ K (palette), Space (focus start/pause), Esc (cancel/close
  dialogs). Never list a shortcut that does not exist.

## Dashboard (/)

- Cards are pure math in `src/lib/dashboard.ts` (`todaysPriorities`,
  `upcomingDeadlines`, `habitsDueToday`, `dailyProgress`) over stored
  LocalDay strings vs `todayLocal()` — a record's day is never recomputed.
  Each card shows/hides via `settings.dashboardCards`; when all are off
  the page says so and links to Settings.
- Priorities: open tasks due today or overdue — priority first, then earlier
  dates — with one-tap `tasks.complete` and a toast. Deadlines: open tasks
  due within the next 7 days (today excluded). Habits: scheduled today with a
  one-tap done toggle (`habits.log` / `habits.unlog` for today only).
- Daily progress ring: (tasks due today that are done + habits due today that
  are done) / (tasks due today + habits due today). `dailyProgress` returns
  ratio null when nothing is due today — the UI shows a friendly state, never
  a divide by zero. Scope note: both sides are today's plate only, so the ring
  stays within 0..1; completing an overdue task does not move it.
- Focus card: `workMinutesToday` (completed work sessions, breaks excluded)
  vs `settings.dailyFocusTargetMinutes`.
- The Level card shows live level, XP progress, today XP vs `DAILY_XP_CAP` and
  coins via `totalsFromLedger` / `xpAwardedOnDay` (`src/lib/rewards.ts`); the
  achievements card lists the latest unlocks via `latestUnlocks`
  (`src/lib/achievements.ts`). The dashboard never writes `xpLedger`.
- First run (no tasks, no habits, no focus sessions) shows a welcome panel
  linking to /tasks and /habits. All cards are skeletons until `ready`.

## Rewards engine (`src/lib/rewards.ts`)

- PURE engine: `awardXp` / `revokeXp` / `totalsFromLedger` take the
  ledger and return results; they never touch the store, `Date.now()` or
  localStorage. All tunables (XP per source, `DAILY_XP_CAP`, coin ratio, task
  minimum age, level curve) live in `src/lib/rewardsConfig.ts` — change values
  there, never in the engine.
- XP and coins are DERIVED from the `xpLedger` — no running totals anywhere.
  Entry identity is (sourceType, sourceId, localDay): at most one live entry per
  identity. XP is never spent; only coins are (shop entries: xp 0, negative coins).
  Award entries carry coins: 0 — the balance is
  floor(total positive XP / `COINS_PER_XP`) plus every entry coins value,
  so odd XP remainders are never lost per-entry.
- Level curve convention (single source of truth):
  `xpForLevel(n) = round(100 * n^1.5)` is the PER-STEP cost to advance from
  level n to level n+1 — NOT cumulative. Total XP to reach level L is
  `totalXpForLevel(L)` = sum of steps 1..L-1 (level 1 starts at 0 XP).
- Wiring: ONE service function, `applyRewardEvent` in `src/lib/store.ts`,
  is the only caller of the engine — hooked into `tasks.complete` /
  `tasks.reopen`, `habits.log` / `habits.unlog` and `focus.end`.
  Pages and components never call the engine and never write `xpLedger`.
  Undo paths revoke (soft-delete the entry), so complete -> undo -> redo can
  never award twice for one final state.
- Guardrails (all tested in `rewards.test.ts`): daily XP cap per stored localDay
  with exact partial awards at the boundary; a task completed within
  `TASK_MIN_AGE_MS` (2 min) of the instance creation earns 0 — recurring
  instances measure from their spawn time; habits pay once per localDay;
  focus XP only for completed work sessions (breaks and early stops give 0).
  Awards always use the localDay stored on the event, never a recomputed now,
  so clock edits cannot re-open a capped day.
- Honest limits: these rules are a guardrail against self-cheating and double
  awards, NOT security — the ledger lives in the browser and import can
  overwrite it.

## Achievements & challenges (`src/lib/achievements.ts`, `src/lib/challenges.ts`)

- Both are PURE: predicates and progress functions take a state slice
  assembled by `progressState()` in store.ts and never touch the store,
  Date.now() or localStorage.
- Validated-data rule (exploit guard, documented per definition in
  achievements.ts): predicates read only data the rewards engine already
  validated. A completed task is a LIVE `xpLedger` entry with sourceType
  "task" (instant completions have no entry and count for nothing), a habit
  done-log is a live "habit" entry, focus achievements count only completed
  work sessions, levels come from `totalsFromLedger`, backups from
  `meta.lastExportedAt`, purchases from live "shop" entries (the
  /rewards shop). Honest limits: a guardrail against self-cheating, NOT
  security.
- Unlocks are stored ONCE in the `achievements` collection (achievementId +
  unlockedAt + localDay; schema v2 with migration). `evaluateAchievements`
  returns only new ids, in definition order. The AppShell toasts fresh
  unlocks; /rewards shows the gallery with progress numbers where
  measurable; the dashboard achievements card shows the latest 3 via
  `latestUnlocks`.
- Challenge selection is deterministic: 3 of 7 daily by localDay, 2 of 5
  weekly by week start (FNV-1a hash of seed:id, stable sort, pool order
  restored). Same day, same set.
- Challenge bonuses are COINS-ONLY ledger entries: sourceType "challenge",
  sourceId = challenge id, localDay = period anchor (today / week start),
  xp 0, positive coins (`DAILY_CHALLENGE_COINS` / `WEEKLY_CHALLENGE_COINS`
  in rewardsConfig.ts). Zero XP means bonuses NEVER count toward
  `DAILY_XP_CAP` and never advance levels; the ledger identity rule grants
  once per challenge per period. Undoing the underlying actions keeps the
  bonus but can never re-grant.
- Wiring: ONE checkpoint, `applyBonusChecks()` in store.ts — called at the
  end of `applyRewardEvent`, after an export stamp (metaActions.update with
  lastExportedAt) and once at the end of `bootStore`, after shop buys and
  refunds. Pages and components
  never write unlocks or bonuses, and never call the engine directly.

## Shop (`src/lib/shop.ts`)

- Shop items are USER-DEFINED rewards (name, optional note, price in
  coins) in the `shopItems` collection; the shop panel lives on /rewards.
- Buying writes TWO records through the store (`shop` actions in
  store.ts): a `purchases` row (name and price snapshotted at buy time,
  so deleting the item never rewrites history) and a coins-only ledger
  entry (sourceType "shop", sourceId = the purchase id, xp 0,
  coins = -price). The ledger stays the ONLY source of the balance, so a
  refund is just a soft-delete of that entry.
- Idempotency: every purchase gets a unique id (`crypto.randomUUID()`);
  while a purchase of the same item from the same localDay is unused,
  the next buy of that item is denied ("pending-today") — rapid
  double-taps buy exactly once.
- The balance is checked before every buy: it can never go negative.
- Refunds: same localDay and unused only. "Used" (usedAt) is the user
  redeeming the purchase themselves; a used or refunded purchase can be
  bought again the same day.
- The firstPurchase achievement now counts live shop entries.
  `applyBonusChecks()` also runs after shop buys and refunds.

## Accent themes (`src/lib/themes.ts`)

- 5 accents (moss/sage/pine/clay/dusk) are HUE sets: src/styles.css
  derives every accent token from --accent-hue, and [data-accent=...] rules
  swap it (moss is the default, no rule). The hue table in themes.ts MUST
  stay in sync with those CSS rules; themes.test.ts pins WCAG AA contrast
  for the derived pairs — all 5 accents pass in light and dark (dusk dark
  is the tightest, ~4.8:1).
- Unlock rules live in THEME_UNLOCKS (rewardsConfig.ts): moss default,
  sage level 3, pine streakSeven, clay firstPurchase, dusk level 10.
  Locked themes show their condition; resolveAccent falls back to moss
  for legacy or re-locked values.
- The chosen accent is app data (settings.accent, schema v3 with
  migration), mirrored into the tilth.prefs localStorage key and applied
  by AppShell (resolveAccent with the live level + unlocks). Accent
  changes are color-only — no layout shift on load or switch.

## Insights page (/insights)

- PURE engine in `src/lib/insights.ts` (insights.test.ts): three daily
  series — taskCompletionsByDay (done tasks grouped by the toLocalDay of
  completedAt, honoring settings.dayStartHour), habitConsistencyByDay
  (done / (scheduled - skipped) per day; skipped days leave the
  denominator; null when nothing scheduled — the consistency30
  convention), focusMinutesByDay (ACTUAL minutes of completed non-break
  sessions by their stored localDay) — plus windowDays and insightsReport,
  the observations engine.
- Observations are honest claims with data floors: the report window is
  ACTIVE_WINDOW_DAYS (28) and no claim appears below MIN_ACTIVE_DAYS (14
  days with any live activity: a ledger entry, a completed task, a habit
  log or a focus session). Per-claim minimums: 10 completed tasks for the
  time-of-day claim, 6 completed work sessions on 3+ weekdays for the
  best-focus-day claim, 3 skips of one live habit for the most-skipped
  claim. Below the floor the page shows a friendly "keep going" line and
  NO claim; every claim renders its basis ("based on N events over D
  active days") so the numbers are checkable. Time-of-day buckets use
  the wall-clock hour in the active timezone (morning < 12, afternoon
  12-16, evening >= 17); a claim needs a >= 40% share that strictly
  beats the runner-up bucket.
- RTL: recharts does NOT mirror itself. The page passes reversed to XAxis,
  moves YAxis to the right in Arabic, mirrors the target-line label
  position, and routes every number, tick and date through Intl in the
  active locale (ar-EG uses Arabic-Indic digits).
- Accessibility: each chart container is role="img" with an aria-label
  built from the same totals/average summary line shown under the chart;
  the page keeps the skeleton-then-content pattern (SSR emits the
  skeleton, so recharts never renders on the server).
- Charts use CSS token fills (var(--color-primary) etc.) so accent themes
  recolor them with no chart-side changes.
- seedSampleData (dev-only) now plants three weeks of history — done
  tasks with morning/afternoon completion hours, daily habit logs with a
  few Exercise skips, focus sessions and two sample notes (one English
  Markdown welcome, one pinned Arabic week plan) — so the charts, all
  three observations and the notes page render right after seeding.

## SSR constraints (Cloudflare Workers / workerd)


- The production runtime is workerd (Lovable hosting). Node dev/build/tests will
  happily accept code that workerd rejects. Never call `crypto.randomUUID()`,
  `Math.random()`, `setTimeout`, or async I/O at module top level in any file
  reachable from the SSR bundle — workerd forbids them in global scope and the
  whole app 500s. Generate values lazily inside functions (see `tabId()` in
  `src/lib/store.ts`).
- The `workerd-smoke` CI job builds the app, serves it with wrangler (workerd),
  and requires 200 from `/` and `/settings`. Keep it passing; it is the only
  gate that runs the real production runtime.

## CI & tooling notes

- CI on main runs two jobs: "typecheck and tests" (tsc --noEmit, vitest run,
  eslint) and "workerd SSR smoke (production runtime)". A phase gate closes
  only when BOTH are green on the GREEN commit.
- routeTree.gen.ts is normally written by @tanstack/router-plugin at
  dev/build time. When a route is added without running a dev server it is
  edited BY HAND: import the route file, add the Route const in the
  plugin's exact `as any` style, and append it to the parent's children.
  Match the generator's byte style; the file is diffed against the parent
  before pushing.
- Never retype or copy file text from a browser/proxy render as a push
  base — hard line-wraps corrupt it. Base edits on the get_file_contents
  transcription or the locally authored file from the session that wrote
  it, and diff against the parent before pushing.
- RED specs are code: hand-trace every fixture against the engine before
  declaring GREEN. Example: weekView.test.ts indexed the anchored Tuesday
  at cells[2], but weekDays(TUE, 1) starts Monday so the anchor sits at
  cells[1] — the TEST was wrong, the engine was right (fixed in b066ab3).

## PWA (offline & install)

- Installable PWA: vite-plugin-pwa (generateSW) precaches the app shell and all
  self-hosted fonts/assets. Offline works only in the published app — dev,
  localhost and Lovable preview hosts never register a service worker
(see `shouldRegisterPwa` in `src/lib/pwa.ts`).
- SPA mode: `tanstackStart({ spa: { enabled: true } })` — the build
  prerenders the root route to `/_shell.html` and rewrites 404 navigations to it,
  so a hard refresh offline works on every route. SSR is off at runtime, but the
  prerender step still executes the root route at build time, so the workerd
  module-top-level rules above still apply.
- The service worker serves `_shell.html` as the navigation fallback
  and precaches js/css/woff2/svg/png/ico/webmanifest. New versions show a
  reload banner (`registerPwa` / `applyUpdate` in
  `src/lib/pwa.ts`); the reload is always user-approved and the
  banner never reloads while a focus session is active.
- Registration is wrapped in `registerPwa()` — the ONLY place that touches
  `navigator.serviceWorker`. It skips dev (`import.meta.env.DEV`),
  localhost/127.0.0.1, hosts containing `--`, and `*.lovable.dev`.
- Manifest lives in the VitePWA options in `vite.config.ts`: standalone,
  `start_url: "/"`, dark theme colors, `dir: "rtl"`,
  `lang: "ar"`. Icons are SVG only
  (`public/icons/icon.svg` + `maskable.svg`, declared as 192/512
  any + maskable) because binary pushes corrupt; iOS ignores SVG manifest icons, so
  iOS home-screen installs fall back to a screenshot — accepted limitation for now.
- The /settings install button uses `beforeinstallprompt` and
  `isStandalone()`; browsers without the event show a hint instead.
- CI probes `/`, `/settings`, `/sw.js`,
  `/manifest.webmanifest` and `/_shell.html` under workerd (workerd-smoke
  job). Keep them all at 200.

## Backups & import (src/lib/backup.ts, src/lib/exportZip.ts, src/lib/zip.ts)

- One-press export (Settings → Export data) writes a ZIP:
  `tilth-export-YYYY-MM-DD.zip` containing `tilth-backup.json` (the importable
  envelope below), `tasks.csv` (UTF-8 with BOM, one row per task) and one
  `notes/<id>.md` Markdown file per live note (pinned first). The archive is
  byte-deterministic for the same snapshot + timestamp. `zip.ts` is a
  hand-rolled STORE-method writer (CRC-32, UTF-8 names) — no new dependencies.
  Soft-deleted notes stay in the JSON backup only.
- Export envelope: `{ schemaVersion, exportedAt, data: <full snapshot> }`.
  Every export stamps `meta.lastExportedAt` (drives the 7-day backup
  reminder on /settings).
- Import stays JSON-only and validates BEFORE any write: `parseBackup` is
  pure (rejects newer schemaVersion, migrates older ones, returns counts);
  `importSnapshot` (store.ts) only runs after the user confirms replace. A
  rejected file never touches existing data.
