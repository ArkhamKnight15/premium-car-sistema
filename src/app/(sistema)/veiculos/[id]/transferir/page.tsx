import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requirePerm } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout-bits";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { CustomerPicker } from "@/components/domain/customer-picker";
import { transferVehicle } from "@/actions/vehicles";
import { plate } from "@/lib/format";

export const metadata: Metadata = { title: "Transferir veículo" };

export default async function TransferPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; cliente?: string }> }) {
  await requirePerm("customers");
  const { id } = await params;
  const { q, cliente } = await searchParams;
  const supabase = await createClient();
  const { data: v } = await supabase.from("vehicles").select("id, plate, brand, model, customer_id, customers(full_name)").eq("id", id).maybeSingle();
  if (!v) notFound();
  const { data: target } = cliente ? await supabase.from("customers").select("id, full_name").eq("id", cliente).maybeSingle() : { data: null };
  const current = (v.customers as unknown as { full_name: string } | null)?.full_name;

  return (
    <>
      <PageHeader title="Transferir proprietário" back={{ href: `/veiculos/${id}`, label: "Voltar ao veículo" }}
        description={`${v.brand} ${v.model} · ${plate(v.plate)} · proprietário atual: ${current ?? "—"}`} />
      <Card className="max-w-2xl">
        <CardHeader title={target ? "Confirmar transferência" : "Selecione o novo proprietário"} />
        <CardBody>
          {target && target.id !== v.customer_id ? (
            <ConfirmAction action={transferVehicle} fields={{ id, customer_id: target.id }} variant="primary" size="md"
              label={`Transferir para ${target.full_name}`}
              question={`O veículo passará para ${target.full_name}. As ordens de serviço anteriores continuam no histórico de ${current}.`}
              confirmLabel="Confirmar transferência" />
          ) : (
            <CustomerPicker basePath={`/veiculos/${id}/transferir`} q={q} canCreate={false} />
          )}
        </CardBody>
      </Card>
    </>
  );
}
