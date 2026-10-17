import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarCheck, CalendarX, ClipboardList, MessageCircle, UserX } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEmployees } from "@/lib/data";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { buttonClass } from "@/components/ui/button";
import { Alert, InfoList, PageHeader } from "@/components/ui/layout-bits";
import { ActionForm, Field } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { AppointmentBadge } from "@/components/domain/badges";
import { Plate } from "@/components/domain/plate";
import { CHANNELS } from "@/lib/constants";
import { dateTime, longDate, minutes, money, osNumber, phone, time, toLocalInput } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";
import type { Appointment, Customer, Vehicle } from "@/lib/types";
import { rescheduleAppointment, setAppointmentStatus, updateAppointmentNotes } from "@/actions/agenda";

export const metadata: Metadata = { title: "Compromisso" };

export default async function AppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const supabase = await createClient();
  const { data: a } = await supabase.from("appointments").select("*").eq("id", id).maybeSingle<Appointment>();
  if (!a) notFound();
  const [c, v, svc, employees, order] = await Promise.all([
    supabase.from("customers").select("*").eq("id", a.customer_id).single<Customer>(),
    supabase.from("vehicles").select("*").eq("id", a.vehicle_id).single<Vehicle>(),
    supabase.from("appointment_services").select("*").eq("appointment_id", id),
    getEmployees(true),
    a.service_order_id ? supabase.from("service_orders").select("id, number").eq("id", a.service_order_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const active = a.status === "scheduled" || a.status === "confirmed";
  const durationMin = Math.round((new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000);
  const employee = employees.find((e) => e.id === a.employee_id);
  const wa = c.data?.whatsapp ?? c.data?.phone;
  const waText = `Olá, ${c.data?.full_name.split(" ")[0]}! Confirmando seu horário na Premium Car: ${longDate(a.starts_at)} às ${time(a.starts_at)} (${v.data?.brand} ${v.data?.model}).`;

  return (
    <>
      <PageHeader back={{ href: "/agenda", label: "Agenda" }}
        title={<span className="flex flex-wrap items-center gap-3"><span className="capitalize">{longDate(a.starts_at)}</span> · {time(a.starts_at)} <AppointmentBadge status={a.status} /></span>}
        description={`Até ${time(a.ends_at)} (${minutes(durationMin)}) · agendado por ${CHANNELS[a.channel]}`}
        actions={
          <>
            {wa ? <a href={whatsappLink(wa, waText)} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost")}><MessageCircle /> WhatsApp</a> : null}
            {order.data ? <Link href={`/ordens/${order.data.id}`} className={buttonClass("primary")}><ClipboardList /> Ver {osNumber(order.data.number)}</Link>
              : active ? <Link href={`/entrada?agendamento=${id}`} className={buttonClass("primary")}><ClipboardList /> Veículo chegou: abrir OS</Link> : null}
          </>
        }
      />
      {a.status === "cancelled" ? <Alert tone="error" className="mb-5">Cancelado — {a.cancel_reason}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Cliente e veículo" />
            <CardBody className="space-y-4">
              <div>
                <Link href={`/clientes/${c.data?.id}`} className="font-semibold hover:text-brand-300">{c.data?.full_name}</Link>
                <p className="text-sm text-ink-400">{phone(wa)}{c.data?.email ? ` · ${c.data.email}` : ""}</p>
              </div>
              <Link href={`/veiculos/${v.data?.id}`} className="inline-flex items-center gap-3 rounded-lg border border-ink-800 p-3 hover:border-ink-600">
                <Plate value={v.data?.plate} /><span className="text-sm">{v.data?.brand} {v.data?.model}</span>
              </Link>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Serviços" />
            <CardBody>
              <ul className="space-y-2 text-sm">
                {(svc.data ?? []).map((s) => (
                  <li key={s.service_id} className="flex justify-between gap-3"><span>{s.name} <span className="text-ink-500">· {minutes(s.estimated_minutes)}</span></span><span className="tabular-nums text-ink-300">{money(s.price)}</span></li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-ink-500">Valores de referência do catálogo no momento do agendamento. O valor final é definido na OS.</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Observações" />
            <CardBody>
              <ActionForm action={updateAppointmentNotes} className="space-y-3">
                <input type="hidden" name="id" value={id} />
                <Textarea name="notes" rows={3} defaultValue={a.notes ?? ""} aria-label="Observações" />
                <SubmitButton size="sm" variant="secondary">Salvar observações</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Detalhes" />
            <CardBody>
              <InfoList cols={1} items={[["Início", dateTime(a.starts_at)], ["Término previsto", dateTime(a.ends_at)], ["Funcionário", employee?.full_name], ["Canal", CHANNELS[a.channel]]]} />
            </CardBody>
          </Card>
          {active ? (
            <>
              <Card>
                <CardHeader title="Situação" />
                <CardBody className="flex flex-wrap gap-2">
                  {a.status === "scheduled" ? <ConfirmAction action={setAppointmentStatus} fields={{ id, status: "confirmed" }} label="Confirmar" icon={<CalendarCheck />} variant="secondary" question="Marcar como confirmado pelo cliente?" confirmLabel="Confirmar" /> : null}
                  <ConfirmAction action={setAppointmentStatus} fields={{ id, status: "no_show" }} label="Não compareceu" icon={<UserX />} variant="ghost" question="Registrar que o cliente não compareceu? O horário é liberado." confirmLabel="Registrar" />
                  <ConfirmAction action={setAppointmentStatus} fields={{ id, status: "cancelled" }} label="Cancelar" icon={<CalendarX />} question="Cancelar este compromisso?" confirmLabel="Cancelar compromisso" reasonPlaceholder="Motivo do cancelamento" />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Reagendar" />
                <CardBody>
                  <ActionForm action={rescheduleAppointment} className="space-y-3">
                    <input type="hidden" name="id" value={id} />
                    <Field name="starts_at" label="Nova data e horário"><Input id="starts_at" name="starts_at" type="datetime-local" step={900} defaultValue={toLocalInput(a.starts_at)} /></Field>
                    <Field name="employee_id" label="Funcionário">
                      <Select id="employee_id" name="employee_id" defaultValue={a.employee_id ?? ""}>
                        <option value="">Sem responsável</option>
                        {employees.filter((e) => e.active).map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                      </Select>
                    </Field>
                    <SubmitButton size="sm" className="w-full" pendingText="Verificando…">Reagendar</SubmitButton>
                  </ActionForm>
                </CardBody>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
