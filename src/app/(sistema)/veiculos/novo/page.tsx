import type { Metadata } from "next";
import { requirePerm } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout-bits";
import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { VehicleFields } from "@/components/domain/vehicle-fields";
import { CustomerPicker } from "@/components/domain/customer-picker";
import { createVehicle } from "@/actions/vehicles";

export const metadata: Metadata = { title: "Novo veículo" };

export default async function NewVehiclePage({ searchParams }: { searchParams: Promise<{ cliente?: string; q?: string; voltar?: string }> }) {
  await requirePerm("customers");
  const { cliente, q, voltar } = await searchParams;
  const supabase = await createClient();
  const { data: owner } = cliente ? await supabase.from("customers").select("id, full_name").eq("id", cliente).eq("active", true).maybeSingle() : { data: null };

  return (
    <>
      <PageHeader title="Novo veículo" back={{ href: voltar ?? (owner ? `/clientes/${owner.id}` : "/veiculos"), label: "Voltar" }} />
      <Card className="max-w-3xl">
        {!owner ? (
          <>
            <CardHeader title="1. Proprietário" description="Selecione o cliente dono do veículo." />
            <CardBody><CustomerPicker basePath="/veiculos/novo" q={q} canCreate keep={voltar ? { voltar } : {}} /></CardBody>
          </>
        ) : (
          <>
            <CardHeader title={`Proprietário: ${owner.full_name}`} />
            <CardBody>
              <ActionForm action={createVehicle} className="space-y-5">
                <input type="hidden" name="customer_id" value={owner.id} />
                {voltar ? <input type="hidden" name="return_to" value={voltar} /> : null}
                <VehicleFields />
                <SubmitButton>Salvar veículo</SubmitButton>
              </ActionForm>
            </CardBody>
          </>
        )}
      </Card>
    </>
  );
}
