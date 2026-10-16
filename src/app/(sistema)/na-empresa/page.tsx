/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { Metadata } from "next";
import { CalendarClock, Car, Clock, LayoutGrid, List, Plus, UserRound, Wrench } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEmployees, getServices } from "@/lib/data";
import { buildOrderQuery } from "@/lib/order-query";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { DataTable, EmptyState, PageHeader } from "@/components/ui/layout-bits";
import { OrderFilters, type OrderFilterValues } from "@/components/domain/order-filters";
import { OrderStatusBadge } from "@/components/domain/badges";
import { Plate } from "@/components/domain/plate";
import { QuickStatus } from "@/components/domain/quick-status";
import { LiveRefresh } from "@/components/layout/realtime";
import { DOTS } from "@/components/ui/badge";
import { OPEN_STATUSES, ORDER_STATUS } from "@/lib/constants";
import { osNumber, shortDateTime, since, time } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ItemStatus, OrderStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Veículos na Empresa" };

type Row = {
  id: string; number: number; status: OrderStatus; entered_at: string; expected_at: string | null; total: number; amount_paid: number;
  responsible: { full_name: string } | null;
  customers: { id: string; full_name: string } | null; vehicles: { id: string; plate: string | null; brand: string; model: string } | null;
  service_order_items: { description: string; status: ItemStatus; executor: { full_name: string } | null }[];
  order_photos: { storage_path: string; kind: string; removed_at: string | null }[];
};

export default async function InShopPage({ searchParams }: { searchParams: Promise<OrderFilterValues> }) {
  await requireUser();
  const sp = await searchParams;
  const view = sp.view === "lista" ? "lista" : "cards";
  const supabase = await createClient();
  const [employees, services] = await Promise.all([getEmployees(), getServices(true)]);

  const { data } = await buildOrderQuery(
    supabase,
    sp,
    "id, number, status, entered_at, expected_at, total, amount_paid, responsible:employees!service_orders_responsible_id_fkey(full_name), " +
      "service_order_items(description, status, executor:employees!service_order_items_employee_id_fkey(full_name)), order_photos(storage_path, kind, removed_at)",
    { openOnly: true },
  ).order("entered_at");
  const rows = (data ?? []) as unknown as Row[];

  // Foto de capa: primeira foto de entrada (URL assinada de curta duração)
  const covers = rows.map((o) => o.order_photos.find((p) => !p.removed_at && p.kind === "entry")?.storage_path ?? o.order_photos.find((p) => !p.removed_at)?.storage_path ?? null);
  const paths = covers.filter((p): p is string => Boolean(p));
  const signed = paths.length ? (await supabase.storage.from("order-photos").createSignedUrls(paths, 900)).data ?? [] : [];
  const urlOf = new Map(paths.map((p, i) => [p, signed[i]?.signedUrl ?? null]));

  const counts = OPEN_STATUSES.map((s) => ({ s, n: rows.filter((r) => r.status === s).length }));
  const now = Date.now();
  const viewHref = (v: string) => `/na-empresa?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, x]) => x)), view: v })}`;

  return (
    <>
      <LiveRefresh channel="na-empresa" watch={[{ table: "service_orders" }, { table: "service_order_items" }]} everyMs={45_000} />
      <PageHeader
        title="Veículos na Empresa"
        description={`${rows.length} veículo(s) com OS em aberto · atualiza automaticamente`}
        actions={
          <>
            <div className="flex rounded-lg border border-ink-700 p-0.5">
              <Link href={viewHref("cards")} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold", view === "cards" ? "bg-ink-800 text-ink-100" : "text-ink-400")}><LayoutGrid className="h-3.5 w-3.5" /> Cards</Link>
              <Link href={viewHref("lista")} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold", view === "lista" ? "bg-ink-800 text-ink-100" : "text-ink-400")}><List className="h-3.5 w-3.5" /> Lista</Link>
            </div>
            <Link href="/entrada" className={buttonClass("primary")}><Plus /> Entrada</Link>
          </>
        }
      />

      <div className="thin-scroll mb-4 flex gap-2 overflow-x-auto pb-1">
        {counts.map(({ s, n }) => (
          <Link key={s} href={`/na-empresa?${new URLSearchParams({ view, ...(sp.status === s ? {} : { status: s }) })}`}
            className={cn("flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
              sp.status === s ? "border-gold-500/50 bg-gold-500/10 text-gold-200" : "border-ink-800 bg-ink-900 text-ink-300 hover:border-ink-600")}>
            <span className={cn("h-2 w-2 rounded-full", DOTS[ORDER_STATUS[s].tone])} />
            {ORDER_STATUS[s].label}
            <span className="tabular-nums text-ink-100">{n}</span>
          </Link>
        ))}
      </div>

      <Card className="mb-6">
        <OrderFilters values={sp} employees={employees} services={services} basePath="/na-empresa" statuses={OPEN_STATUSES} showPayment={false} />
      </Card>

      {rows.length === 0 ? (
        <Card><EmptyState icon={Car} title="Nenhum veículo na empresa" description="Quando um veículo der entrada, ele aparece aqui até a entrega." action={<Link href="/entrada" className={buttonClass("outline", "sm")}>Registrar entrada</Link>} /></Card>
      ) : view === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((o, i) => {
            const current = o.service_order_items.find((it) => it.status === "in_progress") ?? o.service_order_items.find((it) => it.status === "pending");
            const late = o.expected_at && new Date(o.expected_at).getTime() < now && !["completed", "awaiting_pickup"].includes(o.status);
            const cover = covers[i] ? urlOf.get(covers[i]!) : null;
            return (
              <Card key={o.id} className="flex flex-col overflow-hidden">
                <Link href={`/ordens/${o.id}`} className="group relative block aspect-[16/8] overflow-hidden bg-gradient-to-br from-ink-850 to-ink-925">
                  {cover ? <img src={cover} alt="" className="h-full w-full object-cover opacity-90 transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" />
                    : <Car className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-ink-700" aria-hidden />}
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-ink-950/95 via-ink-950/50 to-transparent p-3">
                    <Plate value={o.vehicles?.plate} />
                    <OrderStatusBadge status={o.status} short />
                  </div>
                </Link>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/ordens/${o.id}`} className="block truncate font-semibold hover:text-gold-300">{o.vehicles?.brand} {o.vehicles?.model}</Link>
                      <p className="truncate text-sm text-ink-400">{o.customers?.full_name}</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-gold-400">{osNumber(o.number)}</span>
                  </div>
                  <dl className="mt-3 space-y-1.5 text-xs text-ink-300">
                    <div className="flex items-center gap-2"><Wrench className="h-3.5 w-3.5 shrink-0 text-ink-500" />
                      <span className="truncate">{current ? `${current.description}${current.status === "in_progress" ? " (em execução)" : " (próximo)"}${current.executor ? ` · ${current.executor.full_name}` : ""}` : "Todos os serviços concluídos"}</span>
                    </div>
                    <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 shrink-0 text-ink-500" /> Entrada {shortDateTime(o.entered_at)} · há {since(o.entered_at)}</div>
                    <div className="flex items-center gap-2"><UserRound className="h-3.5 w-3.5 shrink-0 text-ink-500" /> {o.responsible?.full_name ?? "Sem responsável"}</div>
                    <div className={cn("flex items-center gap-2", late && "text-red-300")}><CalendarClock className="h-3.5 w-3.5 shrink-0 text-ink-500" />
                      {o.expected_at ? `Previsão ${shortDateTime(o.expected_at)}${late ? " · atrasado" : ""}` : "Sem previsão"}
                    </div>
                  </dl>
                  <div className="mt-auto pt-4">
                    <QuickStatus orderId={o.id} status={o.status} balance={Number(o.total) - Number(o.amount_paid)} compact />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <DataTable head={["Placa", "Veículo / cliente", "Serviço atual", "Entrada", "Responsável", "Previsão", "Status"]} minWidth={980}>
            {rows.map((o) => {
              const current = o.service_order_items.find((it) => it.status === "in_progress") ?? o.service_order_items.find((it) => it.status === "pending");
              const late = o.expected_at && new Date(o.expected_at).getTime() < now && !["completed", "awaiting_pickup"].includes(o.status);
              return (
                <tr key={o.id}>
                  <td><Link href={`/ordens/${o.id}`}><Plate value={o.vehicles?.plate} size="sm" /></Link></td>
                  <td><Link href={`/ordens/${o.id}`} className="font-medium hover:text-gold-300">{o.vehicles?.brand} {o.vehicles?.model}</Link><span className="block text-xs text-ink-500">{o.customers?.full_name} · {osNumber(o.number)}</span></td>
                  <td className="max-w-[220px] truncate text-ink-300">{current?.description ?? "Concluídos"}</td>
                  <td className="whitespace-nowrap text-ink-300">{shortDateTime(o.entered_at)}</td>
                  <td className="text-ink-300">{o.responsible?.full_name ?? "—"}</td>
                  <td className={cn("whitespace-nowrap", late ? "text-red-300" : "text-ink-300")}>{o.expected_at ? `${shortDateTime(o.expected_at)}` : "—"}{late ? " ⚠" : ""}</td>
                  <td><OrderStatusBadge status={o.status} short /></td>
                </tr>
              );
            })}
          </DataTable>
        </Card>
      )}
      <p className="mt-4 text-xs text-ink-500">Última atualização às {time(new Date())}.</p>
    </>
  );
}
