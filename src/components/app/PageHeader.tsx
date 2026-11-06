import type { ReactNode } from "react";

/**
 * The single page header for every route (audit TIL-F14). One optional
 * context line replaces the old eyebrow — on Today it also carries the
 * greeting/digest, ending the five-line header stack. The lede is gated by
 * the call site: it teaches on first run instead of taxing every visit.
 */
export function PageHeader({
  context,
  title,
  lede,
}: {
  context?: ReactNode | undefined;
  title: string;
  lede?: string | undefined;
}) {
  return (
    <header className="mb-6">
      {context ? (
        <p className="mb-1.5 flex flex-wrap items-baseline gap-x-2 text-balance text-sm text-muted-foreground">
          {context}
        </p>
      ) : null}
      <h1 className="max-w-[24ch] text-balance font-display text-3xl font-semibold tracking-tight md:text-4xl">
        {title}
      </h1>
      {lede ? <p className="mt-2 max-w-prose text-muted-foreground">{lede}</p> : null}
    </header>
  );
}
