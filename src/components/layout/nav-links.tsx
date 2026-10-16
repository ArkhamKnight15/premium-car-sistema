"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, CalendarDays, Car, ClipboardList, LayoutDashboard, Settings, Sparkles, UserCog, Users, Wallet, Warehouse, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GROUP_LABEL, type NavIcon, type NavItem } from "./nav";

export const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard, garage: Warehouse, orders: ClipboardList, customers: Users, vehicles: Car, agenda: CalendarDays,
  services: Sparkles, finance: Wallet, reports: BarChart3, team: UserCog, settings: Settings,
};

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function SidebarLinks({ items, badges }: { items: NavItem[]; badges?: Partial<Record<string, number>> }) {
  const pathname = usePathname();
  const groups = (["operacao", "cadastros", "gestao"] as const).filter((g) => items.some((i) => i.group === g));
  return (
    <nav aria-label="Menu principal" className="space-y-6">
      {groups.map((g) => (
        <div key={g}>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">{GROUP_LABEL[g]}</p>
          <ul className="space-y-0.5">
            {items.filter((i) => i.group === g).map((item) => {
              const Icon = NAV_ICONS[item.icon];
              const active = isActive(pathname, item.href);
              const badge = badges?.[item.href];
              return (
                <li key={item.href}>
                  <Link href={item.href} aria-current={active ? "page" : undefined}
                    className={cn("group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      active ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:bg-ink-850 hover:text-ink-100")}>
                    {active ? <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-gold-400" aria-hidden /> : null}
                    <Icon className={cn("h-4 w-4 shrink-0", active ? "text-gold-400" : "text-ink-500 group-hover:text-ink-300")} aria-hidden />
                    <span className="truncate">{item.label}</span>
                    {badge ? <span className="ml-auto rounded-full bg-gold-500/15 px-1.5 text-[10px] font-semibold tabular-nums text-gold-300">{badge}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
