import Link from "next/link";
import type { Metadata } from "next";
import { can, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEmployees, getServices } from "@/lib/data";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { buttonClass } from "@/components/ui/button";
import { Alert, PageHeader } from "@/components/ui/layout-bits";
import { ActionForm, Field } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { CustomerPicker } from "@/components/domain/customer-picker";
import { CHANNELS } from "@/lib/constants";
import { minutes, money, plate } from "@/lib/format";
import { createAppointment } from "@/actions/agenda";
import type { Customer, Vehicle } from "@/lib/types";

export const metadata: Metadata = { title: "Novo agendamento" };

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<{ cliente?: string; q?: string; veiculo?: string }> }) {
  const { profile } = await requireUser();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: customer } = sp.cliente ? await supabase.from("customers").select("*").eq("id", sp.cliente).eq("active", true).maybeSingle<Customer>() : { data: null };
  const [vehicles, services, employees] = await Promise.all([
    customer ? supabase.from("vehicles").select("*").eq("customer_id", customer.id).eq("active", true).order("created_at") : Promise.resolve({ data: [] }),
    getServices(),
    getEmployees(),
  ]);
  const vlist = (vehicles.data ?? []) as Vehicle[];
  const self = `/agenda/novo${customer ? `?cliente=${customer.id}` : ""}`;

  return (
    <>
      <PageHeader title="Novo agendamento" back={{ href: "/agenda", label: "Agenda" }}
        description="Registre compromissos combinados por telefone, WhatsApp ou presencialmente. O sistema verifica horário de funcionamento, boxes e conflitos do funcionário." />
      {!customer ? (
        <Card className="max-w-3xl">
          <CardHeader title="1. Cliente" />
          <CardBody><CustomerPicker basePath="/agenda/novo" q={sp.q} canCreate={can(profile, "customers")} /></CardBody>
        </Card>
      ) : (
        <Card className="max-w-3xl">
          <CardHeader title={`Cliente: ${customer.full_name}`} action={<Link href="/agenda/novo" className={buttonClass("ghost", "sm")}>Trocar</Link>} />
          <CardBody>
            {vlist.length === 0 ? (
              <Alert tone="warn">
                Este cliente não tem veículos ativos.{" "}
                {can(profile, "customers") ? <Link href={`/veiculos/novo?cliente=${customer.id}&voltar=${encodeURIComponent(self)}`} className="font-semibold underline">Cadastrar veículo</Link> : null}
              </Alert>
            ) : (
              <ActionForm action={createAppointment} className="space-y-5">
                <input type="hidden" name="customer_id" value={customer.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="vehicle_id" label="Veículo" required>
                    <Select id="vehicle_id" name="vehicle_id" defaultValue={sp.veiculo ?? vlist[0]?.id}>
                      {vlist.map((v) => <option key={v.id} value={v.id}>{plate(v.plate)} · {v.brand} {v.model}</option>)}
                    </Select>
                  </Field>
                  <Field name="starts_at" label="Data e horário" required>
                    <Input id="starts_at" name="starts_at" type="datetime-local" step={900} required />
                  </Field>
                  <Field name="employee_id" label="Funcionário responsável" hint="Evita conflito de horários do funcionário.">
                    <Select id="employee_id" name="employee_id" defaultValue="">
                      <option value="">Sem responsável definido</option>
                      {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                    </Select>
                  </Field>
                  <Field name="channel" label="Agendado por">
                    <Select id="channel" name="channel" defaultValue="whatsapp">
                      {Object.entries(CHANNELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </Select>
                  </Field>
                </div>
                <Field name="service_ids" label="Serviços" required>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {services.map((s) => (
                      <label key={s.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-ink-700 p-3 text-sm has-[:checked]:border-brand-500/60 has-[:checked]:bg-brand-500/5">
                        <input type="checkbox" name="service_ids" value={s.id} className="mt-0.5 accent-[var(--color-brand-500)]" />
                        <span>{s.name}<span className="block text-xs text-ink-400">{money(s.default_price)} · {minutes(s.estimated_minutes)}</span></span>
                      </label>
                    ))}
                  </div>
                </Field>
                <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                  <Field name="duration" label="Duração (min)" hint="Vazio = soma dos serviços">
                    <Input id="duration" name="duration" type="number" min={5} step={5} />
                  </Field>
                  <Field name="notes" label="Observações">
                    <Textarea id="notes" name="notes" rows={2} placeholder="Ex.: cliente vai deixar o carro às 8h" />
                  </Field>
                </div>
                <SubmitButton pendingText="Verificando horário…">Agendar</SubmitButton>
              </ActionForm>
            )}
          </CardBody>
        </Card>
      )}
    </>
  );
}
