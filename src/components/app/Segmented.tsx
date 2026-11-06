import { useRef, type MutableRefObject } from "react";

export type SegmentOption = { value: string; label: string; icon?: React.ReactNode };

/**
 * The single segmented control for every view/toggle switcher (audit
 * TIL-F13). Previously three identical copies (tasks/focus/habits) plus an
 * inline one in notes — all Tab-only. This one is APG-complete: arrows move
 * selection directly (physical ArrowRight = forward, ArrowLeft = back —
 * correct in both LTR and RTL), Home/End jump to the edges, and roving
 * tabindex keeps one tab stop per group.
 */
export function Segmented({
  options,
  value,
  onChange,
  label,
}: {
  options: SegmentOption[];
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const refs: MutableRefObject<Array<HTMLButtonElement | null>> = useRef([]);
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const choose = (i: number) => {
    const clamped = (i + options.length) % options.length;
    refs.current[clamped]?.focus();
    onChange(options[clamped]!.value);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const current = options.findIndex((_, i) => refs.current[i] === document.activeElement);
    const from = current === -1 ? activeIndex : current;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      choose(from + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      choose(from - 1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      choose(from + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      choose(from - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      choose(0);
    } else if (e.key === "End") {
      e.preventDefault();
      choose(options.length - 1);
    }
  };

  return (
    <div className="segmented m-0" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          tabIndex={value === o.value ? 0 : -1}
          onClick={() => onChange(o.value)}
          className="segment"
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
