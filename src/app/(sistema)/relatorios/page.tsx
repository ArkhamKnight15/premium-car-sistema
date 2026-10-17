import Link from "next/link";
import type { Metadata } from "next";
import { BarChart3, Download, FileSpreadsheet } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isReport, loadReport, REPORTS, type ReportType } from "@/lib/reports";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonClass } from "@/components/ui/button";
import { Alert, DataTable, EmptyState, PageHeader } from "@/components/ui/layout-bits";
import { CustomerPicker } from "@/components/domain/customer-picker";
import { dayKey, isDayKey, money } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Relatórios" };

type SP = { tipo?: string; de?: string; ate?: string; cliente?: string; placa?: string; q?: string };
const MONEY_HEADERS = /valor|total|pago|recebido|estornado|líquido|saldo/i;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const type: ReportType = isReport(sp.tipo) ? sp.tipo : "faturamento";
  const today = dayKey();
  const from = isDayKey(sp.de) ? sp.de : `${today.slice(0, 8)}01`;
  const to = isDayKey(sp.ate) ? sp.ate : today;
  const supabase = await createClient();

  let vehicleId: string | undefined;
  let vehicleNotFound = false;
  if (type === "veiculo" && sp.placa) {
    const plate = sp.placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const { data } = await supabase.from("vehicles").select("id").eq("plate", plate).order("active", { ascending: false }).limit(1).maybeSingle();
    vehicleId = data?.id;
    vehicleNotFound = !data;
  }
  const { data: chosen } = type === "cliente" && sp.cliente ? await supabase.from("customers").select("id, full_name").eq("id", sp.cliente).maybeSingle() : { data: null };
  const report = await loadReport(type, { from, to, customerId: chosen?.id, vehicleId });
  const params = new URLSearchParams({ tipo: type, de: from, ate: to, ...(chosen ? { cliente: chosen.id } : {}), ...(sp.placa ? { placa: sp.placa } : {}) });
  const needsSubject = (type === "cliente" && !chosen) || (type === "veiculo" && !vehicleId);
  const fmt = (v: string | number | null, header: string) => (typeof v === "number" && MONEY_HEADERS.test(header) ? money(v) : v ?? "");

  return (
    <>
      <PageHeader title="Relatórios" description="Dados reais do sistema, com filtro de período e exportação para CSV (abre no Excel)." />
      <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
        <nav aria-label="Relatórios" className="h-fit rounded-xl border border-ink-800 bg-ink-900 p-2">
          {(Object.keys(REPORTS) as ReportType[]).map((k) => (
            <Link key={k} href={`/relatorios?${new URLSearchParams({ tipo: k, de: from, ate: to })}`} aria-current={k === type ? "page" : undefined}
              className={cn("block rounded-lg px-3 py-2 text-sm transition-colors", k === type ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:bg-ink-850 hover:text-ink-100")}>
              {REPORTS[k]}
            </Link>
          ))}
        </nav>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title={report.title}
              action={!needsSubject ? <a href={`/relatorios/exportar?${params}`} className={buttonClass("secondary", "sm")}><Download /> Exportar CSV</a> : null} />
            <CardBody className="space-y-4">
              {report.usesPeriod || type === "clientes" ? (
                <form className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="tipo" value={type} />
                  <label className="text-xs text-ink-400">De<Input type="date" name="de" defaultValue={from} className="mt-1 h-9 w-40" /></label>
                  <label className="text-xs text-ink-400">Até<Input type="date" name="ate" defaultValue={to} className="mt-1 h-9 w-40" /></label>
                  <Button type="submit" variant="secondary" size="sm" className="h-9">Aplicar período</Button>
                </form>
              ) : null}
              {type === "veiculo" ? (
                <form className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="tipo" value="veiculo" />
                  <label className="text-xs text-ink-400">Placa<Input name="placa" defaultValue={sp.placa} placeholder="ABC1D23" className="mt-1 h-9 w-40 uppercase" /></label>
                  <Button type="submit" variant="secondary" size="sm" className="h-9">Buscar</Button>
                </form>
              ) : null}
              {vehicleNotFound ? <Alert tone="warn">Nenhum veículo com a placa {sp.placa}.</Alert> : null}
              {type === "cliente" && !chosen ? <CustomerPicker basePath="/relatorios" q={sp.q} canCreate={false} keep={{ tipo: "cliente" }} /> : null}
              {type === "cliente" && chosen ? <p className="text-sm">Cliente: <strong>{chosen.full_name}</strong> · <Link href="/relatorios?tipo=cliente" className="text-brand-300">trocar</Link></p> : null}
              {report.note ? <p className="text-xs text-ink-500">{report.note}</p> : null}
            </CardBody>
          </Card>

          {!needsSubject ? (
            <Card>
              {report.rows.length === 0 ? (
                <EmptyState icon={BarChart3} title="Nenhum registro para os filtros escolhidos" />
              ) : (
                <>
                  <DataTable head={report.headers} align={report.align} minWidth={Math.max(640, report.headers.length * 120)}>
                    {report.rows.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j} className={cn(report.align?.[j] === "right" && "text-right tabular-nums", "whitespace-nowrap")}>
                            {j === 0 && report.links?.[i] ? <Link href={report.links[i]!} className="font-medium text-brand-300 hover:underline">{fmt(cell, report.headers[j])}</Link> : fmt(cell, report.headers[j])}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {report.totals ? (
                      <tr className="border-t-2 border-ink-700 bg-ink-850/60 font-semibold">
                        {report.headers.map((h, j) => <td key={j} className={cn(report.align?.[j] === "right" && "text-right tabular-nums")}>{fmt(report.totals?.[j] ?? "", h)}</td>)}
                      </tr>
                    ) : null}
                  </DataTable>
                  <p className="flex items-center gap-1.5 border-t border-ink-800 px-5 py-3 text-xs text-ink-500"><FileSpreadsheet className="h-3.5 w-3.5" /> {report.rows.length} linha(s)</p>
                </>
              )}
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
