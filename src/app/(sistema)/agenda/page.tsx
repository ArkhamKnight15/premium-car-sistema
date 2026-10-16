import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEmployees } from "@/lib/data";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button, buttonClass } from "@/components/ui/button";
import { DOTS } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/layout-bits";
import { AppointmentBadge } from "@/components/domain/badges";
import { LiveRefresh } from "@/components/layout/realtime";
import { APPOINTMENT_STATUS, CHANNELS, WEEKDAYS } from "@/lib/constants";
import { addDays, dayKey, dayStartIso, isDayKey, longDate, time, weekday } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Agenda" };

type View = "dia" | "semana" | "mes";
type Row = {
  id: string; starts_at: string; ends_at: string; status: AppointmentStatus; channel: string; employee_id: string | null;
  customers: { full_name: string } | null; vehicles: { plate: string | null; brand: string; model: string } | null;
  employee: { full_name: string } | null; appointment_services: { name: string }[];
};

function range(view: View, d: string) {
  if (view === "dia") return { from: d, to: addDays(d, 1), prev: addDays(d, -1), next: addDays(d, 1) };
  if (view === "semana") {
    const monday = addDays(d, -((weekday(d) + 6) % 7));
    return { from: monday, to: addDays(monday, 7), prev: addDays(monday, -7), next: addDays(monday, 7) };
  }
  const first = `${d.slice(0, 8)}01`;
  const n = new Date(`${first}T12:00:00Z`); n.setUTCMonth(n.getUTCMonth() + 1);
  const p = new Date(`${first}T12:00:00Z`); p.setUTCMonth(p.getUTCMonth() - 1);
  return { from: first, to: n.toISOString().slice(0, 10), prev: p.toISOString().slice(0, 10), next: n.toISOString().slice(0, 10) };
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ v?: string; d?: string; func?: string; todos?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const view: View = sp.v === "dia" || sp.v === "mes" ? sp.v : "semana";
  const today = dayKey();
  const d = isDayKey(sp.d) ? sp.d : today;
  const r = range(view, d);
  const showAll = sp.todos === "1";
  const supabase = await createClient();
  const employees = await getEmployees();

  let q = supabase
    .from("appointments")
    .select("id, starts_at, ends_at, status, channel, employee_id, customers(full_name), vehicles(plate, brand, model), employee:employees(full_name), appointment_services(name)")
    .gte("starts_at", dayStartIso(r.from)).lt("starts_at", dayStartIso(r.to)).order("starts_at");
  if (!showAll) q = q.in("status", ["scheduled", "confirmed", "converted"]);
  if (sp.func) q = q.eq("employee_id", sp.func);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Row[];
  const byDay = new Map<string, Row[]>();
  for (const a of rows) byDay.set(dayKey(a.starts_at), [...(byDay.get(dayKey(a.starts_at)) ?? []), a]);

  const keep = { ...(sp.func ? { func: sp.func } : {}), ...(showAll ? { todos: "1" } : {}) };
  const link = (p: Record<string, string>) => `/agenda?${new URLSearchParams({ v: view, d, ...keep, ...p })}`;
  const title =
    view === "dia" ? longDate(`${d}T12:00:00Z`)
    : view === "semana" ? `${r.from.slice(8)}/${r.from.slice(5, 7)} a ${addDays(r.to, -1).slice(8)}/${addDays(r.to, -1).slice(5, 7)}`
    : new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${r.from}T12:00:00Z`));

  return (
    <>
      <LiveRefresh channel="agenda" watch={[{ table: "appointments" }]} everyMs={120_000} />
      <PageHeader title="Agenda" description={<span className="capitalize">{title}</span>}
        actions={<Link href="/agenda/novo" className={buttonClass("primary")}><Plus /> Novo agendamento</Link>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-ink-700 p-0.5">
          {(["dia", "semana", "mes"] as View[]).map((v) => (
            <Link key={v} href={link({ v })} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold", v === view ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:text-ink-100")}>
              {v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Link href={link({ d: r.prev })} className={buttonClass("ghost", "sm")} aria-label="Anterior"><ChevronLeft /></Link>
          <Link href={link({ d: today })} className={buttonClass("secondary", "sm")}>Hoje</Link>
          <Link href={link({ d: r.next })} className={buttonClass("ghost", "sm")} aria-label="Próximo"><ChevronRight /></Link>
        </div>
        <form className="ml-auto flex items-center gap-2">
          <input type="hidden" name="v" value={view} />
          <input type="hidden" name="d" value={d} />
          <Select name="func" defaultValue={sp.func ?? ""} className="h-8 w-48 text-xs" aria-label="Funcionário">
            <option value="">Todos os funcionários</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </Select>
          <label className="flex items-center gap-1.5 text-xs text-ink-400">
            <input type="checkbox" name="todos" value="1" defaultChecked={showAll} className="accent-[var(--color-gold-500)]" /> Incluir cancelados
          </label>
          <Button type="submit" size="sm" variant="secondary">Aplicar</Button>
        </form>
      </div>

      {view === "dia" ? (
        <Card>
          {rows.length === 0 ? <p className="p-8 text-center text-sm text-ink-400">Nenhum compromisso neste dia.</p> : (
            <ul className="divide-y divide-ink-800">{rows.map((a) => <DayRow key={a.id} a={a} />)}</ul>
          )}
        </Card>
      ) : view === "semana" ? (
        <div className="grid gap-3 md:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => addDays(r.from, i)).map((day) => {
            const list = byDay.get(day) ?? [];
            return (
              <div key={day} className={cn("min-h-[140px] rounded-xl border bg-ink-900 p-2", day === today ? "border-gold-500/40" : "border-ink-800")}>
                <Link href={link({ v: "dia", d: day })} className="mb-2 flex items-baseline justify-between px-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{WEEKDAYS[weekday(day)].slice(0, 3)}</span>
                  <span className={cn("text-lg font-semibold tabular-nums", day === today ? "text-gold-300" : "")}>{day.slice(8)}</span>
                </Link>
                <div className="space-y-1.5">
                  {list.map((a) => (
                    <Link key={a.id} href={`/agenda/${a.id}`} className={cn("block rounded-md border border-ink-800 bg-ink-850 px-2 py-1.5 text-[11px] hover:border-ink-600", a.status === "cancelled" && "opacity-50 line-through")}>
                      <span className="flex items-center gap-1.5">
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOTS[APPOINTMENT_STATUS[a.status].tone])} />
                        <span className="font-semibold tabular-nums text-gold-300">{time(a.starts_at)}</span>
                        <span className="truncate">{a.customers?.full_name?.split(" ")[0]}</span>
                      </span>
                      <span className="block truncate text-ink-400">{a.vehicles?.model}{a.employee ? ` · ${a.employee.full_name.split(" ")[0]}` : ""}</span>
                    </Link>
                  ))}
                  {list.length === 0 ? <p className="px-1 text-[11px] text-ink-600">—</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <MonthGrid from={r.from} to={r.to} today={today} byDay={byDay} link={link} />
      )}
    </>
  );
}

function DayRow({ a }: { a: Row }) {
  return (
    <li>
      <Link href={`/agenda/${a.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-ink-850/60 sm:flex-nowrap">
        <span className="w-24 shrink-0 text-sm font-semibold tabular-nums text-gold-300">{time(a.starts_at)}<span className="block text-xs font-normal text-ink-500">até {time(a.ends_at)}</span></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{a.customers?.full_name}</span>
          <span className="block truncate text-sm text-ink-400">{a.vehicles?.brand} {a.vehicles?.model} {a.vehicles?.plate ? `· ${a.vehicles.plate}` : ""}</span>
          <span className="block truncate text-xs text-ink-500">{a.appointment_services.map((s) => s.name).join(", ")} · {CHANNELS[a.channel]}{a.employee ? ` · ${a.employee.full_name}` : ""}</span>
        </span>
        <AppointmentBadge status={a.status} />
      </Link>
    </li>
  );
}

function MonthGrid({ from, to, today, byDay, link }: { from: string; to: string; today: string; byDay: Map<string, Row[]>; link: (p: Record<string, string>) => string }) {
  const lead = (weekday(from) + 6) % 7;
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let x = from; x < to; x = addDays(x, 1)) cells.push(x);
  while (cells.length % 7) cells.push(null);
  return (
    <div className="thin-scroll overflow-x-auto">
      <div className="grid min-w-[720px] grid-cols-7 gap-px overflow-hidden rounded-xl border border-ink-800 bg-ink-800">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((w) => <div key={w} className="bg-ink-900 px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{w}</div>)}
        {cells.map((day, i) =>
          !day ? <div key={i} className="min-h-[100px] bg-ink-950" /> : (
            <Link key={day} href={link({ v: "dia", d: day })} className="min-h-[100px] bg-ink-900 p-1.5 transition-colors hover:bg-ink-850">
              <span className={cn("inline-block rounded px-1 text-xs font-semibold tabular-nums", day === today ? "bg-gold-500 text-ink-950" : "text-ink-300")}>{day.slice(8)}</span>
              <div className="mt-1 space-y-0.5">
                {(byDay.get(day) ?? []).slice(0, 3).map((a) => (
                  <p key={a.id} className="truncate text-[10px] text-ink-300"><span className="tabular-nums text-gold-400">{time(a.starts_at)}</span> {a.customers?.full_name?.split(" ")[0]}</p>
                ))}
                {(byDay.get(day) ?? []).length > 3 ? <p className="text-[10px] text-ink-500">+{(byDay.get(day) ?? []).length - 3}</p> : null}
              </div>
            </Link>
          ),
        )}
      </div>
    </div>
  );
}
