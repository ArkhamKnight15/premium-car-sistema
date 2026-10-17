"use client";
import { useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/layout-bits";
import { ActionForm, Field } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { LoginFields, PermissionFields } from "@/components/domain/access-fields";
import { createEmployee } from "@/actions/team";

export default function NewEmployeePage() {
  const [withLogin, setWithLogin] = useState(true);
  return (
    <>
      <PageHeader title="Novo funcionário" back={{ href: "/funcionarios", label: "Funcionários" }}
        description="Funcionários sem login podem ser responsáveis e executores nas OS. Com login, acessam o sistema conforme as permissões." />
      <Card className="max-w-2xl">
        <CardBody>
          <ActionForm action={createEmployee} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="full_name" label="Nome completo" required className="sm:col-span-2"><Input id="full_name" name="full_name" required /></Field>
              <Field name="job_title" label="Cargo"><Input id="job_title" name="job_title" placeholder="Ex.: Detalhador, Polidor" /></Field>
              <Field name="phone" label="Telefone"><Input id="phone" name="phone" type="tel" /></Field>
            </div>
            <label className="flex items-center gap-2.5 rounded-lg border border-ink-800 p-3 text-sm">
              <input type="checkbox" name="with_login" checked={withLogin} onChange={(e) => setWithLogin(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand-500)]" />
              Criar login individual para acessar o sistema
            </label>
            {withLogin ? (
              <div className="space-y-4">
                <LoginFields />
                <PermissionFields />
              </div>
            ) : null}
            <SubmitButton pendingText="Cadastrando…">Cadastrar funcionário</SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
