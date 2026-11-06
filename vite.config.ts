// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

// Build-time revision for the SPA shell (the shell itself is not content-hashed),
// so the service worker knows when the offline fallback changed.
const SHELL_REVISION = String(Date.now());

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // SPA mode (no SSR at runtime): the build prerenders the root route to /_shell.html
    // and the server rewrites 404 navigations to it, so a hard refresh offline works on
    // every route. Offline works only in the published app.
    spa: { enabled: true },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "prompt",
        // Registration is manual and guarded in src/lib/pwa.ts (never in dev or preview).
        injectRegister: false,
        includeAssets: ["favicon.png"],
        manifest: {
          name: "Tilth",
          short_name: "Tilth",
          description: "An offline-first home for your tasks, habits, focus and progress.",
          start_url: "/",
          scope: "/",
          display: "standalone",
          background_color: "#1d160e",
          theme_color: "#1d160e",
          lang: "ar",
          dir: "rtl",
          // Real PNG icons only (the DOWNFORCE pattern): SVG manifest icons
          // never render in Android's WebAPK nor on the iOS home screen, so an
          // installed app showed a screenshot instead of the Tilth logo. The
          // PNGs are materialized into public/icons/ at build time from
          // scripts/icons.base64.json (see scripts/decode-icons.mjs).
          icons: [
            { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            {
              src: "icons/icon-maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          navigateFallback: "_shell.html",
          globPatterns: ["**/*.{js,css,woff2,svg,png,ico,webmanifest}"],
          // Manifest/home-screen icons are fetched by the OS browser in its
          // own context at install time — it never consults this service
          // worker's cache, so precaching them is dead weight (DOWNFORCE
          // lesson).
          globIgnores: ["icons/*.png"],
          additionalManifestEntries: [{ url: "_shell.html", revision: SHELL_REVISION }],
          cleanupOutdatedCaches: true,
          skipWaiting: false,
          clientsClaim: true,
        },
      }),
    ],
  },
});
