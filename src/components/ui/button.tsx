import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type Size = "xs" | "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-500 text-ink-950 hover:bg-brand-400 shadow-[0_6px_18px_-10px_rgba(243,96,32,0.8)]",
  secondary: "border border-ink-700 bg-ink-850 text-ink-100 hover:border-ink-600 hover:bg-ink-800",
  outline: "border border-brand-500/40 text-brand-300 hover:bg-brand-500/10",
  ghost: "text-ink-300 hover:bg-ink-800 hover:text-ink-100",
  danger: "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20",
};
const SIZES: Record<Size, string> = {
  xs: "h-7 gap-1 px-2 text-xs",
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-11 gap-2 px-5 text-sm",
};

export const buttonClass = (variant: Variant = "primary", size: Size = "md", className?: string) =>
  cn(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg font-semibold transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950",
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
    VARIANTS[variant],
    SIZES[size],
    className,
  );

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "primary", size = "md", className, type = "button", ...props }, ref) {
  return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...props} />;
});
