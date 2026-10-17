"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav";
import { NAV_ICONS, SidebarLinks, isActive } from "./nav-links";
import { GlobalSearch } from "./global-search";

/** Barra inferior para celulares + menu completo em gaveta. */
export function MobileNav({ items, userName, roleLabel, signOut }: { items: NavItem[]; userName: string; roleLabel: string; signOut: () => Promise<void> }) {
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    setMenu(false);
    setSearch(false);
  }, [pathname]);

  const quick = ["/dashboard", "/na-empresa", "/ordens"].map((h) => items.find((i) => i.href === h)!).filter(Boolean);

  return (
    <>
      <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-ink-800 bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <nav className="grid grid-cols-5" aria-label="Navegação rápida">
          {quick.slice(0, 2).map((item) => <Tab key={item.href} item={item} active={isActive(pathname, item.href)} />)}
          <Link href="/entrada" className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold text-brand-300">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-ink-950 shadow-[0_6px_18px_-8px_rgba(243,96,32,0.9)]">
              <Plus className="h-5 w-5" />
            </span>
            Entrada
          </Link>
          {quick.slice(2).map((item) => <Tab key={item.href} item={item} active={isActive(pathname, item.href)} />)}
          <button type="button" onClick={() => setMenu(true)} className="flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium text-ink-400">
            <Menu className="h-5 w-5" /> Menu
          </button>
        </nav>
      </div>

      <button type="button" onClick={() => setSearch(true)} aria-label="Pesquisar"
        className="no-print flex h-9 w-9 items-center justify-center rounded-lg border border-ink-700 text-ink-300 lg:hidden">
        <Search className="h-4 w-4" />
      </button>

      {search ? (
        <div className="fixed inset-0 z-50 bg-ink-950/95 p-4 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <GlobalSearch className="flex-1" autoFocus onNavigate={() => setSearch(false)} />
            <button type="button" onClick={() => setSearch(false)} aria-label="Fechar" className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink-700 text-ink-300">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {menu ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-black/60" onClick={() => setMenu(false)} aria-label="Fechar menu" />
          <div className="absolute inset-y-0 right-0 flex w-[82%] max-w-xs flex-col border-l border-ink-800 bg-ink-925 p-4 animate-in">
            <div className="mb-5 flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{userName}</p>
                <p className="text-xs text-brand-400">{roleLabel}</p>
              </div>
              <button type="button" onClick={() => setMenu(false)} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="thin-scroll flex-1 overflow-y-auto">
              <SidebarLinks items={items} />
            </div>
            <div className="mt-4 space-y-1 border-t border-ink-800 pt-4">
              <Link href="/perfil" className="block rounded-lg px-3 py-2 text-sm text-ink-300 hover:bg-ink-850">Meu perfil</Link>
              <form action={signOut}>
                <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-300 hover:bg-ink-850">
                  <LogOut className="h-4 w-4" /> Sair
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Tab({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = NAV_ICONS[item.icon];
  const label = item.href === "/na-empresa" ? "Na empresa" : item.href === "/ordens" ? "OS" : item.label;
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined}
      className={cn("flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium", active ? "text-brand-300" : "text-ink-400")}>
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}
