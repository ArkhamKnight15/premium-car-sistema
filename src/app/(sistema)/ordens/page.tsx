import Link from "next/link";
import type { Metadata } from "next";
import { ClipboardList, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEmployees, getServices } from "@/lib/data";
import { buildOrderQuery } from "@/lib/order-query";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { DataTable, EmptyState, PageHeader, Pagination, Tabs } from "@/components/ui/layout-bits";
import { OrderFilters, type OrderFilterValues } from "@/components/domain/order-filters";
import { OrderStatusBadge, PaymentBadge } from "@/components/domain/badges";
import { Plate } from "@/components/domain/plate";
import { LiveRefresh } from "@/components/layout/realtime";
import { ORDER_STATUS } from "@/lib/constants";
import { dateTime, money, osNumber } from "@/lib/format";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Ordens de serviço" };

const PER_PAGE = 30;
type Row = {
  id: string; number: number; status: OrderStatus; entered_at: string; expected_at: string | null; delivered_at: string | null; total: number;
  amount_paid: number; payment_status: PaymentStatus; responsible: { full_name: string } | null;
  customers: { id: string; full_name: string } | null; vehicles: { id: string; plate: string | null; brand: string; model: string } | null;
};

export default async function OrdersPage({ searchParams }: { searchParams: Promise<OrderFilterValues & { aba?: string; p?: string }> }) {
  const { profile } = await requireUser();
  const sp = await searchParams;
  const tab = sp.aba === "abertas" || sp.aba === "encerradas" ? sp.aba : "todas";
  const page = Math.max(1, Number(sp.p) || 1);
  const supabase = await createClient();
  const [employees, services] = await Promise.all([getEmployees(true), getServices(true)]);

  let q = buildOrderQuery(supabase, sp, "id, number, status, entered_at, expected_at, delivered_at, total, amount_paid, payment_status, responsible:employees!service_orders_responsible_id_fkey(full_name)", { count: true });
  if (tab === "abertas") q = q.not("status", "in", "(delivered,cancelled)");
  if (tab === "encerradas") q = q.in("status", ["delivered", "cancelled"]);
  const { data, count, error } = await q.order("entered_at", { ascending: false }).range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  const rows = (data ?? []) as unknown as Row[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PER_PAGE));
  const filters = Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== "aba" && k !== "p")) as Record<string, string>;
  const href = (extra: Record<string, string>) => `/ordens?${new URLSearchParams({ ...filters, ...extra })}`;

  return (
    <>
      <LiveRefresh channel="ordens" watch={[{ table: "service_orders" }]} everyMs={90_000} />
      <PageHeader title="Ordens de serviço"
        description={profile.role !== "admin" && !profile.perm_all_orders ? "Exibindo apenas as OS atribuídas a você." : "Todas as ordens de serviço da empresa."}
        actions={<Link href="/entrada" className={buttonClass("primary")}><Plus /> Nova OS / entrada</Link>} />
      <Tabs active={tab} tabs={[
        { id: "todas", label: "Todas", href: href({}) },
        { id: "abertas", label: "Em aberto", href: href({ aba: "abertas" }) },
        { id: "encerradas", label: "Entregues e canceladas", href: href({ aba: "encerradas" }) },
      ]} />
      <Card>
        <div className="border-b border-ink-800">
          <OrderFilters values={sp} employees={employees} services={services} basePath="/ordens" statuses={Object.keys(ORDER_STATUS) as OrderStatus[]} />
        </div>
        {error ? <p className="px-5 py-3 text-sm text-red-300">Não foi possível aplicar os filtros.</p> : null}
        {rows.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Nenhuma ordem de serviço encontrada" description="Ajuste os filtros ou registre uma nova entrada." />
        ) : (
          <DataTable head={["OS", "Veículo", "Cliente", "Entrada", "Responsável", "Total", "Pagamento", "Status"]} align={["left", "left", "left", "left", "left", "right", "left", "left"]} minWidth={980}>
            {rows.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/ordens/${o.id}`} className="font-semibold text-gold-300 hover:underline">{osNumber(o.number)}</Link></td>
                <td>
                  <Link href={`/ordens/${o.id}`} className="flex items-center gap-2">
                    <Plate value={o.vehicles?.plate} size="sm" />
                    <span className="whitespace-nowrap text-ink-300">{o.vehicles?.brand} {o.vehicles?.model}</span>
                  </Link>
                </td>
                <td className="max-w-[200px] truncate">{o.customers?.full_name}</td>
                <td className="whitespace-nowrap text-ink-300">{dateTime(o.entered_at)}</td>
                <td className="text-ink-300">{o.responsible?.full_name ?? "—"}</td>
                <td className="text-right tabular-nums">{money(o.total)}</td>
                <td><PaymentBadge status={o.payment_status} /></td>
                <td><OrderStatusBadge status={o.status} short /></td>
              </tr>
            ))}
          </DataTable>
        )}
        <Pagination page={page} pages={pages} total={count ?? 0} href={(p) => href({ ...(tab !== "todas" ? { aba: tab } : {}), p: String(p) })} />
      </Card>
    </>
  );
}
