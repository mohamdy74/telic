import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

/**
 * The single app dialog (audit TIL-F03): previously three hand-copied modals
 * (tasks.tsx, focus.tsx, settings.tsx) each re-implemented focus trapping,
 * scroll-locking, Escape and click-outside. Radix Dialog provides all of it —
 * trap, restore-focus to the opener, aria-modal — with zero app-side code to
 * drift. Conditional rendering mirrors the old API: render <Modal/> only when
 * open.
 */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="animate-fade fixed inset-0 z-50 bg-overlay" />
        <Dialog.Content
          // flex centering (not translate) so the panel behaves in RTL without
          // physical transforms; px-4 gutter matches the previous modals.
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-4 py-8"
        >
          <div className="animate-pop w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-elevated outline-none">
            <Dialog.Title className="sr-only">{title}</Dialog.Title>
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
