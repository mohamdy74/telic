import { NAV, type NavKey } from "./nav";
import { usePrefs } from "./preferences";
import type { ReactNode } from "react";

export function PagePlaceholder({ page, children }: { page: NavKey; children?: ReactNode }) {
  const { t } = usePrefs();
  const Icon = NAV.find((n) => n.key === page)!.icon;
  const copy = t.pages[page];
  return (
    <section>
      <p className="mb-2 text-sm font-medium text-primary">{t.nav[page]}</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{copy.title}</h1>
      <div className="empty-card mt-8">
        <span className="grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
          <Icon className="size-6" aria-hidden />
        </span>
        <p className="max-w-sm text-muted-foreground">{copy.body}</p>
        {children ?? <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">{t.comingSoon}</span>}
      </div>
    </section>
  );
}
