import Link from "next/link";
import type { Metadata } from "next";
import {
  CalendarDays, Car, CheckCircle2, ClipboardList, Hourglass, PackageCheck, Plus, ShieldAlert, Sparkles, UserPlus, Users, Wallet, Warehouse, Wrench,
} from "lucide-react";
import { can, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { Alert, EmptyState, PageHeader, Stat } from "@/components/ui/layout-bits";
import { AppointmentBadge, OrderStatusBadge } from "@/components/domain/badges";
import { Plate } from "@/components/domain/plate";
import { LiveRefresh } from "@/components/layout/realtime";
import { date, longDate, money, osNumber, phone, shortDateTime, time } from "@/lib/format";
import type { AppointmentStatus, OrderStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

type Stats = {
  customers: number; vehicles: number; in_shop: number; in_progress: number; waiting: number; ready: number; completed_today: number;
  delivered_today: number; appointments_today: number; revenue_today: number | null; revenue_month: number | null; receivable: number | null;
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const { profile, isAdmin } = await requireUser();
  const { aviso } = await searchParams;
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [stats, lastCustomers, lastOrders, nextAppts, pendingPrices] = await Promise.all([
    supabase.rpc("dashboard_stats"),
    supabase.from("customers").select("id, full_name, phone, whatsapp, created_at").eq("active", true).order("created_at", { ascending: false }).limit(6),
    supabase.from("service_orders").select("id, number, status, entered_at, total, customers(full_name), vehicles(plate, brand, model)").order("created_at", { ascending: false }).limit(7),
    supabase
      .from("appointments")
      .select("id, starts_at, status, customers(full_name), vehicles(plate, model), employee:employees(full_name), appointment_services(name)")
      .in("status", ["scheduled", "confirmed"]).gte("ends_at", nowIso).order("starts_at").limit(6),
    isAdmin ? supabase.from("services").select("id", { count: "exact", head: true }).eq("active", true).eq("price_reviewed", false) : Promise.resolve({ count: 0 }),
  ]);
  const s = (stats.data ?? {}) as Stats;
  const first = (profile.full_name || "").split(" ")[0];
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(new Date()));
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <>
      <LiveRefresh channel="dashboard" watch={[{ table: "service_orders" }, { table: "appointments" }]} everyMs={120_000} />
      <PageHeader
        title={`${greeting}${first ? `, ${first}` : ""}`}
        description={<span className="capitalize">{longDate(new Date())}</span>}
        actions={
          <>
            {can(profile, "customers") ? <Link href="/clientes/novo" className={buttonClass("secondary")}><UserPlus /> Cadastrar cliente</Link> : null}
            <Link href="/agenda/novo" className={buttonClass("secondary")}><CalendarDays /> Agendar</Link>
            <Link href="/entrada" className={buttonClass("primary")}><Plus /> Entrada de veículo / nova OS</Link>
          </>
        }
      />
      {aviso === "restrito" ? <Alert tone="warn" icon={ShieldAlert} className="mb-5">Essa área é restrita a administradores ou exige uma permissão que seu usuário não tem.</Alert> : null}
      {isAdmin && (pendingPrices.count ?? 0) > 0 ? (
        <Alert tone="info" icon={Sparkles} className="mb-5">
          {pendingPrices.count} serviço(s) ainda com preço de exemplo. <Link href="/servicos" className="font-semibold underline">Revise em Serviços e Preços</Link>.
        </Alert>
      ) : null}

      <section aria-label="Operação" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Na empresa agora" value={s.in_shop ?? 0} icon={Warehouse} href="/na-empresa" highlight />
        <Stat label="Em andamento" value={s.in_progress ?? 0} icon={Wrench} href="/na-empresa?status=in_progress" hint="execução e qualidade" />
        <Stat label="Aguardando início" value={s.waiting ?? 0} icon={Hourglass} href="/na-empresa?status=waiting" hint="recebidos e em avaliação" />
        <Stat label="Prontos p/ retirada" value={s.ready ?? 0} icon={PackageCheck} href="/na-empresa?status=awaiting_pickup" />
        <Stat label="Concluídos hoje" value={s.completed_today ?? 0} icon={CheckCircle2} hint={`${s.delivered_today ?? 0} entregue(s) hoje`} />
        <Stat label="Compromissos hoje" value={s.appointments_today ?? 0} icon={CalendarDays} href="/agenda?v=dia" />
      </section>

      <section aria-label="Cadastros e faturamento" className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Clientes cadastrados" value={s.customers ?? 0} icon={Users} href="/clientes" />
        <Stat label="Veículos cadastrados" value={s.vehicles ?? 0} icon={Car} href="/veiculos" />
        {isAdmin ? (
          <>
            <Stat label="Faturamento hoje" value={money(s.revenue_today)} icon={Wallet} href="/financeiro?periodo=hoje" hint="pagamentos recebidos" />
            <Stat label="Faturamento no mês" value={money(s.revenue_month)} icon={Wallet} href="/financeiro" hint="líquido de estornos" />
            <Stat label="A receber" value={money(s.receivable)} icon={ClipboardList} href="/financeiro?aba=pendentes" hint="saldos de OS" />
          </>
        ) : null}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Últimas ordens de serviço" action={<Link href="/ordens" className="text-xs font-semibold text-gold-300">Ver todas</Link>} />
          {(lastOrders.data ?? []).length === 0 ? (
            <EmptyState icon={ClipboardList} title="Nenhuma OS ainda" action={<Link href="/entrada" className={buttonClass("outline", "sm")}>Registrar a primeira entrada</Link>} />
          ) : (
            <ul className="divide-y divide-ink-800">
              {((lastOrders.data ?? []) as unknown as { id: string; number: number; status: OrderStatus; entered_at: string; total: number; customers: { full_name: string } | null; vehicles: { plate: string | null; brand: string; model: string } | null }[]).map((o) => (
                <li key={o.id}>
                  <Link href={`/ordens/${o.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-ink-850/60 sm:flex-nowrap">
                    <span className="w-20 shrink-0 text-xs font-semibold text-gold-300">{osNumber(o.number)}</span>
                    <Plate value={o.vehicles?.plate} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{o.vehicles?.brand} {o.vehicles?.model}</span>
                      <span className="block truncate text-xs text-ink-400">{o.customers?.full_name} · {shortDateTime(o.entered_at)}</span>
                    </span>
                    <span className="text-sm tabular-nums text-ink-300">{money(o.total)}</span>
                    <OrderStatusBadge status={o.status} short />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Próximos compromissos" action={<Link href="/agenda" className="text-xs font-semibold text-gold-300">Agenda</Link>} />
          {(nextAppts.data ?? []).length === 0 ? (
            <EmptyState icon={CalendarDays} title="Agenda livre" description="Nenhum compromisso futuro." action={<Link href="/agenda/novo" className={buttonClass("outline", "sm")}>Agendar</Link>} />
          ) : (
            <ul className="divide-y divide-ink-800">
              {((nextAppts.data ?? []) as unknown as { id: string; starts_at: string; status: AppointmentStatus; customers: { full_name: string } | null; vehicles: { plate: string | null; model: string } | null; employee: { full_name: string } | null; appointment_services: { name: string }[] }[]).map((a) => (
                <li key={a.id}>
                  <Link href={`/agenda/${a.id}`} className="block px-5 py-3 transition-colors hover:bg-ink-850/60">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold tabular-nums text-gold-300">{date(a.starts_at).slice(0, 5)} · {time(a.starts_at)}</span>
                      <AppointmentBadge status={a.status} />
                    </div>
                    <p className="mt-1 truncate text-sm">{a.customers?.full_name} <span className="text-ink-400">· {a.vehicles?.model} {a.vehicles?.plate ?? ""}</span></p>
                    <p className="truncate text-xs text-ink-500">{a.appointment_services.map((x) => x.name).join(", ")}{a.employee ? ` · ${a.employee.full_name}` : ""}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader title="Últimos clientes cadastrados" action={<Link href="/clientes?ordem=recentes" className="text-xs font-semibold text-gold-300">Ver clientes</Link>} />
          {(lastCustomers.data ?? []).length === 0 ? (
            <EmptyState icon={Users} title="Nenhum cliente cadastrado" />
          ) : (
            <CardBody className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(lastCustomers.data ?? []).map((c) => (
                <Link key={c.id} href={`/clientes/${c.id}`} className="rounded-lg border border-ink-800 px-3 py-2.5 transition-colors hover:border-ink-600">
                  <span className="block truncate text-sm font-medium">{c.full_name}</span>
                  <span className="block text-xs text-ink-400">{phone(c.whatsapp ?? c.phone)} · desde {date(c.created_at)}</span>
                </Link>
              ))}
            </CardBody>
          )}
        </Card>
      </div>
    </>
  );
}
