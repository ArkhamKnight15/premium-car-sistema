import type { Metadata } from "next";
import { requirePerm } from "@/lib/auth";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout-bits";
import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { CustomerFields } from "@/components/domain/customer-fields";
import { DuplicateWatcher } from "@/components/domain/duplicate-watcher";
import { createCustomer } from "@/actions/customers";

export const metadata: Metadata = { title: "Novo cliente" };

export default async function NewCustomerPage({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  await requirePerm("customers");
  const { voltar } = await searchParams;
  return (
    <>
      <PageHeader title="Novo cliente" back={{ href: voltar ?? "/clientes", label: voltar ? "Voltar" : "Clientes" }}
        description="Somente nome e um contato são obrigatórios — o restante pode ser completado depois." />
      <Card className="max-w-3xl">
        <CardBody>
          <ActionForm action={createCustomer} className="space-y-5">
            {voltar ? <input type="hidden" name="return_to" value={voltar} /> : null}
            <CustomerFields />
            <DuplicateWatcher />
            <div className="flex gap-2"><SubmitButton>Salvar cliente</SubmitButton></div>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
