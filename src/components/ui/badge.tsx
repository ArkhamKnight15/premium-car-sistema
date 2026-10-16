import type { ReactNode } from "react";
import type { Tone } from "@/lib/constants";
import { cn } from "@/lib/utils";

const TONES: Record<Tone, string> = {
  neutral: "border-ink-600 bg-ink-800 text-ink-300",
  amber: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  blue: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  cyan: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  violet: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  green: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  red: "border-red-400/30 bg-red-400/10 text-red-200",
  gold: "border-gold-500/40 bg-gold-500/10 text-gold-300",
};

export const DOTS: Record<Tone, string> = {
  neutral: "bg-ink-400", amber: "bg-amber-400", blue: "bg-sky-400", cyan: "bg-cyan-400",
  violet: "bg-violet-400", green: "bg-emerald-400", red: "bg-red-400", gold: "bg-gold-400",
};

export function Badge({ tone = "neutral", dot, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold", TONES[tone], className)}>
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} aria-hidden /> : null}
      {children}
    </span>
  );
}
