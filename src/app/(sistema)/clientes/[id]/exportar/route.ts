import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Exporta todos os dados de um cliente em JSON (atendimento a pedido de titular — LGPD). Somente administradores. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.profile?.active || session.profile.role !== "admin") return new NextResponse("Não autorizado", { status: 403 });
  const { id } = await params;
  const supabase = await createClient();
  const { data: customer } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
  if (!customer) return new NextResponse("Não encontrado", { status: 404 });
  const [vehicles, orders, appointments] = await Promise.all([
    supabase.from("vehicles").select("*").eq("customer_id", id),
    supabase.from("service_orders").select("*, service_order_items(*), payments(*)").eq("customer_id", id),
    supabase.from("appointments").select("*, appointment_services(*)").eq("customer_id", id),
  ]);
  const body = JSON.stringify(
    { exportado_em: new Date().toISOString(), cliente: customer, veiculos: vehicles.data, ordens_de_servico: orders.data, agendamentos: appointments.data },
    null,
    2,
  );
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="cliente-${id.slice(0, 8)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
