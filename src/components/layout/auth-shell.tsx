import type { ReactNode } from "react";
import { Logo } from "./logo";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(193,158,94,0.14),transparent)]" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-gold-500/15 to-transparent" aria-hidden />
      <div className="relative w-full max-w-sm animate-in">
        <div className="mb-8 flex justify-center"><Logo href="/login" subtitle="Sistema de gestão" /></div>
        <div className="rounded-2xl border border-ink-800 bg-ink-900/90 p-6 shadow-card backdrop-blur sm:p-7">
          <h1 className="text-lg font-semibold">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-ink-400">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
        {footer ? <div className="mt-5 text-center text-xs text-ink-500">{footer}</div> : null}
      </div>
    </main>
  );
}
