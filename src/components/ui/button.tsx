import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Focus indicator intentionally omitted: the global :focus-visible outline in
  // styles.css is the single focus-ring mechanism (audit TIL-F05).
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground font-semibold hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground font-semibold hover:bg-destructive/90",
        // border-border (not input) + accent/40 hover — the exact language the routes
        // already shipped; the old full-accent hover fill read as a "selected" state.
        outline: "border border-border bg-background text-foreground hover:bg-accent/40",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

/**
 * Canonical class sets for contexts where a <Button> component cannot be used
 * (e.g. router <Link>). Generated from the same cva variants — routes must
 * import these instead of re-declaring local button strings (audit TIL-F02).
 */
export const PRIMARY_BTN = cn(buttonVariants({ variant: "default" }));
export const OUTLINE_BTN = cn(buttonVariants({ variant: "outline" }));
export const DANGER_BTN = cn(buttonVariants({ variant: "destructive" }));

export { Button, buttonVariants };
