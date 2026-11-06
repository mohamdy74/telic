import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { PreferencesProvider, usePrefs } from "@/components/app/preferences";
import { AppShell } from "@/components/app/AppShell";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { bootStore } from "../lib/store";

function NotFoundComponent() {
  const { t } = usePrefs();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t.notFound}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.notFoundBody}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t.goHome}
          </Link>
        </div>
      </div>
    </div>
  );
}

/* Deliberately NOT localized: this is the crash boundary — the failure can be
 * inside the preferences provider itself, so it must render with zero context. */
function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Tilth — Make room for what matters" },
      { name: "description", content: "An offline-first home for your tasks, habits, focus and progress." },
      { property: "og:title", content: "Tilth — Make room for what matters" },
      { property: "og:description", content: "An offline-first home for your tasks, habits, focus and progress." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      // Suppress the browser's "Translate page?" popup — the app ships its own
      // EN/AR dictionary, and machine translation corrupts the typed UI copy.
      { name: "google", content: "notranslate" },
      { name: "theme-color", media: "(prefers-color-scheme: light)", content: "#f8f7f1" },
      { name: "theme-color", media: "(prefers-color-scheme: dark)", content: "#1d160e" },
          ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      // PNG first, SVG last (the DOWNFORCE order): engines that take the last
      // supported icon (Chrome/Firefox) use the small SVG; engines without SVG
      // favicon support fall back to the PNG. favicon.png is materialized at
      // build time by scripts/decode-icons.mjs.
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "icon", href: "/icons/icon.svg", type: "image/svg+xml" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" translate="no" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Boot the store AFTER hydration so SSR HTML matches the client. Pages show a
  // skeleton until the store's `ready` flag flips true.
  useEffect(() => {
    void bootStore();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <PreferencesProvider>
        <AppShell>
          <Outlet />
        </AppShell>
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
