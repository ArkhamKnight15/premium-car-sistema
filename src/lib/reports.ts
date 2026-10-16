import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants";
import { addDays, date, dateTime, dayStartIso, doc, osNumber, phone, plate } from "@/lib/format";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

export const REPORTS = {
  clientes: "Clientes cadastrados por período",
  veiculos: "Veículos atendidos",
  servicos: "Serviços mais realizados",
  concluidas: "Ordens de serviço concluídas",
  andamento: "Ordens em andamento",
  faturamento: "Faturamento por período",
  pendentes: "Pagamentos pendentes",
  cliente: "Histórico de serviços por cliente",
  veiculo: "Histórico de serviços por veículo",
  produtividade: "Produtividade por funcionário",
} as const;

export type ReportType = keyof typeof REPORTS;
export const isReport = (v: unknown): v is ReportType => typeof v === "string" && v in REPORTS;

export type Cell = string | number | null;
export type Report = {
  title: string;
  headers: string[];
  align?: ("left" | "right")[];
  rows: Cell[][];
  links?: (string | null)[];         // link de cada linha (tela)
  totals?: Cell[];
  usesPeriod: boolean;
  note?: string;
};

type Params = { from: string; to: string; customerId?: string; vehicleId?: string };
const R = "right" as const, L = "left" as const;

/** Monta o relatório a partir dos registros reais (mesmos dados na tela e no CSV). */
export async function loadReport(type: ReportType, p: Params): Promise<Report> {
  const supabase = await createClient();
  const a = dayStartIso(p.from);
  const b = dayStartIso(addDays(p.to, 1));
  const title = REPORTS[type];

  switch (type) {
    case "clientes": {
      const { data } = await supabase.from("customers").select("id, full_name, person_type, document, phone, whatsapp, email, city, created_at, active")
        .gte("created_at", a).lt("created_at", b).order("created_at");
      const rows = data ?? [];
      return {
        title, usesPeriod: true,
        headers: ["Cadastro", "Cliente", "Tipo", "CPF/CNPJ", "Telefone", "WhatsApp", "E-mail", "Cidade", "Situação"],
        rows: rows.map((c) => [date(c.created_at), c.full_name, c.person_type, c.document ? doc(c.document) : "", c.phone ? phone(c.phone) : "", c.whatsapp ? phone(c.whatsapp) : "", c.email ?? "", c.city ?? "", c.active ? "Ativo" : "Inativo"]),
        links: rows.map((c) => `/clientes/${c.id}`),
        totals: [`${rows.length} cliente(s)`],
      };
    }
    case "veiculos": {
      const { data } = await supabase.rpc("report_vehicles_served", { p_from: p.from, p_to: p.to });
      const rows = (data ?? []) as { vehicle_id: string; plate: string | null; vehicle: string; customer: string; orders: number; total: number; last_entry: string }[];
      return {
        title, usesPeriod: true,
        headers: ["Placa", "Veículo", "Cliente", "Atendimentos", "Valor em serviços", "Última entrada"], align: [L, L, L, R, R, L],
        rows: rows.map((r) => [plate(r.plate), r.vehicle, r.customer, r.orders, Number(r.total), dateTime(r.last_entry)]),
        links: rows.map((r) => `/veiculos/${r.vehicle_id}`),
        totals: [`${rows.length} veículo(s)`, "", "", rows.reduce((s, r) => s + r.orders, 0), rows.reduce((s, r) => s + Number(r.total), 0), ""],
      };
    }
    case "servicos": {
      const { data } = await supabase.rpc("report_top_services", { p_from: p.from, p_to: p.to });
      const rows = (data ?? []) as { service: string; times: number; quantity: number; revenue: number }[];
      return {
        title, usesPeriod: true, note: "Considera OS com entrada no período, exceto canceladas. Valor em serviços ≠ valor recebido.",
        headers: ["Serviço", "Vezes", "Quantidade", "Valor em serviços"], align: [L, R, R, R],
        rows: rows.map((r) => [r.service, r.times, Number(r.quantity), Number(r.revenue)]),
        totals: ["Total", rows.reduce((s, r) => s + r.times, 0), "", rows.reduce((s, r) => s + Number(r.revenue), 0)],
      };
    }
    case "concluidas":
    case "andamento": {
      let q = supabase.from("service_orders")
        .select("id, number, status, entered_at, completed_at, delivered_at, total, amount_paid, payment_status, customers(full_name), vehicles(plate, brand, model), responsible:employees!service_orders_responsible_id_fkey(full_name)");
      q = type === "concluidas"
        ? q.not("completed_at", "is", null).neq("status", "cancelled").gte("completed_at", a).lt("completed_at", b).order("completed_at")
        : q.not("status", "in", "(delivered,cancelled)").order("entered_at");
      const { data } = await q;
      const rows = (data ?? []) as unknown as {
        id: string; number: number; status: OrderStatus; entered_at: string; completed_at: string | null; delivered_at: string | null; total: number; amount_paid: number;
        payment_status: PaymentStatus; customers: { full_name: string } | null; vehicles: { plate: string | null; brand: string; model: string } | null; responsible: { full_name: string } | null;
      }[];
      return {
        title, usesPeriod: type === "concluidas",
        headers: ["OS", "Cliente", "Veículo", "Placa", "Responsável", "Entrada", type === "concluidas" ? "Conclusão" : "Status", "Saída", "Total", "Pago", "Pagamento"],
        align: [L, L, L, L, L, L, L, L, R, R, L],
        rows: rows.map((o) => [osNumber(o.number), o.customers?.full_name ?? "", `${o.vehicles?.brand ?? ""} ${o.vehicles?.model ?? ""}`, plate(o.vehicles?.plate), o.responsible?.full_name ?? "",
          dateTime(o.entered_at), type === "concluidas" ? dateTime(o.completed_at) : ORDER_STATUS[o.status].label, o.delivered_at ? dateTime(o.delivered_at) : "", Number(o.total), Number(o.amount_paid), PAYMENT_STATUS[o.payment_status].label]),
        links: rows.map((o) => `/ordens/${o.id}`),
        totals: [`${rows.length} OS`, "", "", "", "", "", "", "", rows.reduce((s, o) => s + Number(o.total), 0), rows.reduce((s, o) => s + Number(o.amount_paid), 0), ""],
      };
    }
    case "faturamento": {
      const { data } = await supabase.rpc("report_revenue", { p_from: p.from, p_to: p.to });
      const rows = (data ?? []) as { day: string; method: string; received: number; refunded: number; payments: number }[];
      const rec = rows.reduce((s, r) => s + Number(r.received), 0), ref = rows.reduce((s, r) => s + Number(r.refunded), 0);
      return {
        title, usesPeriod: true, note: "Recebimentos na data do pagamento; estornos na data do estorno.",
        headers: ["Data", "Forma de pagamento", "Pagamentos", "Recebido", "Estornado", "Líquido"], align: [L, L, R, R, R, R],
        rows: rows.map((r) => [date(`${r.day}T12:00:00Z`), r.method, r.payments, Number(r.received), Number(r.refunded), Number(r.received) - Number(r.refunded)]),
        totals: ["Total", "", rows.reduce((s, r) => s + r.payments, 0), rec, ref, rec - ref],
      };
    }
    case "pendentes": {
      const { data } = await supabase.from("service_orders")
        .select("id, number, status, entered_at, delivered_at, total, amount_paid, payment_status, customers(full_name, phone, whatsapp)")
        .neq("status", "cancelled").in("payment_status", ["pending", "partial", "refunded"]).gt("total", 0).order("entered_at");
      const rows = ((data ?? []) as unknown as { id: string; number: number; status: OrderStatus; entered_at: string; delivered_at: string | null; total: number; amount_paid: number; payment_status: PaymentStatus; customers: { full_name: string; phone: string | null; whatsapp: string | null } | null }[])
        .filter((o) => Number(o.total) > Number(o.amount_paid));
      return {
        title, usesPeriod: false,
        headers: ["OS", "Cliente", "Contato", "Entrada", "Situação", "Total", "Pago", "Saldo"], align: [L, L, L, L, L, R, R, R],
        rows: rows.map((o) => [osNumber(o.number), o.customers?.full_name ?? "", phone(o.customers?.whatsapp ?? o.customers?.phone), date(o.entered_at),
          o.status === "delivered" ? `Entregue ${date(o.delivered_at)}` : ORDER_STATUS[o.status].label, Number(o.total), Number(o.amount_paid), Number(o.total) - Number(o.amount_paid)]),
        links: rows.map((o) => `/ordens/${o.id}`),
        totals: [`${rows.length} OS`, "", "", "", "", "", "", rows.reduce((s, o) => s + Number(o.total) - Number(o.amount_paid), 0)],
      };
    }
    case "cliente":
    case "veiculo": {
      const id = type === "cliente" ? p.customerId : p.vehicleId;
      if (!id) return { title, usesPeriod: false, headers: [], rows: [] };
      const { data } = await supabase.from("service_orders")
        .select("id, number, status, entered_at, delivered_at, total, amount_paid, payment_status, customers(full_name), vehicles(plate, brand, model), service_order_items(description, line_total)")
        .eq(type === "cliente" ? "customer_id" : "vehicle_id", id).order("entered_at", { ascending: false });
      const rows = (data ?? []) as unknown as { id: string; number: number; status: OrderStatus; entered_at: string; delivered_at: string | null; total: number; amount_paid: number; payment_status: PaymentStatus; customers: { full_name: string } | null; vehicles: { plate: string | null; brand: string; model: string } | null; service_order_items: { description: string }[] }[];
      const who = type === "cliente" ? rows[0]?.customers?.full_name : rows[0] ? `${rows[0].vehicles?.brand} ${rows[0].vehicles?.model} (${plate(rows[0].vehicles?.plate)})` : undefined;
      return {
        title: who ? `${title}: ${who}` : title, usesPeriod: false,
        headers: ["OS", type === "cliente" ? "Veículo" : "Cliente", "Serviços", "Entrada", "Saída", "Status", "Total", "Pago"], align: [L, L, L, L, L, L, R, R],
        rows: rows.map((o) => [osNumber(o.number), type === "cliente" ? `${o.vehicles?.brand} ${o.vehicles?.model} · ${plate(o.vehicles?.plate)}` : o.customers?.full_name ?? "",
          o.service_order_items.map((i) => i.description).join(", "), dateTime(o.entered_at), o.delivered_at ? dateTime(o.delivered_at) : "", ORDER_STATUS[o.status].label, Number(o.total), Number(o.amount_paid)]),
        links: rows.map((o) => `/ordens/${o.id}`),
        totals: [`${rows.length} atendimento(s)`, "", "", "", "", "", rows.filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total), 0), rows.reduce((s, o) => s + Number(o.amount_paid), 0)],
      };
    }
    case "produtividade": {
      const { data } = await supabase.rpc("report_productivity", { p_from: p.from, p_to: p.to });
      const rows = (data ?? []) as { employee_id: string; employee: string; orders_responsible: number; orders_completed: number; items_done: number; items_value: number; avg_hours: number | null }[];
      const hasData = rows.some((r) => r.orders_responsible || r.items_done);
      return {
        title, usesPeriod: true,
        note: hasData ? "OS como responsável (entrada no período), OS concluídas e serviços executados (concluídos no período)." : "Ainda não há dados suficientes no período: atribua responsáveis e executores nas OS.",
        headers: ["Funcionário", "OS como responsável", "OS concluídas", "Serviços executados", "Valor dos serviços executados", "Tempo médio até conclusão (h)"], align: [L, R, R, R, R, R],
        rows: rows.map((r) => [r.employee, r.orders_responsible, r.orders_completed, r.items_done, Number(r.items_value), r.avg_hours === null ? "" : Number(r.avg_hours)]),
        links: rows.map((r) => `/funcionarios/${r.employee_id}`),
      };
    }
  }
}
