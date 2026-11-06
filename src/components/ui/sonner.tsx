import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          // Pill parity with the hand-rolled toasts this replaces — one look,
          // one lifetime, everywhere (audit TIL-F04).
          toast:
            "group toast group-[.toaster]:w-fit group-[.toaster]:max-w-[90vw] group-[.toaster]:rounded-full group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:bg-card group-[.toaster]:px-4 group-[.toaster]:py-2 group-[.toaster]:text-sm group-[.toaster]:text-foreground group-[.toaster]:shadow-elevated group-[.toaster]:font-sans",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-transparent group-[.toast]:text-primary group-[.toast]:font-semibold group-[.toast]:shadow-none group-[.toast]:hover:bg-accent/40 group-[.toast]:rounded-md",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
