import Link from "next/link";
import type { Metadata } from "next";
import { Check, ClipboardList, Plus } from "lucide-react";
import { can, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEmployees, getServices } from "@/lib/data";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { Alert, PageHeader } from "@/components/ui/layout-bits";
import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { CustomerPicker } from "@/components/domain/customer-picker";
import { VehicleFields } from "@/components/domain/vehicle-fields";
import { EntryForm } from "@/components/domain/entry-form";
import { Plate } from "@/components/domain/plate";
import { createVehicle } from "@/actions/vehicles";
import { VEHICLE_TYPES } from "@/lib/constants";
import { osNumber, phone } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Appointment, Customer, Vehicle } from "@/lib/types";

export const metadata: Metadata = { title: "Entrada de veículo" };

type SP = { cliente?: string; veiculo?: string; q?: string; agendamento?: string; novo?: string };

export default async function EntryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { profile, employee } = await requireUser();
  const sp = await searchParams;
  const supabase = await createClient();

  // Conversão de agendamento: traz cliente, veículo e serviços do compromisso
  let appointment: (Appointment & { appointment_services: { service_id: string }[] }) | null = null;
  if (sp.agendamento) {
    const { data } = await supabase.from("appointments").select("*, appointment_services(service_id)").eq("id", sp.agendamento).in("status", ["scheduled", "confirmed"]).maybeSingle();
    appointment = data as typeof appointment;
  }
  const customerId = appointment?.customer_id ?? sp.cliente;
  const vehicleId = appointment?.vehicle_id ?? sp.veiculo;

  const { data: customer } = customerId ? await supabase.from("customers").select("*").eq("id", customerId).maybeSingle<Customer>() : { data: null };
  const { data: vehicles } = customer
    ? await supabase.from("vehicles").select("*, service_orders(id, number, status)").eq("customer_id", customer.id).eq("active", true).order("created_at")
    : { data: null };
  const vlist = (vehicles ?? []) as (Vehicle & { service_orders: { id: string; number: number; status: string }[] })[];
  const openOf = (v: (typeof vlist)[number]) => v.service_orders.find((o) => o.status !== "delivered" && o.status !== "cancelled");
  const vehicle = vehicleId ? vlist.find((v) => v.id === vehicleId) ?? null : null;
  const step = !customer ? 1 : !vehicle ? 2 : 3;
  const base = (extra: Record<string, string>) => `/entrada?${new URLSearchParams({ ...(sp.agendamento ? { agendamento: sp.agendamento } : {}), ...extra })}`;

  return (
    <>
      <PageHeader title="Entrada de veículo" description="Selecione o cliente e o veículo, informe os serviços e o estado inicial. A OS é aberta ao salvar." />
      {appointment ? <Alert tone="info" className="mb-5">Convertendo agendamento em ordem de serviço: os serviços agendados já foram incluídos.</Alert> : null}

      <ol className="mb-6 grid grid-cols-3 gap-2 text-xs font-semibold">
        {["Cliente", "Veículo", "Serviços e estado inicial"].map((label, i) => (
          <li key={label} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2", step === i + 1 ? "border-gold-500/50 bg-gold-500/5 text-gold-300" : step > i + 1 ? "border-ink-700 text-ink-300" : "border-ink-800 text-ink-500")}>
            <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]", step > i + 1 ? "bg-gold-500 text-ink-950" : "border border-current")}>
              {step > i + 1 ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className="truncate">{label}</span>
          </li>
        ))}
      </ol>

      {customer ? (
        <Card className="mb-4">
          <CardBody className="flex flex-wrap items-center justify-between gap-3 py-3.5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Cliente</p>
              <p className="font-semibold">{customer.full_name}</p>
              <p className="text-xs text-ink-400">{phone(customer.whatsapp ?? customer.phone)}{customer.email ? ` · ${customer.email}` : ""}</p>
            </div>
            {!appointment ? <Link href="/entrada" className={buttonClass("ghost", "sm")}>Trocar cliente</Link> : null}
          </CardBody>
        </Card>
      ) : null}
      {customer && !customer.active ? <Alert tone="error" className="mb-4">Este cliente está desativado. Reative o cadastro para registrar uma entrada.</Alert> : null}

      {step === 1 ? (
        <Card className="max-w-3xl">
          <CardHeader title="1. Selecione o cliente" />
          <CardBody><CustomerPicker basePath="/entrada" q={sp.q} canCreate={can(profile, "customers")} /></CardBody>
        </Card>
      ) : null}

      {step === 2 && customer?.active ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="2. Selecione o veículo" />
            <CardBody>
              {vlist.length === 0 ? <p className="text-sm text-ink-400">Este cliente ainda não tem veículos. Cadastre ao lado.</p> : (
                <ul className="space-y-2">
                  {vlist.map((v) => {
                    const open = openOf(v);
                    return (
                      <li key={v.id}>
                        {open ? (
                          <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-800 p-3 opacity-80">
                            <span className="flex items-center gap-3"><Plate value={v.plate} /> <span className="text-sm">{v.brand} {v.model}</span></span>
                            <Link href={`/ordens/${open.id}`} className="text-xs font-semibold text-amber-200 hover:underline">Já na empresa · {osNumber(open.number)}</Link>
                          </div>
                        ) : (
                          <Link href={base({ cliente: customer.id, veiculo: v.id })} className="flex items-center justify-between gap-3 rounded-lg border border-ink-800 p-3 transition-colors hover:border-gold-500/50 hover:bg-ink-850">
                            <span className="flex items-center gap-3">
                              <Plate value={v.plate} />
                              <span className="text-sm">
                                <span className="block font-medium">{v.brand} {v.model}</span>
                                <span className="block text-xs text-ink-400">{[v.model_year, v.color, VEHICLE_TYPES[v.vehicle_type]].filter(Boolean).join(" · ")}</span>
                              </span>
                            </span>
                            <span className="text-xs font-semibold text-gold-300">Selecionar →</span>
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
          {can(profile, "customers") ? (
            <Card>
              <CardHeader title="Ou cadastre um novo veículo" />
              <CardBody>
                <ActionForm action={createVehicle} className="space-y-4">
                  <input type="hidden" name="customer_id" value={customer.id} />
                  <input type="hidden" name="return_to" value={base({ cliente: customer.id })} />
                  <VehicleFields compact />
                  <SubmitButton variant="secondary"><Plus /> Cadastrar e selecionar</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      {step === 3 && customer?.active && vehicle ? (
        openOf(vehicle) ? (
          <Alert tone="warn">
            Este veículo já está na empresa. <Link href={`/ordens/${openOf(vehicle)!.id}`} className="font-semibold underline">Abrir {osNumber(openOf(vehicle)!.number)}</Link>
          </Alert>
        ) : (
          <Card>
            <CardHeader
              title={<span className="flex flex-wrap items-center gap-3">3. Serviços e estado inicial <Plate value={vehicle.plate} size="sm" /> <span className="font-normal text-ink-300">{vehicle.brand} {vehicle.model}</span></span>}
              action={!appointment ? <Link href={base({ cliente: customer.id })} className={buttonClass("ghost", "sm")}>Trocar veículo</Link> : null}
            />
            <CardBody>
              <EntryFormLoader
                customerId={customer.id}
                vehicle={vehicle}
                appointment={appointment}
                canDiscount={can(profile, "discounts")}
                myEmployeeId={employee?.id}
              />
            </CardBody>
          </Card>
        )
      ) : null}
      {step === 3 && !vehicle ? <Alert tone="error"><ClipboardList className="mr-1 inline h-4 w-4" />Veículo não encontrado.</Alert> : null}
    </>
  );
}

async function EntryFormLoader({ customerId, vehicle, appointment, canDiscount, myEmployeeId }: {
  customerId: string; vehicle: Vehicle; appointment: (Appointment & { appointment_services: { service_id: string }[] }) | null; canDiscount: boolean; myEmployeeId?: string;
}) {
  const [services, employees] = await Promise.all([getServices(), getEmployees()]);
  return (
    <EntryForm
      services={services}
      employees={employees}
      canDiscount={canDiscount}
      defaults={{
        customerId,
        vehicleId: vehicle.id,
        appointmentId: appointment?.id,
        responsibleId: appointment?.employee_id ?? myEmployeeId,
        mileage: vehicle.mileage_km,
        notes: appointment?.notes,
        serviceIds: appointment?.appointment_services.map((s) => s.service_id),
        executorId: appointment?.employee_id,
      }}
    />
  );
}
