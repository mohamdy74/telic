/*
 * Guarded PWA registration. Offline works only in the published app:
 * dev servers, localhost and Lovable preview hosts never register a
 * service worker, so a stale SW can never cache a preview build.
 *
 * This module is reachable from the app shell (SSR/prerender), so it must
 * keep zero side effects at module top level — everything runs in
 * functions called from client effects.
 */

type Cleanup = () => void;

/** Dev and preview hosts that must never register the service worker. */
function isDevHost(host: string): boolean {
  return (
    host === "localhost" ||
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]") ||
    host.includes("--") || // Lovable preview build URLs
    host.endsWith(".lovable.dev")
  );
}

/** True only in the published production app, with service worker support. */
export function shouldRegisterPwa(): boolean {
  if (import.meta.env.DEV) return false;
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  return !isDevHost(window.location.hostname);
}

/**
 * Registers /sw.js and calls onNeedRefresh once a new version is installed
 * and waiting behind the active one. Reload is always user-approved
 * (applyUpdate); the UI must never auto-reload while a focus session runs.
 */
export function registerPwa(onNeedRefresh: () => void): Cleanup {
  if (!shouldRegisterPwa()) return () => undefined;
  let reg: ServiceWorkerRegistration | null = null;

  const notifyIfWaiting = () => {
    if (reg && reg.waiting && reg.active) onNeedRefresh();
  };

  const onVisible = () => {
    if (reg) void reg.update().then(notifyIfWaiting);
  };

  const start = () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((r) => {
        reg = r;
        notifyIfWaiting();
        r.addEventListener("updatefound", () => {
          const sw = r.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed") notifyIfWaiting();
          });
        });
      })
      .catch(() => {
        /* offline is best effort; never break the app over the SW */
      });
  };

  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
  document.addEventListener("visibilitychange", onVisible);
  return () => document.removeEventListener("visibilitychange", onVisible);
}

/**
 * User-approved update: tell the waiting worker to skip waiting, then
 * reload exactly once when it takes control of the page.
 */
export function applyUpdate(): void {
  const onControllerChange = () => window.location.reload();
  navigator.serviceWorker.addEventListener("controllerchange", onControllerChange, { once: true });
  void navigator.serviceWorker.getRegistration("/").then((r) => {
    r?.waiting?.postMessage({ type: "SKIP_WAITING" });
  });
}

/** True when running as an installed app (standalone display). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const iOS = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || iOS;
}
