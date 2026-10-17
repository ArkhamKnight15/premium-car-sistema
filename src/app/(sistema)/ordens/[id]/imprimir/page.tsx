import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEmployees, getSettings } from "@/lib/data";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants";
import { dateTime, doc, km, money, osNumber, phone, plate } from "@/lib/format";
import type { Customer, OrderItem, ServiceOrder, Vehicle } from "@/lib/types";
import { BrandLogo } from "@/components/layout/logo";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Imprimir OS" };

const LABEL_BASE = "text-[10px] font-semibold uppercase tracking-widest";
const LABEL = `${LABEL_BASE} text-neutral-500`;
const GRID_COLS = ["", "grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"];

/** Junta só as partes preenchidas; null quando não sobra nada. */
const filled = (parts: (string | number | null | undefined | false)[], sep = " · ") => parts.filter(Boolean).join(sep) || null;

/** Linha que só aparece quando tem conteúdo: dados vazios não vão para a OS. */
function Line({ children, className }: { children: ReactNode; className?: string }) {
  return children ? <p className={className}>{children}</p> : null;
}

export default async function PrintOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();
  const { data: o } = await supabase.from("service_orders").select("*").eq("id", id).maybeSingle<ServiceOrder>();
  if (!o) notFound();
  const [settings, employees, c, v, items] = await Promise.all([
    getSettings(),
    getEmployees(true),
    supabase.from("customers").select("*").eq("id", o.customer_id).single<Customer>(),
    supabase.from("vehicles").select("*").eq("id", o.vehicle_id).single<Vehicle>(),
    supabase.from("service_order_items").select("*").eq("order_id", id).order("created_at"),
  ]);
  const responsible = employees.find((e) => e.id === o.responsible_id)?.full_name;
  // Horário em que o veículo ficou pronto: gravado pelo banco ao passar para Concluído/Aguardando retirada
  // e mantido depois da entrega (volta a vazio se a OS retornar para execução ou for cancelada)
  const readyAt = o.completed_at;
  const s = settings;
  const cust = c.data;
  const veh = v.data;
  const itemRows = (items.data ?? []) as OrderItem[];
  const hasItemDiscount = itemRows.some((it) => Number(it.discount));
  const years = veh?.manufacture_year && veh?.model_year ? `${veh.manufacture_year}/${veh.model_year}` : veh?.manufacture_year ?? veh?.model_year;
  const contact = cust?.whatsapp ?? cust?.phone;
  const dates = [
    { label: "Entrada", value: dateTime(o.entered_at) },
    o.expected_at ? { label: "Previsão", value: dateTime(o.expected_at) } : null,
    readyAt ? { label: "Pronto para retirada", value: dateTime(readyAt), highlight: true } : null,
    responsible ? { label: "Responsável", value: responsible } : null,
  ].filter((d) => d !== null);

  return (
    <div>
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href={`/ordens/${id}`} className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-100"><ChevronLeft className="h-4 w-4" /> Voltar à OS</Link>
        <PrintButton />
      </div>
      <article className="print-sheet mx-auto max-w-3xl rounded-lg bg-white p-8 text-[12.5px] leading-relaxed text-neutral-900 print:max-w-none print:rounded-none">
        <header className="flex items-start justify-between gap-6 border-b-2 border-neutral-900 pb-4">
          <div>
            <BrandLogo className="mb-3 w-52 text-neutral-900" />
            <Line className="text-neutral-600">{filled([s?.legal_name, s?.cnpj && `CNPJ ${doc(s.cnpj)}`])}</Line>
            <Line className="text-neutral-600">{filled([s?.address, s?.city], " — ")}</Line>
            <Line className="text-neutral-600">{filled([s?.phone && phone(s.phone), s?.whatsapp && `WhatsApp ${phone(s.whatsapp)}`, s?.email])}</Line>
          </div>
          <div className="text-right">
            <p className={LABEL}>Ordem de serviço</p>
            <p className="text-2xl font-bold">{osNumber(o.number)}</p>
            <p>Status: {ORDER_STATUS[o.status].label}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-6 border-b border-neutral-300 py-4">
          <div>
            <p className={LABEL}>Cliente</p>
            <p className="font-semibold">{cust?.full_name}</p>
            <Line>{filled([cust?.document && doc(cust.document), contact && phone(contact)])}</Line>
            <Line>{cust?.email}</Line>
          </div>
          <div>
            <p className={LABEL}>Veículo</p>
            <p className="font-semibold">{filled([`${veh?.brand ?? ""} ${veh?.model ?? ""}`.trim(), veh?.plate && plate(veh.plate)])}</p>
            <Line>{filled([years, veh?.color])}</Line>
            <Line>{filled([o.mileage_km != null && km(o.mileage_km), o.fuel_level && `Combustível: ${o.fuel_level}`])}</Line>
          </div>
        </section>

        <section className={`grid gap-4 border-b border-neutral-300 py-3 ${GRID_COLS[dates.length]}`}>
          {dates.map((d) => (
            <p key={d.label} className={d.highlight ? "font-semibold" : undefined}>
              <span className={`block ${LABEL_BASE} ${d.highlight ? "text-brand-600" : "text-neutral-500"}`}>{d.label}</span>{d.value}
            </p>
          ))}
        </section>

        {o.initial_condition || o.damages ? (
          <section className="space-y-2 border-b border-neutral-300 py-3">
            {o.initial_condition ? <div><p className={LABEL}>Estado inicial do veículo</p><p className="whitespace-pre-line">{o.initial_condition}</p></div> : null}
            {o.damages ? <div><p className={LABEL}>Avarias preexistentes</p><p className="whitespace-pre-line">{o.damages}</p></div> : null}
          </section>
        ) : null}

        <section className="py-4">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-400 text-left text-[10px] uppercase tracking-widest text-neutral-500">
                <th className="py-1.5">Serviço</th><th className="py-1.5 text-right">Qtd.</th><th className="py-1.5 text-right">Valor</th>
                {hasItemDiscount ? <th className="py-1.5 text-right">Desconto</th> : null}<th className="py-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {itemRows.map((it) => (
                <tr key={it.id} className="border-b border-neutral-200">
                  <td className="py-1.5">{it.description}</td>
                  <td className="py-1.5 text-right">{String(it.quantity).replace(".", ",")}</td>
                  <td className="py-1.5 text-right">{money(it.unit_price)}</td>
                  {hasItemDiscount ? <td className="py-1.5 text-right">{Number(it.discount) ? money(it.discount) : ""}</td> : null}
                  <td className="py-1.5 text-right">{money(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ml-auto mt-3 w-64 space-y-1">
            <p className="flex justify-between"><span>Subtotal</span><span>{money(o.subtotal)}</span></p>
            {Number(o.discount) ? <p className="flex justify-between"><span>Desconto</span><span>− {money(o.discount)}</span></p> : null}
            <p className="flex justify-between border-t border-neutral-900 pt-1 text-base font-bold"><span>Total</span><span>{money(o.total)}</span></p>
            <p className="flex justify-between"><span>Pago</span><span>{money(o.amount_paid)}</span></p>
            <p className="flex justify-between font-semibold"><span>Saldo</span><span>{money(Math.max(Number(o.total) - Number(o.amount_paid), 0))}</span></p>
            <p className="text-right text-neutral-500">{PAYMENT_STATUS[o.payment_status].label}</p>
          </div>
        </section>

        {o.notes ? <section className="border-t border-neutral-300 py-3"><p className={LABEL}>Observações</p><p className="whitespace-pre-line">{o.notes}</p></section> : null}
        {s?.order_terms ? <section className="border-t border-neutral-300 py-3 text-[11px] text-neutral-600"><p className="whitespace-pre-line">{s.order_terms}</p></section> : null}

        <section className="mt-10 grid grid-cols-2 gap-12">
          <div className="border-t border-neutral-500 pt-1 text-center text-[11px] text-neutral-600">Cliente — entrada</div>
          <div className="border-t border-neutral-500 pt-1 text-center text-[11px] text-neutral-600">Cliente — retirada {o.delivered_at ? `(${dateTime(o.delivered_at)})` : ""}</div>
        </section>
      </article>
    </div>
  );
}
