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

## Architecture (Grove)

- Structure: `src/routes/*` = pages (one per module, own `head()`); `src/components/app/*` = shell, nav, preferences provider; `src/lib/*` = pure logic (i18n, future domain engines) with colocated `*.test.ts`.
- Offline-first: no backend/accounts; app data will live on-device (IndexedDB). Never use localStorage for app data (only tiny UI prefs like locale/theme).
- All user-facing strings go through the typed dictionary in `src/lib/i18n.ts`; plurals via `plural()` (Intl.PluralRules), numbers/dates via Intl helpers. No string concatenation.
- RTL: use CSS logical properties / Tailwind logical utilities (ps/pe, ms/me, start/end, text-start). Directional icons get `rtl-flip`. `<html dir/lang>` is set in an effect.
- No hardcoded colors in components; all colors are oklch tokens in `src/styles.css`. Accent is driven by `--accent-hue` so themes can swap it.
- Fonts are self-hosted via @fontsource (no CDN) so they work offline.

## Data rules (schema v1)

- `localDay` is stored at creation time and never recomputed afterwards. A record's
  localDay must survive later changes of timezone or `dayStartHour`.
- `meta.schemaVersion` is 1 (`CURRENT_SCHEMA_VERSION` in `src/lib/types.ts`). Any
  stored-shape change bumps it and adds one entry to the ordered `migrations`
  array in `src/lib/migrations.ts` (index = from-version); migrations run on boot
  and on import.
- Storage keys: one IndexedDB key per collection — `tasks`, `habits`,
  `habitLogs`, `focusSessions`, `xpLedger`, `settings`, `meta` (idb-keyval store
  "grove"). Writing one collection never rewrites the others; writes are
  debounced (250 ms) and flushed on tab hide.
- The store boots client-side AFTER hydration (`bootStore()` effect in
  `__root.tsx`), so SSR HTML matches the client. UI must render a skeleton until
  `ready` is true.
- Multi-tab: `BroadcastChannel("grove-sync")` + per-key rev counters; concurrent
  writes merge per record by `updatedAt` (`src/lib/storage/persistence.ts`).
- IDs are `crypto.randomUUID()`; every record carries ISO `createdAt`/`updatedAt`;
  deletion is soft (`deletedAt`) wherever undo matters.
- Recurrence is a stored rule on the task; only the NEXT instance is generated
  on completion (`tasks.complete`) — never pre-generate instances.
- `/settings` is a temporary debug page (store status + dev-only seed); the real
  settings UI comes later.

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
