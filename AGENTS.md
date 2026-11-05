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
