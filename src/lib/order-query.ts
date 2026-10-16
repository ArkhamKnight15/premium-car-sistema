import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays, dayStartIso, isDayKey } from "@/lib/format";
import { safeTerm } from "@/lib/utils";
import type { OrderFilterValues } from "@/components/domain/order-filters";

type Supa = Awaited<ReturnType<typeof createClient>>;

/**
 * Monta a consulta de OS com os filtros da tela. Junções "!inner" só são usadas
 * quando o filtro correspondente está ativo, para não esconder OS sem itens.
 */
export function buildOrderQuery(supabase: Supa, f: OrderFilterValues, columns: string, opts: { openOnly?: boolean; count?: boolean } = {}) {
  const cliente = safeTerm(f.cliente);
  const placa = (f.placa ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const select = [
    columns,
    cliente ? "customers!inner(id, full_name)" : "customers(id, full_name)",
    placa ? "vehicles!inner(id, plate, brand, model)" : "vehicles(id, plate, brand, model)",
    f.servico ? "filter_items:service_order_items!inner(service_id)" : "",
  ].filter(Boolean).join(", ");

  let q = supabase.from("service_orders").select(select, opts.count ? { count: "exact" } : undefined);
  if (opts.openOnly) q = q.not("status", "in", "(delivered,cancelled)");
  if (f.status) q = q.eq("status", f.status);
  if (f.func) q = q.eq("responsible_id", f.func);
  if (f.pag) q = q.eq("payment_status", f.pag);
  if (cliente) q = q.ilike("customers.full_name", `%${cliente}%`);
  if (placa) q = q.ilike("vehicles.plate", `%${placa}%`);
  if (f.servico) q = q.eq("filter_items.service_id", f.servico);
  if (isDayKey(f.de)) q = q.gte("entered_at", dayStartIso(f.de));
  if (isDayKey(f.ate)) q = q.lt("entered_at", dayStartIso(addDays(f.ate, 1)));
  return q;
}
