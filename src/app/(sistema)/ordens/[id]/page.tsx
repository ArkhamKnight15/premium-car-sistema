/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Camera, MessageCircle, Printer, Undo2 } from "lucide-react";
import { can, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEmployees, getPaymentMethods, getServices } from "@/lib/data";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Alert, EmptyState, InfoList, PageHeader } from "@/components/ui/layout-bits";
import { ActionForm, Field } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { OrderStatusBadge, PaymentBadge } from "@/components/domain/badges";
import { Plate } from "@/components/domain/plate";
import { StatusStepper } from "@/components/domain/status-stepper";
import { Timeline, type TimelineEvent } from "@/components/domain/timeline";
import { OrderItems } from "@/components/domain/order-items";
import { QuickStatus } from "@/components/domain/quick-status";
import { StatusPanel } from "@/components/domain/status-panel";
import { LiveRefresh } from "@/components/layout/realtime";
import { FUEL_LEVELS, PHOTO_KIND } from "@/lib/constants";
import { dateTime, km, money, moneyInput, osNumber, phone, since, toLocalInput } from "@/lib/format";
import type { Customer, OrderEvent, OrderItem, OrderPhoto, Payment, ServiceOrder, Vehicle } from "@/lib/types";
import { addNote, refundPayment, registerPayment, removePhoto, setOrderDiscount, updateOrderInfo, uploadPhotos } from "@/actions/orders";

export const metadata: Metadata = { title: "Ordem de serviço" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { profile, isAdmin } = await requireUser();
  const { id } = await params;
  const supabase = await createClient();
  const { data: o } = await supabase.from("service_orders").select("*").eq("id", id).maybeSingle<ServiceOrder>();
  if (!o) notFound(); // inexistente ou sem permissão (RLS)

  const canPay = can(profile, "payments");
  const canDiscount = can(profile, "discounts");
  const [customer, vehicle, items, events, photos, payments, employees, services, methods, users] = await Promise.all([
    supabase.from("customers").select("*").eq("id", o.customer_id).single<Customer>(),
    supabase.from("vehicles").select("*").eq("id", o.vehicle_id).single<Vehicle>(),
    supabase.from("service_order_items").select("*").eq("order_id", id).order("created_at"),
    supabase.from("order_events").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("order_photos").select("*").eq("order_id", id).is("removed_at", null).order("created_at"),
    canPay ? supabase.from("payments").select("*").eq("order_id", id).order("paid_at") : Promise.resolve({ data: [] }),
    getEmployees(true),
    getServices(),
    getPaymentMethods(true),
    supabase.from("profiles").select("id, full_name"),
  ]);
  const c = customer.data!;
  const v = vehicle.data!;
  const itemRows = (items.data ?? []) as OrderItem[];
  const photoRows = (photos.data ?? []) as OrderPhoto[];
  const paymentRows = (payments.data ?? []) as Payment[];
  const userName = new Map((users.data ?? []).map((u) => [u.id, u.full_name as string]));
  const methodName = new Map(methods.map((m) => [m.id, m.name]));
  const signed = photoRows.length ? (await supabase.storage.from("order-photos").createSignedUrls(photoRows.map((p) => p.storage_path), 1800)).data ?? [] : [];
  const timeline: TimelineEvent[] = ((events.data ?? []) as OrderEvent[]).map((e) => ({ id: e.id, kind: e.kind, message: e.message, created_at: e.created_at, actor: e.actor_id ? userName.get(e.actor_id) ?? null : null }));
  const closed = o.status === "delivered" || o.status === "cancelled";
  const locked = closed && !isAdmin;
  const balance = Math.max(Number(o.total) - Number(o.amount_paid), 0);
  const responsible = employees.find((e) => e.id === o.responsible_id);
  const activeEmployees = employees.filter((e) => e.active);
  const wa = c.whatsapp ?? c.phone;
  const waText = encodeURIComponent(`Olá, ${c.full_name.split(" ")[0]}! Aqui é da Premium Car, sobre o seu ${v.brand} ${v.model} (${osNumber(o.number)}).`);

  return (
    <>
      <LiveRefresh channel={`os-${id}`} watch={[{ table: "service_orders", filter: `id=eq.${id}` }, { table: "order_events", filter: `order_id=eq.${id}` }]} />
      <PageHeader
        back={{ href: closed ? "/ordens" : "/na-empresa", label: closed ? "Ordens de serviço" : "Veículos na Empresa" }}
        title={<span className="flex flex-wrap items-center gap-3">{osNumber(o.number)} <OrderStatusBadge status={o.status} /> <PaymentBadge status={o.payment_status} /></span>}
        description={<>Entrada em {dateTime(o.entered_at)}{!closed ? ` · há ${since(o.entered_at)} na empresa` : ""}{o.delivered_at ? ` · saída em ${dateTime(o.delivered_at)}` : ""}</>}
        actions={
          <>
            {wa ? <a href={`https://wa.me/55${wa}?text=${waText}`} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost")}><MessageCircle /> WhatsApp</a> : null}
            <Link href={`/ordens/${id}/imprimir`} className={buttonClass("secondary")}><Printer /> Imprimir OS</Link>
          </>
        }
      />
      {o.status === "cancelled" ? <Alert tone="error" className="mb-5">OS cancelada em {dateTime(o.cancelled_at)} — {o.cancel_reason}</Alert> : null}

      <Card className="mb-6 p-4">
        <StatusStepper status={o.status} />
        {!closed ? <div className="mt-4 max-w-xs"><QuickStatus orderId={id} status={o.status} balance={balance} /></div> : null}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Serviços" description={locked ? "OS encerrada." : "Atualize a situação e o executor de cada serviço."} />
            <CardBody className="pt-1">
              <OrderItems orderId={id} items={itemRows} employees={activeEmployees} services={services} locked={locked} canDiscount={canDiscount} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Fotos" description="Entrada, avarias, andamento e finalização. Armazenadas em área privada." />
            <CardBody>
              {photoRows.length === 0 ? <EmptyState icon={Camera} title="Nenhuma foto anexada" className="py-6" /> : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {photoRows.map((p, i) => (
                    <figure key={p.id} className="overflow-hidden rounded-lg border border-ink-800 bg-ink-850">
                      <a href={signed[i]?.signedUrl ?? "#"} target="_blank" rel="noopener noreferrer">
                        {signed[i]?.signedUrl ? <img src={signed[i]!.signedUrl} alt={p.caption ?? PHOTO_KIND[p.kind]} className="aspect-[4/3] w-full object-cover" loading="lazy" /> : <div className="aspect-[4/3]" />}
                      </a>
                      <figcaption className="flex items-center justify-between gap-1 px-2 py-1.5 text-[11px] text-ink-400">
                        <span className="truncate">{PHOTO_KIND[p.kind]}{p.caption ? ` · ${p.caption}` : ""}</span>
                        {!locked ? <ConfirmAction action={removePhoto} fields={{ order_id: id, photo_id: p.id }} label="Retirar" variant="ghost" size="xs" question="Retirar esta foto da OS? O registro fica no histórico." confirmLabel="Retirar" /> : null}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
              {!locked ? (
                <ActionForm action={uploadPhotos} reset className="mt-5 grid gap-3 border-t border-ink-800 pt-5 sm:grid-cols-6 sm:items-end">
                  <input type="hidden" name="order_id" value={id} />
                  <Field name="kind" label="Tipo" className="sm:col-span-2">
                    <Select id="kind" name="kind" defaultValue={o.status === "received" || o.status === "evaluation" ? "entry" : ["completed", "awaiting_pickup"].includes(o.status) ? "final" : "progress"}>
                      {Object.entries(PHOTO_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </Select>
                  </Field>
                  <Field name="caption" label="Legenda" className="sm:col-span-4"><Input id="caption" name="caption" placeholder="Opcional" /></Field>
                  <Field name="photos" label="Arquivos" className="sm:col-span-4"><Input id="photos" name="photos" type="file" accept="image/*" multiple capture="environment" className="pt-2" /></Field>
                  <SubmitButton variant="secondary" className="sm:col-span-2" pendingText="Enviando…"><Camera /> Anexar fotos</SubmitButton>
                </ActionForm>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Linha do tempo" description="Tudo o que aconteceu nesta OS, com data, hora e usuário." />
            <CardBody>
              {!locked ? (
                <ActionForm action={addNote} reset className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start">
                  <input type="hidden" name="id" value={id} />
                  <Textarea name="note" rows={2} placeholder="Adicionar observação interna…" aria-label="Observação interna" className="flex-1" required />
                  <SubmitButton variant="secondary" pendingText="Registrando…">Registrar</SubmitButton>
                </ActionForm>
              ) : null}
              <Timeline events={timeline} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Cliente e veículo" />
            <CardBody className="space-y-4">
              <div>
                <Link href={`/clientes/${c.id}`} className="font-semibold hover:text-gold-300">{c.full_name}</Link>
                <p className="text-sm text-ink-400">{phone(c.whatsapp ?? c.phone)}{c.email ? ` · ${c.email}` : ""}</p>
              </div>
              <Link href={`/veiculos/${v.id}`} className="flex items-center gap-3 rounded-lg border border-ink-800 p-3 hover:border-ink-600">
                <Plate value={v.plate} />
                <span className="text-sm"><span className="block font-medium">{v.brand} {v.model}</span><span className="text-xs text-ink-400">{[v.model_year, v.color].filter(Boolean).join(" · ")}</span></span>
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Financeiro" action={<PaymentBadge status={o.payment_status} />} />
            <CardBody className="space-y-4">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-ink-400">Subtotal</dt><dd className="tabular-nums">{money(o.subtotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-400">Desconto</dt><dd className="tabular-nums">− {money(o.discount)}</dd></div>
                <div className="flex justify-between border-t border-ink-800 pt-1.5 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{money(o.total)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-400">Pago</dt><dd className="tabular-nums text-emerald-300">{money(o.amount_paid)}</dd></div>
                <div className="flex justify-between font-semibold"><dt>Saldo pendente</dt><dd className="tabular-nums text-gold-300">{money(balance)}</dd></div>
              </dl>
              {canDiscount && !locked ? (
                <ActionForm action={setOrderDiscount} className="flex items-end gap-2">
                  <input type="hidden" name="id" value={id} />
                  <div className="flex-1"><Label>Desconto na OS (R$)</Label><Input name="discount" defaultValue={moneyInput(o.discount)} inputMode="decimal" className="h-9" /></div>
                  <SubmitButton size="sm" variant="ghost">Aplicar</SubmitButton>
                </ActionForm>
              ) : null}
              {canPay ? (
                <>
                  {paymentRows.length ? (
                    <ul className="space-y-2 border-t border-ink-800 pt-4 text-sm">
                      {paymentRows.map((p) => (
                        <li key={p.id} className="rounded-lg border border-ink-800 p-2.5">
                          <div className="flex justify-between gap-2">
                            <span className={p.status === "refunded" ? "text-ink-500 line-through" : ""}>{methodName.get(p.method_id)} · {dateTime(p.paid_at)}</span>
                            <span className="tabular-nums">{money(p.amount)}</span>
                          </div>
                          {p.notes ? <p className="text-xs text-ink-400">{p.notes}</p> : null}
                          <p className="text-[11px] text-ink-500">Registrado por {p.created_by ? userName.get(p.created_by) ?? "—" : "—"}</p>
                          {p.status === "refunded" ? <p className="mt-1 text-xs text-red-300">Estornado em {dateTime(p.refunded_at)}: {p.refund_reason}</p> : isAdmin ? (
                            <ConfirmAction action={refundPayment} fields={{ order_id: id, payment_id: p.id }} label={<><Undo2 /> Estornar</>} variant="ghost" size="xs" className="mt-1"
                              question={`Estornar ${money(p.amount)}? O valor deixa de contar no faturamento.`} confirmLabel="Registrar estorno" reasonPlaceholder="Motivo do estorno" />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {o.status !== "cancelled" && balance > 0 ? (
                    <ActionForm action={registerPayment} reset className="space-y-3 border-t border-ink-800 pt-4">
                      <input type="hidden" name="order_id" value={id} />
                      <p className="text-sm font-semibold">Registrar pagamento recebido</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Field name="amount" label="Valor"><Input id="amount" name="amount" defaultValue={moneyInput(balance)} inputMode="decimal" /></Field>
                        <Field name="method_id" label="Forma">
                          <Select id="method_id" name="method_id" defaultValue="">
                            <option value="" disabled>Selecione</option>
                            {methods.filter((m) => m.active).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </Select>
                        </Field>
                      </div>
                      <Field name="paid_at" label="Data do pagamento"><Input id="paid_at" name="paid_at" type="datetime-local" defaultValue={toLocalInput(new Date().toISOString())} /></Field>
                      <Field name="notes" label="Observação"><Input id="notes" name="notes" placeholder="Ex.: NSU, nº do comprovante" /></Field>
                      <SubmitButton size="sm" className="w-full">Registrar pagamento</SubmitButton>
                    </ActionForm>
                  ) : null}
                </>
              ) : (
                <p className="border-t border-ink-800 pt-3 text-xs text-ink-500">O registro de pagamentos depende de permissão do administrador.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Status" />
            <CardBody><StatusPanel orderId={id} status={o.status} balance={balance} isAdmin={isAdmin} /></CardBody>
          </Card>

          <Card>
            <CardHeader title="Entrada e estado inicial" />
            <CardBody>
              {locked ? (
                <InfoList cols={1} items={[
                  ["Responsável", responsible?.full_name], ["Previsão", dateTime(o.expected_at)], ["Quilometragem", km(o.mileage_km)], ["Combustível", o.fuel_level],
                  ["Estado inicial", o.initial_condition], ["Avarias preexistentes", o.damages], ["Observações", o.notes],
                ]} />
              ) : (
                <ActionForm action={updateOrderInfo} className="space-y-3">
                  <input type="hidden" name="id" value={id} />
                  <Field name="responsible_id" label="Funcionário responsável">
                    <Select id="responsible_id" name="responsible_id" defaultValue={o.responsible_id ?? ""}>
                      <option value="">A definir</option>
                      {employees.filter((e) => e.active || e.id === o.responsible_id).map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                    </Select>
                  </Field>
                  <Field name="expected_at" label="Previsão de conclusão"><Input id="expected_at" name="expected_at" type="datetime-local" defaultValue={toLocalInput(o.expected_at)} /></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field name="mileage_km" label="Km"><Input id="mileage_km" name="mileage_km" inputMode="numeric" defaultValue={o.mileage_km ?? ""} /></Field>
                    <Field name="fuel_level" label="Combustível">
                      <Select id="fuel_level" name="fuel_level" defaultValue={o.fuel_level ?? ""}>
                        <option value="">—</option>{FUEL_LEVELS.map((f) => <option key={f} value={f}>{f}</option>)}
                      </Select>
                    </Field>
                  </div>
                  <Field name="initial_condition" label="Estado inicial"><Textarea id="initial_condition" name="initial_condition" rows={2} defaultValue={o.initial_condition ?? ""} /></Field>
                  <Field name="damages" label="Avarias preexistentes"><Textarea id="damages" name="damages" rows={2} defaultValue={o.damages ?? ""} /></Field>
                  <Field name="notes" label="Observações"><Textarea id="notes" name="notes" rows={2} defaultValue={o.notes ?? ""} /></Field>
                  <SubmitButton size="sm" variant="secondary" className="w-full">Salvar alterações</SubmitButton>
                  <p className="text-[11px] text-ink-500">As alterações ficam registradas na linha do tempo.</p>
                </ActionForm>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
