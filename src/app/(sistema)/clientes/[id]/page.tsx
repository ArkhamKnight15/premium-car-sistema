import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarPlus, Car, ClipboardList, Download, Pencil, Plus, ShieldAlert, UserCheck, UserX } from "lucide-react";
import { can, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Alert, DataTable, EmptyState, InfoList, PageHeader } from "@/components/ui/layout-bits";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { AppointmentBadge, OrderStatusBadge, PaymentBadge } from "@/components/domain/badges";
import { Plate } from "@/components/domain/plate";
import { VEHICLE_TYPES } from "@/lib/constants";
import { cep, date, dateTime, doc, money, osNumber, phone } from "@/lib/format";
import type { AppointmentStatus, Customer, OrderStatus, PaymentStatus, Vehicle } from "@/lib/types";
import { anonymizeCustomer, setCustomerActive } from "@/actions/customers";

export const metadata: Metadata = { title: "Cliente" };

type OrderRow = {
  id: string; number: number; status: OrderStatus; entered_at: string; delivered_at: string | null; total: number; amount_paid: number;
  payment_status: PaymentStatus; vehicles: { brand: string; model: string; plate: string | null } | null; service_order_items: { description: string }[];
};

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { profile, isAdmin } = await requireUser();
  const { id } = await params;
  const supabase = await createClient();
  const { data: c } = await supabase.from("customers").select("*").eq("id", id).maybeSingle<Customer>();
  if (!c) notFound();

  const [vehicles, orders, appts] = await Promise.all([
    supabase.from("vehicles").select("*").eq("customer_id", id).order("active", { ascending: false }).order("created_at"),
    supabase
      .from("service_orders")
      .select("id, number, status, entered_at, delivered_at, total, amount_paid, payment_status, vehicles(brand, model, plate), service_order_items(description)")
      .eq("customer_id", id)
      .order("entered_at", { ascending: false }),
    supabase.from("appointments").select("id, starts_at, status").eq("customer_id", id).in("status", ["scheduled", "confirmed"]).gte("starts_at", new Date().toISOString()).order("starts_at").limit(5),
  ]);
  const vlist = (vehicles.data ?? []) as Vehicle[];
  const olist = (orders.data ?? []) as unknown as OrderRow[];
  const valid = olist.filter((o) => o.status !== "cancelled");
  const totalSpent = valid.reduce((a, o) => a + Number(o.amount_paid), 0);
  const balance = valid.reduce((a, o) => a + Math.max(Number(o.total) - Number(o.amount_paid), 0), 0);
  const canEdit = can(profile, "customers") && !c.anonymized_at;
  const address = [c.street && `${c.street}${c.number ? `, ${c.number}` : ""}`, c.complement, c.district, c.city && `${c.city}${c.state ? `/${c.state}` : ""}`, c.zip_code && `CEP ${cep(c.zip_code)}`].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader
        back={{ href: "/clientes", label: "Clientes" }}
        title={<span className="flex flex-wrap items-center gap-2">{c.full_name}{!c.active ? <Badge>{c.anonymized_at ? "Anonimizado" : "Inativo"}</Badge> : null}</span>}
        description={`${c.person_type === "PF" ? "Pessoa física" : "Pessoa jurídica"} · cliente desde ${date(c.created_at)}`}
        actions={c.active ? (
          <>
            {canEdit ? <Link href={`/clientes/${id}/editar`} className={buttonClass("secondary")}><Pencil /> Editar</Link> : null}
            <Link href={`/agenda/novo?cliente=${id}`} className={buttonClass("secondary")}><CalendarPlus /> Agendar</Link>
            <Link href={`/entrada?cliente=${id}`} className={buttonClass("primary")}><Plus /> Entrada de veículo</Link>
          </>
        ) : null}
      />

      {!c.active && !c.anonymized_at ? (
        <Alert tone="warn" className="mb-6">Cadastro desativado em {dateTime(c.deactivated_at)}{c.deactivation_reason ? ` — ${c.deactivation_reason}` : ""}. O histórico continua disponível.</Alert>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Atendimentos" value={valid.length} />
        <MiniStat label="Veículos" value={vlist.filter((v) => v.active).length} />
        <MiniStat label="Total pago" value={money(totalSpent)} />
        <MiniStat label="Saldo em aberto" value={money(balance)} highlight={balance > 0} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Histórico de atendimentos" description="Todas as ordens de serviço deste cliente." />
            {olist.length === 0 ? (
              <EmptyState icon={ClipboardList} title="Nenhum atendimento ainda" action={c.active ? <Link href={`/entrada?cliente=${id}`} className={buttonClass("outline", "sm")}>Registrar entrada</Link> : null} />
            ) : (
              <DataTable head={["OS", "Veículo", "Serviços", "Entrada", "Total", "Pagamento", "Status"]} align={["left", "left", "left", "left", "right", "left", "left"]} minWidth={860}>
                {olist.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/ordens/${o.id}`} className="font-semibold text-gold-300 hover:underline">{osNumber(o.number)}</Link></td>
                    <td className="whitespace-nowrap">{o.vehicles?.brand} {o.vehicles?.model}<span className="block text-xs text-ink-500">{o.vehicles?.plate ?? "sem placa"}</span></td>
                    <td className="max-w-[240px] truncate text-ink-300">{o.service_order_items.map((i) => i.description).join(", ")}</td>
                    <td className="whitespace-nowrap text-ink-300">{date(o.entered_at)}</td>
                    <td className="text-right tabular-nums">{money(o.total)}</td>
                    <td><PaymentBadge status={o.payment_status} /></td>
                    <td><OrderStatusBadge status={o.status} short /></td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>

          <Card>
            <CardHeader title="Veículos" action={canEdit ? <Link href={`/veiculos/novo?cliente=${id}`} className={buttonClass("outline", "sm")}><Plus /> Adicionar veículo</Link> : null} />
            <CardBody>
              {vlist.length === 0 ? (
                <EmptyState icon={Car} title="Nenhum veículo cadastrado" className="py-6" />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {vlist.map((v) => (
                    <li key={v.id}>
                      <Link href={`/veiculos/${v.id}`} className="flex items-center gap-3 rounded-lg border border-ink-800 p-3 transition-colors hover:border-ink-600">
                        <Plate value={v.plate} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{v.brand} {v.model}</span>
                          <span className="block text-xs text-ink-400">{[v.model_year ?? v.manufacture_year, v.color, VEHICLE_TYPES[v.vehicle_type]].filter(Boolean).join(" · ")}{!v.active ? " · inativo" : ""}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Dados do cliente" />
            <CardBody>
              <InfoList cols={1} items={[
                [c.person_type === "PF" ? "CPF" : "CNPJ", c.document ? doc(c.document) : null],
                ["Telefone", c.phone ? phone(c.phone) : null],
                ["WhatsApp", c.whatsapp ? <a href={`https://wa.me/55${c.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-gold-300 hover:underline">{phone(c.whatsapp)}</a> : null],
                ["E-mail", c.email],
                ["Endereço", address || null],
                ["Observações internas", c.notes ? <span className="whitespace-pre-line">{c.notes}</span> : null],
              ]} />
            </CardBody>
          </Card>

          {(appts.data ?? []).length ? (
            <Card>
              <CardHeader title="Próximos compromissos" />
              <CardBody className="space-y-2">
                {(appts.data ?? []).map((a) => (
                  <Link key={a.id} href={`/agenda/${a.id}`} className="flex items-center justify-between rounded-lg border border-ink-800 px-3 py-2 text-sm hover:border-ink-600">
                    {dateTime(a.starts_at)} <AppointmentBadge status={a.status as AppointmentStatus} />
                  </Link>
                ))}
              </CardBody>
            </Card>
          ) : null}

          {canEdit || isAdmin ? (
            <Card>
              <CardHeader title="Cadastro e LGPD" />
              <CardBody className="space-y-3">
                {canEdit ? (
                  c.active ? (
                    <ConfirmAction action={setCustomerActive} fields={{ id, active: "false" }} label="Desativar cadastro" icon={<UserX />} variant="secondary"
                      question="Desativar este cliente? Ele deixa de aparecer nas buscas de entrada, mas todo o histórico é mantido."
                      confirmLabel="Desativar" reasonPlaceholder="Motivo (ex.: cadastro duplicado)" />
                  ) : (
                    <ConfirmAction action={setCustomerActive} fields={{ id, active: "true" }} label="Reativar cadastro" icon={<UserCheck />} variant="secondary"
                      question="Reativar este cliente?" confirmLabel="Reativar" />
                  )
                ) : null}
                {isAdmin && !c.anonymized_at ? (
                  <>
                    <a href={`/clientes/${id}/exportar`} className={buttonClass("ghost", "sm")}><Download /> Exportar dados (LGPD)</a>
                    <ConfirmAction action={anonymizeCustomer} fields={{ id }} label="Anonimizar dados pessoais" icon={<ShieldAlert />}
                      question="Ação irreversível: nome, documentos, contatos e endereço serão apagados. OS e pagamentos são preservados. Continuar?"
                      confirmLabel="Anonimizar definitivamente" />
                  </>
                ) : null}
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${highlight ? "text-gold-300" : ""}`}>{value}</p>
    </div>
  );
}
