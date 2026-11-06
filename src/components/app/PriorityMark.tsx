import type { Priority } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Non-color priority encoding (audit TIL-F16): priority was a lone color dot —
 * invisible to color-blind users and, at "low", rendered at 50% alpha (~2.3:1).
 * Bars carry the level by count (1/2/3), full alpha every time; the tone stays
 * as a color hint, never the only signal. Pass the localized priority label so
 * the mark is announced correctly.
 */
export function PriorityMark({ priority, label }: { priority: Priority; label: string }) {
  const bars = priority === "high" ? 3 : priority === "medium" ? 2 : 1;
  const tone =
    priority === "high"
      ? "text-destructive"
      : priority === "medium"
        ? "text-primary"
        : "text-muted-foreground";
  return (
    <span
      className={cn("inline-flex shrink-0 items-end gap-[2px]", tone)}
      role="img"
      aria-label={label}
      title={label}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            "w-[3px] rounded-[1px] bg-current",
            i < bars ? "opacity-100" : "opacity-25",
          )}
          style={{ height: `${5 + i * 3}px` }}
        />
      ))}
    </span>
  );
}
