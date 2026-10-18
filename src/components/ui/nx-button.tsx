import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-brand text-primary-foreground shadow-glow hover:brightness-110",
  secondary: "glass text-foreground hover:bg-accent",
  ghost: "text-muted-foreground hover:text-foreground hover:bg-secondary",
  danger: "bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25",
} as const;
const sizes = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  icon: "h-9 w-9",
} as const;

export interface NxButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export const NxButton = forwardRef<HTMLButtonElement, NxButtonProps>(
  ({ variant = "secondary", size = "md", className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
NxButton.displayName = "NxButton";
