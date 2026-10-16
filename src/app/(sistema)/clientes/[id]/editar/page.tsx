import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requirePerm } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout-bits";
import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { CustomerFields } from "@/components/domain/customer-fields";
import { DuplicateWatcher } from "@/components/domain/duplicate-watcher";
import { updateCustomer } from "@/actions/customers";
import type { Customer } from "@/lib/types";

export const metadata: Metadata = { title: "Editar cliente" };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("customers");
  const { id } = await params;
  const supabase = await createClient();
  const { data: c } = await supabase.from("customers").select("*").eq("id", id).maybeSingle<Customer>();
  if (!c || c.anonymized_at) notFound();
  return (
    <>
      <PageHeader title={`Editar · ${c.full_name}`} back={{ href: `/clientes/${id}`, label: "Voltar ao cliente" }} />
      <Card className="max-w-3xl">
        <CardBody>
          <ActionForm action={updateCustomer} className="space-y-5">
            <input type="hidden" name="id" value={c.id} />
            <CustomerFields c={c} />
            <DuplicateWatcher ignoreId={c.id} />
            <SubmitButton>Salvar alterações</SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
