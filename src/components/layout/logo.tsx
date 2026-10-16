import Link from "next/link";
import { cn } from "@/lib/utils";

/** Marca: hexágono facetado com perfil de carro em linha dourada. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("h-9 w-9", className)} aria-hidden>
      <defs>
        <linearGradient id="pc-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f2e4c2" />
          <stop offset="0.55" stopColor="#c19e5e" />
          <stop offset="1" stopColor="#8a6d38" />
        </linearGradient>
      </defs>
      <path d="M24 3 42 13.5v21L24 45 6 34.5v-21z" fill="#111115" stroke="url(#pc-gold)" strokeWidth="1.4" />
      <path d="M24 3v42M6 13.5l36 21M42 13.5l-36 21" stroke="#c19e5e" strokeOpacity=".08" strokeWidth="1" />
      <path d="M11.5 29.2c2.6-4.4 6.2-6.6 11.3-6.9l5.6-3.1c2-.9 3.8-1 5.7-.3l3.8 3.3c1.6.4 2.6 1.6 2.9 3.8"
        fill="none" stroke="url(#pc-gold)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 31.6h28" stroke="#eeeef1" strokeOpacity=".55" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="17" cy="31.4" r="2.6" fill="#111115" stroke="url(#pc-gold)" strokeWidth="1.5" />
      <circle cx="32" cy="31.4" r="2.6" fill="#111115" stroke="url(#pc-gold)" strokeWidth="1.5" />
    </svg>
  );
}

export function Logo({ href = "/dashboard", subtitle = "Gestão", className, compact }: { href?: string; subtitle?: string; className?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5", className)} aria-label="Premium Car — painel">
      <LogoMark />
      {!compact ? (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[12.5px] tracking-[0.26em] text-ink-100">PREMIUM CAR</span>
          <span className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.3em] text-gold-400">{subtitle}</span>
        </span>
      ) : null}
    </Link>
  );
}
