/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeftRight, Ban, Camera, CheckCircle2, ClipboardList, Pencil, Plus } from "lucide-react";
import { can, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Alert, DataTable, EmptyState, InfoList, PageHeader } from "@/components/ui/layout-bits";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { OrderStatusBadge, PaymentBadge } from "@/components/domain/badges";
import { Plate } from "@/components/domain/plate";
import { PHOTO_KIND, VEHICLE_TYPES } from "@/lib/constants";
import { date, dateTime, km, money, osNumber, phone } from "@/lib/format";
import type { OrderStatus, PaymentStatus, PhotoKind, Vehicle } from "@/lib/types";
import { setVehicleActive } from "@/actions/vehicles";

export const metadata: Metadata = { title: "Veículo" };

type OrderRow = {
  id: string; number: number; status: OrderStatus; entered_at: string; delivered_at: string | null; total: number; payment_status: PaymentStatus;
  initial_condition: string | null; damages: string | null; service_order_items: { description: string }[];
};

export default async function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { profile } = await requireUser();
  const { id } = await params;
  const supabase = await createClient();
  const { data: v } = await supabase.from("vehicles").select("*").eq("id", id).maybeSingle<Vehicle>();
  if (!v) notFound();

  const [owner, orders] = await Promise.all([
    supabase.from("customers").select("id, full_name, phone, whatsapp, email, active").eq("id", v.customer_id).single(),
    supabase
      .from("service_orders")
      .select("id, number, status, entered_at, delivered_at, total, payment_status, initial_condition, damages, service_order_items(description)")
      .eq("vehicle_id", id)
      .order("entered_at", { ascending: false }),
  ]);
  const olist = (orders.data ?? []) as unknown as OrderRow[];
  const orderIds = olist.map((o) => o.id);
  const { data: photoRows } = orderIds.length
    ? await supabase.from("order_photos").select("id, order_id, storage_path, kind, caption, created_at").in("order_id", orderIds).is("removed_at", null).order("created_at", { ascending: false }).limit(24)
    : { data: [] };
  const photos = (photoRows ?? []) as { id: string; order_id: string; storage_path: string; kind: PhotoKind; caption: string | null; created_at: string }[];
  const signed = photos.length ? (await supabase.storage.from("order-photos").createSignedUrls(photos.map((p) => p.storage_path), 900)).data ?? [] : [];
  const open = olist.find((o) => o.status !== "delivered" && o.status !== "cancelled");
  const valid = olist.filter((o) => o.status !== "cancelled");
  const editable = can(profile, "customers");
  const numberOf = new Map(olist.map((o) => [o.id, o.number]));

  return (
    <>
      <PageHeader
        back={{ href: "/veiculos", label: "Veículos" }}
        title={<span className="flex flex-wrap items-center gap-3"><Plate value={v.plate} size="lg" /> {v.brand} {v.model} {!v.active ? <Badge>Inativo</Badge> : null}</span>}
        actions={
          <>
            {editable ? <Link href={`/veiculos/${id}/editar`} className={buttonClass("secondary")}><Pencil /> Editar</Link> : null}
            {open ? (
              <Link href={`/ordens/${open.id}`} className={buttonClass("primary")}><ClipboardList /> OS em aberto · {osNumber(open.number)}</Link>
            ) : v.active ? (
              <Link href={`/entrada?cliente=${v.customer_id}&veiculo=${id}`} className={buttonClass("primary")}><Plus /> Registrar entrada</Link>
            ) : null}
          </>
        }
      />
      {open ? <Alert tone="info" className="mb-6">Este veículo está na empresa ({osNumber(open.number)}, entrada em {dateTime(open.entered_at)}).</Alert> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Histórico de serviços" description={`${valid.length} atendimento(s) · ${money(valid.reduce((a, o) => a + Number(o.total), 0))} em serviços`} />
            {olist.length === 0 ? (
              <EmptyState icon={ClipboardList} title="Nenhum atendimento registrado" />
            ) : (
              <DataTable head={["OS", "Entrada", "Saída", "Serviços", "Valor", "Pagamento", "Status"]} align={["left", "left", "left", "left", "right", "left", "left"]} minWidth={880}>
                {olist.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/ordens/${o.id}`} className="font-semibold text-brand-300 hover:underline">{osNumber(o.number)}</Link></td>
                    <td className="whitespace-nowrap text-ink-300">{dateTime(o.entered_at)}</td>
                    <td className="whitespace-nowrap text-ink-300">{o.delivered_at ? dateTime(o.delivered_at) : "—"}</td>
                    <td className="max-w-[260px] text-ink-300">
                      <span className="line-clamp-2">{o.service_order_items.map((i) => i.description).join(", ")}</span>
                      {o.damages ? <span className="mt-0.5 block truncate text-xs text-amber-200/80">Avarias: {o.damages}</span> : null}
                    </td>
                    <td className="text-right tabular-nums">{money(o.total)}</td>
                    <td><PaymentBadge status={o.payment_status} /></td>
                    <td><OrderStatusBadge status={o.status} short /></td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>

          <Card>
            <CardHeader title="Fotos dos atendimentos" description="Últimas 24 fotos de entrada, avarias, andamento e finalização." />
            <CardBody>
              {photos.length === 0 ? (
                <EmptyState icon={Camera} title="Nenhuma foto anexada" className="py-6" />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {photos.map((p, i) => (
                    <a key={p.id} href={signed[i]?.signedUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="group overflow-hidden rounded-lg border border-ink-800 bg-ink-850">
                      {signed[i]?.signedUrl ? <img src={signed[i]!.signedUrl} alt={p.caption ?? PHOTO_KIND[p.kind]} className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-[1.03]" loading="lazy" /> : <div className="aspect-[4/3]" />}
                      <span className="block truncate px-2 py-1.5 text-[11px] text-ink-400">{PHOTO_KIND[p.kind]} · {osNumber(numberOf.get(p.order_id) ?? 0)} · {date(p.created_at)}</span>
                    </a>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Dados do veículo" />
            <CardBody>
              <InfoList items={[
                ["Marca", v.brand], ["Modelo", v.model],
                ["Ano fabricação", v.manufacture_year], ["Ano modelo", v.model_year],
                ["Cor", v.color], ["Tipo", VEHICLE_TYPES[v.vehicle_type]],
                ["Quilometragem", km(v.mileage_km)], ["Cadastrado em", date(v.created_at)],
              ]} />
              {v.notes ? <p className="mt-4 whitespace-pre-line rounded-lg border border-ink-800 bg-ink-850 p-3 text-sm text-ink-300">{v.notes}</p> : null}
              {valid[0]?.initial_condition ? (
                <div className="mt-4 text-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Estado na última entrada</p>
                  <p className="mt-1 text-ink-300">{valid[0].initial_condition}</p>
                </div>
              ) : null}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Proprietário" action={editable && !open ? <Link href={`/veiculos/${id}/transferir`} className={buttonClass("ghost", "xs")}><ArrowLeftRight /> Transferir</Link> : null} />
            <CardBody>
              <Link href={`/clientes/${owner.data?.id}`} className="font-semibold hover:text-brand-300">{owner.data?.full_name}</Link>
              <p className="mt-1 text-sm text-ink-400">{phone(owner.data?.whatsapp ?? owner.data?.phone)}{owner.data?.email ? ` · ${owner.data.email}` : ""}</p>
            </CardBody>
          </Card>
          {editable ? (
            <Card>
              <CardHeader title="Cadastro" />
              <CardBody>
                {v.active ? (
                  <ConfirmAction action={setVehicleActive} fields={{ id, active: "false" }} label="Desativar veículo" icon={<Ban />} variant="secondary"
                    question="Desativar este veículo (ex.: vendido)? O histórico continua disponível." confirmLabel="Desativar" />
                ) : (
                  <ConfirmAction action={setVehicleActive} fields={{ id, active: "true" }} label="Reativar veículo" icon={<CheckCircle2 />} variant="secondary" question="Reativar este veículo?" confirmLabel="Reativar" />
                )}
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
