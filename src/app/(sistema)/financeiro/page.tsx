import Link from "next/link";
import type { Metadata } from "next";
import { ArrowDownCircle, Download, Hourglass, Receipt, Undo2, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPaymentMethods } from "@/lib/data";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button, buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, EmptyState, PageHeader, Stat, Tabs } from "@/components/ui/layout-bits";
import { PaymentBadge } from "@/components/domain/badges";
import { addDays, date, dateTime, dayKey, dayStartIso, isDayKey, money, osNumber } from "@/lib/format";
import { safeTerm } from "@/lib/utils";
import type { PaymentStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Financeiro" };

type SP = { aba?: string; periodo?: string; de?: string; ate?: string; cliente?: string; os?: string; forma?: string; situacao?: string };
type Rev = { day: string; method: string; received: number; refunded: number; payments: number };

function period(sp: SP) {
  const today = dayKey();
  if (sp.periodo === "hoje") return { from: today, to: today, label: "Hoje" };
  if (sp.periodo === "7d") return { from: addDays(today, -6), to: today, label: "Últimos 7 dias" };
  if (sp.periodo === "ano") return { from: `${today.slice(0, 4)}-01-01`, to: today, label: "Este ano" };
  if (sp.periodo === "personalizado" && isDayKey(sp.de) && isDayKey(sp.ate)) return { from: sp.de, to: sp.ate, label: `${date(`${sp.de}T12:00:00Z`)} a ${date(`${sp.ate}T12:00:00Z`)}` };
  return { from: `${today.slice(0, 8)}01`, to: today, label: "Este mês" };
}

export default async function FinancePage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = sp.aba === "movimentacoes" || sp.aba === "pendentes" ? sp.aba : "resumo";
  const p = period(sp);
  const supabase = await createClient();
  const methods = await getPaymentMethods(true);
  const base = { ...(sp.periodo ? { periodo: sp.periodo } : {}), ...(sp.periodo === "personalizado" ? { de: sp.de ?? "", ate: sp.ate ?? "" } : {}) };

  return (
    <>
      <PageHeader title="Financeiro" description={`Período: ${p.label}. Faturamento considera apenas pagamentos recebidos, descontando estornos.`}
        actions={<Link href={`/relatorios/exportar?tipo=faturamento&de=${p.from}&ate=${p.to}`} className={buttonClass("secondary")}><Download /> Exportar CSV</Link>} />

      <Card className="mb-5 p-3">
        <form className="flex flex-wrap items-center gap-2">
          {tab !== "resumo" ? <input type="hidden" name="aba" value={tab} /> : null}
          {[["hoje", "Hoje"], ["7d", "7 dias"], ["", "Este mês"], ["ano", "Este ano"]].map(([k, l]) => (
            <Link key={k} href={`/financeiro?${new URLSearchParams({ ...(tab !== "resumo" ? { aba: tab } : {}), ...(k ? { periodo: k } : {}) })}`}
              className={buttonClass((sp.periodo ?? "") === k ? "secondary" : "ghost", "sm")}>{l}</Link>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-ink-700 sm:block" />
          <input type="hidden" name="periodo" value="personalizado" />
          <Input type="date" name="de" defaultValue={p.from} className="h-8 w-40 text-xs" aria-label="De" />
          <Input type="date" name="ate" defaultValue={p.to} className="h-8 w-40 text-xs" aria-label="Até" />
          <Button type="submit" size="sm" variant="secondary">Aplicar</Button>
        </form>
      </Card>

      <Tabs active={tab} tabs={[
        { id: "resumo", label: "Resumo", href: `/financeiro?${new URLSearchParams(base)}` },
        { id: "movimentacoes", label: "Movimentações", href: `/financeiro?${new URLSearchParams({ ...base, aba: "movimentacoes" })}` },
        { id: "pendentes", label: "Pagamentos pendentes", href: `/financeiro?${new URLSearchParams({ ...base, aba: "pendentes" })}` },
      ]} />

      {tab === "resumo" ? <Summary from={p.from} to={p.to} supabase={supabase} /> : null}
      {tab === "movimentacoes" ? <Movements sp={sp} from={p.from} to={p.to} supabase={supabase} methods={methods} /> : null}
      {tab === "pendentes" ? <Pending supabase={supabase} sp={sp} /> : null}
    </>
  );
}

type Supa = Awaited<ReturnType<typeof createClient>>;

async function Summary({ from, to, supabase }: { from: string; to: string; supabase: Supa }) {
  const [{ data }, { data: top }] = await Promise.all([
    supabase.rpc("report_revenue", { p_from: from, p_to: to }),
    supabase.rpc("report_top_services", { p_from: from, p_to: to }),
  ]);
  const rows = (data ?? []) as Rev[];
  const received = rows.reduce((a, r) => a + Number(r.received), 0);
  const refunded = rows.reduce((a, r) => a + Number(r.refunded), 0);
  const count = rows.reduce((a, r) => a + Number(r.payments), 0);
  const byMethod = new Map<string, { rec: number; ref: number; n: number }>();
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const m = byMethod.get(r.method) ?? { rec: 0, ref: 0, n: 0 };
    m.rec += Number(r.received); m.ref += Number(r.refunded); m.n += Number(r.payments);
    byMethod.set(r.method, m);
    byDay.set(r.day, (byDay.get(r.day) ?? 0) + Number(r.received) - Number(r.refunded));
  }
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  const max = Math.max(1, ...days.map(([, v]) => Math.abs(v)));
  const topRows = ((top ?? []) as { service: string; times: number; revenue: number }[]).slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Recebido" value={money(received)} icon={ArrowDownCircle} hint={`${count} pagamento(s)`} />
        <Stat label="Estornado" value={money(refunded)} icon={Undo2} />
        <Stat label="Faturamento líquido" value={money(received - refunded)} icon={Wallet} highlight />
        <Stat label="Ticket médio" value={money(count ? (received - refunded) / count : 0)} icon={Receipt} hint="por pagamento" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Faturamento por dia" description="Recebido menos estornos" />
          <CardBody>
            {days.length === 0 ? <p className="text-sm text-ink-400">Nenhum recebimento no período.</p> : (
              <div className="thin-scroll flex h-52 items-end gap-1.5 overflow-x-auto pb-1" role="img" aria-label="Gráfico de faturamento por dia">
                {days.map(([d, v]) => (
                  <div key={d} className="group flex min-w-[22px] flex-1 flex-col items-center justify-end gap-1" title={`${date(`${d}T12:00:00Z`)}: ${money(v)}`}>
                    <span className="hidden whitespace-nowrap text-[10px] tabular-nums text-brand-300 group-hover:block">{money(v)}</span>
                    <div className={`w-full rounded-t ${v >= 0 ? "bg-brand-500/80 group-hover:bg-brand-400" : "bg-red-400/70"}`} style={{ height: `${Math.max(3, (Math.abs(v) / max) * 170)}px` }} />
                    <span className="text-[9px] tabular-nums text-ink-500">{d.slice(8)}/{d.slice(5, 7)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Por forma de pagamento" />
          <CardBody className="space-y-3 text-sm">
            {byMethod.size === 0 ? <p className="text-ink-400">—</p> : [...byMethod.entries()].sort((a, b) => b[1].rec - a[1].rec).map(([m, v]) => (
              <div key={m}>
                <div className="flex justify-between gap-2"><span>{m} <span className="text-ink-500">({v.n})</span></span><span className="tabular-nums">{money(v.rec - v.ref)}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-ink-800"><div className="h-full rounded-full bg-brand-500" style={{ width: `${received ? Math.max(2, ((v.rec - v.ref) / Math.max(received - refunded, 1)) * 100) : 0}%` }} /></div>
                {v.ref ? <p className="mt-0.5 text-[11px] text-red-300">{money(v.ref)} estornado</p> : null}
              </div>
            ))}
          </CardBody>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title="Serviços mais realizados no período" description="Pelas OS com entrada no período (exceto canceladas)" action={<Link href={`/relatorios?tipo=servicos&de=${from}&ate=${to}`} className="text-xs font-semibold text-brand-300">Relatório completo</Link>} />
          {topRows.length === 0 ? <EmptyState icon={Receipt} title="Sem serviços no período" className="py-6" /> : (
            <DataTable head={["Serviço", "Vezes", "Valor em serviços"]} align={["left", "right", "right"]} minWidth={480}>
              {topRows.map((t) => <tr key={t.service}><td>{t.service}</td><td className="text-right tabular-nums">{t.times}</td><td className="text-right tabular-nums">{money(t.revenue)}</td></tr>)}
            </DataTable>
          )}
        </Card>
      </div>
    </div>
  );
}

async function Movements({ sp, from, to, supabase, methods }: { sp: SP; from: string; to: string; supabase: Supa; methods: { id: string; name: string }[] }) {
  const cliente = safeTerm(sp.cliente);
  const osNum = Number((sp.os ?? "").replace(/\D/g, "")) || null;
  const inner = cliente || osNum;
  let q = supabase
    .from("payments")
    .select(`id, amount, paid_at, status, notes, refunded_at, refund_reason, method:payment_methods(name), order:service_orders${inner ? "!inner" : ""}(id, number, customer:customers${cliente ? "!inner" : ""}(id, full_name))`)
    .gte("paid_at", dayStartIso(from)).lt("paid_at", dayStartIso(addDays(to, 1)))
    .order("paid_at", { ascending: false }).limit(300);
  if (cliente) q = q.ilike("order.customer.full_name", `%${cliente}%`);
  if (osNum) q = q.eq("order.number", osNum);
  if (sp.forma) q = q.eq("method_id", sp.forma);
  if (sp.situacao === "confirmed" || sp.situacao === "refunded") q = q.eq("status", sp.situacao);
  const { data, error } = await q;
  const rows = (data ?? []) as unknown as {
    id: string; amount: number; paid_at: string; status: "confirmed" | "refunded"; notes: string | null; refunded_at: string | null; refund_reason: string | null;
    method: { name: string } | null; order: { id: string; number: number; customer: { id: string; full_name: string } | null } | null;
  }[];
  const net = rows.reduce((a, r) => a + (r.status === "confirmed" ? Number(r.amount) : 0), 0);

  return (
    <Card>
      <form className="grid gap-3 border-b border-ink-800 p-4 sm:grid-cols-[1fr_140px_180px_160px_auto]">
        <input type="hidden" name="aba" value="movimentacoes" />
        {sp.periodo ? <input type="hidden" name="periodo" value={sp.periodo} /> : null}
        {sp.periodo === "personalizado" ? <><input type="hidden" name="de" value={from} /><input type="hidden" name="ate" value={to} /></> : null}
        <Input name="cliente" defaultValue={sp.cliente} placeholder="Cliente" aria-label="Cliente" />
        <Input name="os" defaultValue={sp.os} placeholder="Nº da OS" inputMode="numeric" aria-label="Número da OS" />
        <Select name="forma" defaultValue={sp.forma ?? ""} aria-label="Forma de pagamento">
          <option value="">Todas as formas</option>
          {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
        <Select name="situacao" defaultValue={sp.situacao ?? ""} aria-label="Situação">
          <option value="">Confirmados e estornados</option><option value="confirmed">Confirmados</option><option value="refunded">Estornados</option>
        </Select>
        <Button type="submit" variant="secondary">Filtrar</Button>
      </form>
      {error ? <p className="px-5 py-3 text-sm text-red-300">Não foi possível aplicar os filtros.</p> : null}
      {rows.length === 0 ? <EmptyState icon={Wallet} title="Nenhuma movimentação no período" /> : (
        <DataTable head={["Data", "OS", "Cliente", "Forma", "Valor", "Situação"]} align={["left", "left", "left", "left", "right", "left"]} minWidth={760}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap text-ink-300">{dateTime(r.paid_at)}</td>
              <td>{r.order ? <Link href={`/ordens/${r.order.id}`} className="font-semibold text-brand-300 hover:underline">{osNumber(r.order.number)}</Link> : "—"}</td>
              <td>{r.order?.customer ? <Link href={`/clientes/${r.order.customer.id}`} className="hover:text-brand-300">{r.order.customer.full_name}</Link> : "—"}</td>
              <td className="text-ink-300">{r.method?.name}</td>
              <td className={`text-right tabular-nums ${r.status === "refunded" ? "text-ink-500 line-through" : ""}`}>{money(r.amount)}</td>
              <td>{r.status === "refunded" ? <span title={r.refund_reason ?? ""}><Badge tone="red">Estornado {date(r.refunded_at)}</Badge></span> : <Badge tone="green">Confirmado</Badge>}</td>
            </tr>
          ))}
        </DataTable>
      )}
      <div className="flex justify-between border-t border-ink-800 px-5 py-3 text-sm">
        <span className="text-ink-400">{rows.length} movimentação(ões){rows.length === 300 ? " (limite de exibição — use os filtros)" : ""}</span>
        <span>Recebido (confirmados): <strong className="tabular-nums">{money(net)}</strong></span>
      </div>
    </Card>
  );
}

async function Pending({ supabase, sp }: { supabase: Supa; sp: SP }) {
  const cliente = safeTerm(sp.cliente);
  let q = supabase
    .from("service_orders")
    .select(`id, number, status, entered_at, delivered_at, total, amount_paid, payment_status, customer:customers${cliente ? "!inner" : ""}(id, full_name, phone, whatsapp)`)
    .in("payment_status", ["pending", "partial", "refunded"]).neq("status", "cancelled").gt("total", 0)
    .order("entered_at");
  if (cliente) q = q.ilike("customer.full_name", `%${cliente}%`);
  const { data } = await q;
  const rows = ((data ?? []) as unknown as { id: string; number: number; status: string; entered_at: string; delivered_at: string | null; total: number; amount_paid: number; payment_status: PaymentStatus; customer: { id: string; full_name: string } | null }[])
    .filter((r) => Number(r.total) > Number(r.amount_paid));
  const totalOpen = rows.reduce((a, r) => a + Number(r.total) - Number(r.amount_paid), 0);
  return (
    <Card>
      <CardHeader title={`${rows.length} OS com saldo em aberto`} description={`Total a receber: ${money(totalOpen)}`}
        action={<Link href="/relatorios/exportar?tipo=pendentes" className={buttonClass("ghost", "sm")}><Download /> CSV</Link>} />
      <form className="flex gap-2 border-b border-ink-800 p-4">
        <input type="hidden" name="aba" value="pendentes" />
        <Input name="cliente" defaultValue={sp.cliente} placeholder="Filtrar por cliente" className="max-w-sm" />
        <Button type="submit" variant="secondary">Filtrar</Button>
      </form>
      {rows.length === 0 ? <EmptyState icon={Hourglass} title="Nenhum saldo pendente" /> : (
        <DataTable head={["OS", "Cliente", "Entrada", "Situação", "Total", "Pago", "Saldo", "Pagamento"]} align={["left", "left", "left", "left", "right", "right", "right", "left"]} minWidth={900}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><Link href={`/ordens/${r.id}`} className="font-semibold text-brand-300 hover:underline">{osNumber(r.number)}</Link></td>
              <td>{r.customer ? <Link href={`/clientes/${r.customer.id}`} className="hover:text-brand-300">{r.customer.full_name}</Link> : "—"}</td>
              <td className="whitespace-nowrap text-ink-300">{date(r.entered_at)}</td>
              <td className="text-ink-300">{r.status === "delivered" ? `Entregue ${date(r.delivered_at)}` : "Na empresa"}</td>
              <td className="text-right tabular-nums">{money(r.total)}</td>
              <td className="text-right tabular-nums text-ink-300">{money(r.amount_paid)}</td>
              <td className="text-right font-semibold tabular-nums text-brand-300">{money(Number(r.total) - Number(r.amount_paid))}</td>
              <td><PaymentBadge status={r.payment_status} /></td>
            </tr>
          ))}
        </DataTable>
      )}
    </Card>
  );
}
