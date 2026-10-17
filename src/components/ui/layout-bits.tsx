import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions, back }: {
  title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string };
}) {
  return (
    <header className="mb-6">
      {back ? (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-ink-400 hover:text-ink-100">
          <ChevronLeft className="h-3.5 w-3.5" /> {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink-100 sm:text-2xl">{title}</h1>
          {description ? <div className="mt-1 text-sm text-ink-400">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }: {
  icon: LucideIcon; title: string; description?: ReactNode; action?: ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-ink-700 bg-ink-850">
        <Icon className="h-5 w-5 text-brand-400" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-semibold text-ink-100">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-ink-400">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Stat({ label, value, icon: Icon, href, hint, highlight }: {
  label: string; value: ReactNode; icon: LucideIcon; href?: string; hint?: ReactNode; highlight?: boolean;
}) {
  const content = (
    <div className={cn("h-full rounded-xl border bg-ink-900 p-4 shadow-card transition-colors", highlight ? "border-brand-500/30" : "border-ink-800", href && "group-hover:border-ink-600")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase leading-tight tracking-wider text-ink-400">{label}</p>
        <Icon className={cn("h-4 w-4 shrink-0", highlight ? "text-brand-400" : "text-ink-500")} aria-hidden />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-ink-100">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-400">{hint}</p> : null}
    </div>
  );
  return href ? <Link href={href} className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">{content}</Link> : content;
}

export function Alert({ tone = "info", children, className, icon: Icon }: { tone?: "info" | "warn" | "error" | "success"; children: ReactNode; className?: string; icon?: LucideIcon }) {
  const tones = {
    info: "border-sky-400/25 bg-sky-400/5 text-sky-200",
    warn: "border-amber-400/25 bg-amber-400/5 text-amber-200",
    error: "border-red-400/25 bg-red-400/10 text-red-200",
    success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  };
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm", tones[tone], className)} role={tone === "error" ? "alert" : "status"}>
      {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : null}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Tabela com rolagem horizontal em telas pequenas. */
export function DataTable({ head, children, minWidth = 760, align }: { head: ReactNode[]; children: ReactNode; minWidth?: number; align?: ("left" | "right" | "center")[] }) {
  return (
    <div className="thin-scroll overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-ink-800 text-[11px] uppercase tracking-wider text-ink-400">
            {head.map((h, i) => (
              <th key={i} className={cn("whitespace-nowrap px-4 py-2.5 font-semibold first:pl-5 last:pr-5", align?.[i] === "right" ? "text-right" : align?.[i] === "center" ? "text-center" : "text-left")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-800 [&_td]:px-4 [&_td]:py-3 [&_td:first-child]:pl-5 [&_td:last-child]:pr-5 [&_tr]:transition-colors [&_tr:hover]:bg-ink-850/60">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pages, href, total }: { page: number; pages: number; href: (p: number) => string; total?: number }) {
  if (pages <= 1 && total === undefined) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-800 px-5 py-3 text-xs text-ink-400">
      <span>{total !== undefined ? `${total} registro(s)` : ""}</span>
      {pages > 1 ? (
        <span className="flex items-center gap-1">
          {page > 1 ? <Link href={href(page - 1)} className="rounded-md px-2 py-1 hover:bg-ink-800 hover:text-ink-100">← Anterior</Link> : null}
          <span className="px-2">Página {page} de {pages}</span>
          {page < pages ? <Link href={href(page + 1)} className="rounded-md px-2 py-1 hover:bg-ink-800 hover:text-ink-100">Próxima →</Link> : null}
        </span>
      ) : null}
    </div>
  );
}

export function Tabs({ tabs, active }: { tabs: { id: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <nav className="thin-scroll mb-6 flex gap-1 overflow-x-auto border-b border-ink-800" aria-label="Seções">
      {tabs.map((t) => (
        <Link key={t.id} href={t.href} aria-current={t.id === active ? "page" : undefined}
          className={cn("flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
            t.id === active ? "border-brand-500 text-ink-100" : "border-transparent text-ink-400 hover:text-ink-100")}>
          {t.label}
          {t.count !== undefined ? <span className="rounded-full bg-ink-800 px-1.5 text-[10px] tabular-nums text-ink-300">{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export function InfoList({ items, className, cols = 2 }: { items: [string, ReactNode][]; className?: string; cols?: 1 | 2 | 3 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3 text-sm", cols === 2 && "sm:grid-cols-2", cols === 3 && "sm:grid-cols-3", className)}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{k}</dt>
          <dd className="mt-0.5 break-words text-ink-100">{v === null || v === undefined || v === "" ? "—" : v}</dd>
        </div>
      ))}
    </dl>
  );
}
