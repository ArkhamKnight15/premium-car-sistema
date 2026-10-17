import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-lg border border-ink-700 bg-ink-925 px-3 text-sm text-ink-100 placeholder:text-ink-500 transition-colors " +
  "focus:border-brand-500/70 focus:outline-none focus:ring-2 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(field, "h-10", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 3, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(field, "py-2 leading-relaxed", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(field, "h-10 pr-8", className)} {...props}>
      {children}
    </select>
  );
});

export function Label({ htmlFor, children, required, className }: { htmlFor?: string; children: ReactNode; required?: boolean; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink-400", className)}>
      {children}
      {required ? <span className="ml-0.5 text-brand-400" aria-hidden>*</span> : null}
    </label>
  );
}

export function Checkbox({ name, label, hint, defaultChecked, value = "on", disabled }: {
  name: string; label: ReactNode; hint?: ReactNode; defaultChecked?: boolean; value?: string; disabled?: boolean;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-sm text-ink-300", disabled && "cursor-not-allowed opacity-60")}>
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} disabled={disabled} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand-500)]" />
      <span>
        {label}
        {hint ? <span className="mt-0.5 block text-xs text-ink-500">{hint}</span> : null}
      </span>
    </label>
  );
}
