import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InfoList, PageHeader } from "@/components/ui/layout-bits";
import { ActionForm, Field } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { updateMyName } from "@/actions/profile";
import { updatePassword } from "@/actions/auth";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function ProfilePage() {
  const { profile, employee, isAdmin } = await requireUser();
  const perms = isAdmin ? ["Acesso total (administrador)"] : [
    profile.perm_customers ? "Cadastrar e editar clientes e veículos" : "Consultar clientes e veículos",
    profile.perm_all_orders ? "Ver todas as ordens de serviço" : "Ver apenas as OS atribuídas",
    profile.perm_payments ? "Registrar pagamentos" : null,
    profile.perm_discounts ? "Alterar preços e conceder descontos" : null,
  ].filter(Boolean);
  return (
    <>
      <PageHeader title="Meu perfil" />
      <div className="grid max-w-4xl gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title="Dados" />
          <CardBody className="space-y-5">
            <ActionForm action={updateMyName} className="space-y-3">
              <Field name="full_name" label="Nome"><Input id="full_name" name="full_name" defaultValue={profile.full_name} /></Field>
              <SubmitButton size="sm" variant="secondary">Salvar nome</SubmitButton>
            </ActionForm>
            <InfoList cols={1} items={[["E-mail de acesso", profile.email], ["Função", isAdmin ? "Administrador" : "Funcionário"], ["Cargo", employee?.job_title], ["Permissões", <ul key="p" className="list-disc pl-4">{perms.map((p) => <li key={String(p)}>{p}</li>)}</ul>]]} />
          </CardBody>
        </Card>
        <Card className="h-fit">
          <CardHeader title="Alterar senha" />
          <CardBody>
            <ActionForm action={updatePassword} reset className="space-y-3">
              <Field name="password" label="Nova senha" hint="Mínimo de 8 caracteres."><Input id="password" name="password" type="password" autoComplete="new-password" /></Field>
              <Field name="confirm" label="Confirmar nova senha"><Input id="confirm" name="confirm" type="password" autoComplete="new-password" /></Field>
              <SubmitButton size="sm">Alterar senha</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
