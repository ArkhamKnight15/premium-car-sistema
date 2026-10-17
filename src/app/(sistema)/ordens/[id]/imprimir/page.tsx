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
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Imprimir OS" };

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
  const s = settings;

  return (
    <div>
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href={`/ordens/${id}`} className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-100"><ChevronLeft className="h-4 w-4" /> Voltar à OS</Link>
        <PrintButton />
      </div>
      <article className="print-sheet mx-auto max-w-3xl rounded-lg bg-white p-8 text-[12.5px] leading-relaxed text-neutral-900 print:max-w-none print:rounded-none">
        <header className="flex items-start justify-between gap-6 border-b-2 border-neutral-900 pb-4">
          <div>
            <p className="font-display text-lg tracking-[0.22em]">PREMIUM CAR</p>
            <p className="text-neutral-600">{[s?.legal_name, s?.cnpj && `CNPJ ${doc(s.cnpj)}`].filter(Boolean).join(" · ")}</p>
            <p className="text-neutral-600">{[s?.address, s?.city].filter(Boolean).join(" — ")}</p>
            <p className="text-neutral-600">{[s?.phone && phone(s.phone), s?.whatsapp && `WhatsApp ${phone(s.whatsapp)}`, s?.email].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Ordem de serviço</p>
            <p className="text-2xl font-bold">{osNumber(o.number)}</p>
            <p>Status: {ORDER_STATUS[o.status].label}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-6 border-b border-neutral-300 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Cliente</p>
            <p className="font-semibold">{c.data?.full_name}</p>
            <p>{[c.data?.document && doc(c.data.document), phone(c.data?.whatsapp ?? c.data?.phone)].filter(Boolean).join(" · ")}</p>
            <p>{c.data?.email}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Veículo</p>
            <p className="font-semibold">{v.data?.brand} {v.data?.model} · {plate(v.data?.plate)}</p>
            <p>{[v.data?.manufacture_year && v.data?.model_year ? `${v.data.manufacture_year}/${v.data.model_year}` : null, v.data?.color].filter(Boolean).join(" · ")}</p>
            <p>Km: {km(o.mileage_km)} · Combustível: {o.fuel_level ?? "—"}</p>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-4 border-b border-neutral-300 py-3">
          <p><span className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Entrada</span>{dateTime(o.entered_at)}</p>
          <p><span className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Previsão</span>{dateTime(o.expected_at)}</p>
          <p><span className="block text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Responsável</span>{responsible ?? "—"}</p>
        </section>

        <section className="border-b border-neutral-300 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Estado inicial do veículo</p>
          <p>{o.initial_condition ?? "Não registrado."}</p>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Avarias preexistentes</p>
          <p>{o.damages ?? "Nenhuma registrada."}</p>
        </section>

        <section className="py-4">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-400 text-left text-[10px] uppercase tracking-widest text-neutral-500">
                <th className="py-1.5">Serviço</th><th className="py-1.5 text-right">Qtd.</th><th className="py-1.5 text-right">Valor</th><th className="py-1.5 text-right">Desconto</th><th className="py-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {((items.data ?? []) as OrderItem[]).map((it) => (
                <tr key={it.id} className="border-b border-neutral-200">
                  <td className="py-1.5">{it.description}</td>
                  <td className="py-1.5 text-right">{String(it.quantity).replace(".", ",")}</td>
                  <td className="py-1.5 text-right">{money(it.unit_price)}</td>
                  <td className="py-1.5 text-right">{Number(it.discount) ? money(it.discount) : "—"}</td>
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

        {o.notes ? <section className="border-t border-neutral-300 py-3"><p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Observações</p><p>{o.notes}</p></section> : null}
        {s?.order_terms ? <section className="border-t border-neutral-300 py-3 text-[11px] text-neutral-600"><p className="whitespace-pre-line">{s.order_terms}</p></section> : null}

        <section className="mt-10 grid grid-cols-2 gap-12">
          <div className="border-t border-neutral-500 pt-1 text-center text-[11px] text-neutral-600">Cliente — entrada</div>
          <div className="border-t border-neutral-500 pt-1 text-center text-[11px] text-neutral-600">Cliente — retirada {o.delivered_at ? `(${dateTime(o.delivered_at)})` : ""}</div>
        </section>
      </article>
    </div>
  );
}
