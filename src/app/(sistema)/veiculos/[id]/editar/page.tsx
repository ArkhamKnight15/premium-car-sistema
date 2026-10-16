import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requirePerm } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout-bits";
import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { VehicleFields } from "@/components/domain/vehicle-fields";
import { updateVehicle } from "@/actions/vehicles";
import type { Vehicle } from "@/lib/types";

export const metadata: Metadata = { title: "Editar veículo" };

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("customers");
  const { id } = await params;
  const supabase = await createClient();
  const { data: v } = await supabase.from("vehicles").select("*").eq("id", id).maybeSingle<Vehicle>();
  if (!v) notFound();
  return (
    <>
      <PageHeader title={`Editar · ${v.brand} ${v.model}`} back={{ href: `/veiculos/${id}`, label: "Voltar ao veículo" }} />
      <Card className="max-w-3xl">
        <CardBody>
          <ActionForm action={updateVehicle} className="space-y-5">
            <input type="hidden" name="id" value={v.id} />
            <VehicleFields v={v} />
            <SubmitButton>Salvar alterações</SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
