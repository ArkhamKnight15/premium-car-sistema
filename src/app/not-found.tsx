import Link from "next/link";
import { LogoMark } from "@/components/layout/logo";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <LogoMark className="h-12 w-12" />
      <p className="mt-6 font-display text-4xl text-gold-300">404</p>
      <h1 className="mt-3 text-lg font-semibold">Registro ou página não encontrada</h1>
      <p className="mt-1 text-sm text-ink-400">Ele pode ter sido removido ou você não tem acesso a ele.</p>
      <Link href="/dashboard" className={buttonClass("primary", "md", "mt-6")}>Ir para o dashboard</Link>
    </main>
  );
}
