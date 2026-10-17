import type { ReactNode } from "react";
import Link from "next/link";
import { LogOut, Plus, UserCircle2 } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { signOut } from "@/actions/auth";
import { Logo } from "./logo";
import { NAV } from "./nav";
import { SidebarLinks } from "./nav-links";
import { GlobalSearch } from "./global-search";
import { MobileNav } from "./mobile-nav";

export function AppShell({ children, isAdmin, userName, inShop }: { children: ReactNode; isAdmin: boolean; userName: string; inShop: number }) {
  const items = NAV.filter((i) => !i.adminOnly || isAdmin);
  const roleLabel = isAdmin ? "Administrador" : "Funcionário";
  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Menu lateral (computador) */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ink-800 bg-ink-925 lg:flex">
        <div className="flex h-16 items-center border-b border-ink-800 px-5">
          <Logo className="w-[156px]" />
        </div>
        <div className="px-4 pt-4">
          <Link href="/entrada" className={buttonClass("primary", "md", "w-full")}>
            <Plus /> Entrada de veículo
          </Link>
        </div>
        <div className="thin-scroll flex-1 overflow-y-auto px-3 py-5">
          <SidebarLinks items={items} badges={{ "/na-empresa": inShop }} />
        </div>
        <div className="border-t border-ink-800 p-3">
          <Link href="/perfil" className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-ink-850">
            <UserCircle2 className="h-8 w-8 shrink-0 text-ink-500" aria-hidden />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink-100">{userName}</span>
              <span className="block text-[11px] text-brand-400">{roleLabel}</span>
            </span>
          </Link>
          <form action={signOut}>
            <button type="submit" className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-400 hover:bg-ink-850 hover:text-ink-100">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Barra superior */}
      <header className="no-print sticky top-0 z-20 border-b border-ink-800">
        {/* O desfoque fica numa camada à parte: backdrop-filter no próprio header prenderia
            os elementos fixed do MobileNav (barra inferior, menu e busca) dentro dele. */}
        <div className="absolute inset-0 -z-10 bg-ink-950/85 backdrop-blur-xl" aria-hidden />
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:h-16">
          <div className="lg:hidden"><Logo className="w-[118px]" /></div>
          <GlobalSearch className="hidden max-w-md flex-1 lg:block" />
          <div className="ml-auto flex items-center gap-2">
            <Link href="/entrada" className={buttonClass("secondary", "sm", "hidden sm:inline-flex lg:hidden")}><Plus /> Entrada</Link>
            <MobileNav items={items} userName={userName} roleLabel={roleLabel} signOut={signOut} />
          </div>
        </div>
      </header>

      <main className="print-plain mx-auto w-full max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:pb-10 lg:pt-8">{children}</main>
    </div>
  );
}
