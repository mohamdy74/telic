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
- Offline-first: no backend/accounts; app data will live on-device (IndexedDB). Never use localStorage for app data (only tiny UI prefs like locale/theme).
- All user-facing strings go through the typed dictionary in `src/lib/i18n.ts`; plurals via `plural()` (Intl.PluralRules), numbers/dates via Intl helpers. No string concatenation.
- RTL: use CSS logical properties / Tailwind logical utilities (ps/pe, ms/me, start/end, text-start). Directional icons get `rtl-flip`. `<html dir/lang>` is set in an effect.
- Arabic-first: Arabic is the DEFAULT locale; SSR renders `<html lang="ar" dir="rtl">` and English users flip in a hydration effect. Arabic copy is natural MSA, never literal translations. `src/styles.css` raises Arabic line-height and zeroes letter-spacing under `[dir="rtl"]` (see the `:lang(ar)` rules).
- No hardcoded colors in components; all colors are oklch tokens in `src/styles.css`. Accent is driven by `--accent-hue` so themes can swap it.
- Fonts are self-hosted via @fontsource (no CDN) so they work offline.

## Data rules (schema v1)

- `localDay` is stored at creation time and never recomputed afterwards. A record's
  localDay must survive later changes of timezone or `dayStartHour`.
- `meta.schemaVersion` is 1 (`CURRENT_SCHEMA_VERSION` in `src/lib/types.ts`). Any
  stored-shape change bumps it and adds one entry to the ordered `migrations`
  array in `src/lib/migrations.ts` (index = from-version); migrations run on boot
  and on import. Exception: ADDITIVE OPTIONAL fields (absent in old records,
  defaulted on read) do not bump the version — e.g. `Task.seriesId`, `FocusSession.pausedAt`.
- Storage keys: one IndexedDB key per collection — `tasks`, `habits`,
  `habitLogs`, `focusSessions`, `xpLedger`, `settings`, `meta` (idb-keyval store
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
- Real pages so far: `/settings`, `/tasks`, `/habits`.
  Dashboard, focus, rewards and insights are still placeholders. The settings
  store-status panel is debug-only.

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
  `xpLedger` — the rewards engine will subscribe to completion later.
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
  writes `xpLedger` — the rewards engine will subscribe to completion later.
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
- The focus UI NEVER writes `xpLedger` — the rewards engine will
  subscribe to completed sessions later.

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

## Backups & import (src/lib/backup.ts)

- Export envelope: `{ schemaVersion, exportedAt, data: <full snapshot> }`;
  filename `tilth-export-YYYY-MM-DD.json`. Every export stamps
  `meta.lastExportedAt` (drives the 7-day backup reminder on /settings).
- Import validates BEFORE any write: `parseBackup` is pure (rejects newer
  schemaVersion, migrates older ones, returns counts); `importSnapshot`
  (store.ts) only runs after the user confirms replace. A rejected file never
  touches existing data.
