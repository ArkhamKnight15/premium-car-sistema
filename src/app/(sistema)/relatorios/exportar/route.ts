import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isReport, loadReport } from "@/lib/reports";
import { csvResponse, toCSV } from "@/lib/csv";
import { dayKey, isDayKey } from "@/lib/format";

/** Exportação CSV dos relatórios (somente administradores). */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.profile?.active || session.profile.role !== "admin") return new NextResponse("Não autorizado", { status: 403 });
  const sp = request.nextUrl.searchParams;
  const type = sp.get("tipo");
  if (!isReport(type)) return new NextResponse("Relatório inválido", { status: 400 });
  const today = dayKey();
  const from = isDayKey(sp.get("de")) ? sp.get("de")! : `${today.slice(0, 8)}01`;
  const to = isDayKey(sp.get("ate")) ? sp.get("ate")! : today;

  let vehicleId: string | undefined;
  const placa = sp.get("placa");
  if (type === "veiculo" && placa) {
    const supabase = await createClient();
    const { data } = await supabase.from("vehicles").select("id").eq("plate", placa.toUpperCase().replace(/[^A-Z0-9]/g, "")).limit(1).maybeSingle();
    vehicleId = data?.id;
  }
  const report = await loadReport(type, { from, to, customerId: sp.get("cliente") ?? undefined, vehicleId });
  const rows = report.totals ? [...report.rows, report.totals] : report.rows;
  const body = toCSV(report.headers, rows);
  const suffix = report.usesPeriod ? `_${from}_a_${to}` : `_${today}`;
  return csvResponse(`premium-car_${type}${suffix}.csv`, body);
}
