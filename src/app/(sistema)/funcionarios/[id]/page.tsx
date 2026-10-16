import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Ban, CheckCircle2, KeyRound } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasServiceRole } from "@/lib/supabase/admin";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox, Input } from "@/components/ui/input";
import { Alert, InfoList, PageHeader } from "@/components/ui/layout-bits";
import { ActionForm, Field } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { LoginFields, PermissionFields } from "@/components/domain/access-fields";
import { dateTime, dayKey } from "@/lib/format";
import type { Employee, Profile } from "@/lib/types";
import { grantAccess, setEmployeeActive, setTemporaryPassword, updateAccess, updateEmployee } from "@/actions/team";

export const metadata: Metadata = { title: "Funcionário" };

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data: e } = await supabase.from("employees").select("*").eq("id", id).maybeSingle<Employee>();
  if (!e) notFound();
  const { data: p } = e.profile_id ? await supabase.from("profiles").select("*").eq("id", e.profile_id).maybeSingle<Profile>() : { data: null };
  const today = dayKey();
  const { data: prod } = await supabase.rpc("report_productivity", { p_from: `${today.slice(0, 8)}01`, p_to: today });
  const mine = ((prod ?? []) as { employee_id: string; orders_responsible: number; orders_completed: number; items_done: number }[]).find((r) => r.employee_id === id);
  const isMe = p?.id === user.id;

  return (
    <>
      <PageHeader back={{ href: "/funcionarios", label: "Funcionários" }}
        title={<span className="flex flex-wrap items-center gap-2">{e.full_name}{!e.active ? <Badge>Inativo</Badge> : null}{p ? <Badge tone={p.role === "admin" ? "gold" : "blue"}>{p.role === "admin" ? "Administrador" : "Funcionário"}</Badge> : null}</span>}
        description={e.job_title ?? undefined} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Dados" />
            <CardBody>
              <ActionForm action={updateEmployee} className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="id" value={e.id} />
                <Field name="full_name" label="Nome completo" required className="sm:col-span-2"><Input id="full_name" name="full_name" defaultValue={e.full_name} /></Field>
                <Field name="job_title" label="Cargo"><Input id="job_title" name="job_title" defaultValue={e.job_title ?? ""} /></Field>
                <Field name="phone" label="Telefone"><Input id="phone" name="phone" defaultValue={e.phone ?? ""} /></Field>
                <div className="sm:col-span-2"><SubmitButton size="sm">Salvar</SubmitButton></div>
              </ActionForm>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Produtividade no mês" />
            <CardBody>
              <InfoList cols={3} items={[["OS como responsável", mine?.orders_responsible ?? 0], ["OS concluídas", mine?.orders_completed ?? 0], ["Serviços executados", mine?.items_done ?? 0]]} />
            </CardBody>
          </Card>
          {!isMe ? (
            <Card>
              <CardHeader title="Situação" />
              <CardBody>
                {e.active ? (
                  <ConfirmAction action={setEmployeeActive} fields={{ id: e.id, active: "false" }} label="Desativar funcionário" icon={<Ban />} variant="secondary"
                    question="Desativar? O login (se houver) é bloqueado; OS, histórico e produtividade são mantidos." confirmLabel="Desativar" />
                ) : (
                  <ConfirmAction action={setEmployeeActive} fields={{ id: e.id, active: "true" }} label="Reativar funcionário" icon={<CheckCircle2 />} variant="secondary" question="Reativar este funcionário?" confirmLabel="Reativar" />
                )}
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Acesso ao sistema" description={p ? p.email ?? undefined : "Este funcionário ainda não tem login."} />
            <CardBody>
              {!hasServiceRole() && !p ? <Alert tone="warn">Configure SUPABASE_SERVICE_ROLE_KEY para criar logins.</Alert> : null}
              {p ? (
                <ActionForm action={updateAccess} className="space-y-4">
                  <input type="hidden" name="employee_id" value={e.id} />
                  <input type="hidden" name="profile_id" value={p.id} />
                  <PermissionFields p={p} />
                  <Checkbox name="active" defaultChecked={p.active} label="Acesso liberado" hint={isMe ? "Você não pode bloquear o próprio acesso." : "Desmarcado: o login é bloqueado imediatamente."} disabled={isMe} />
                  {isMe ? <input type="hidden" name="active" value="on" /> : null}
                  <SubmitButton size="sm">Salvar acesso</SubmitButton>
                  <p className="text-[11px] text-ink-500">Usuário criado em {dateTime(p.created_at)}. Alterações de permissão ficam no registro de auditoria.</p>
                </ActionForm>
              ) : e.active ? (
                <ActionForm action={grantAccess} className="space-y-4">
                  <input type="hidden" name="id" value={e.id} />
                  <LoginFields />
                  <PermissionFields />
                  <SubmitButton size="sm"><KeyRound /> Criar login</SubmitButton>
                </ActionForm>
              ) : <p className="text-sm text-ink-400">Reative o funcionário para criar um login.</p>}
            </CardBody>
          </Card>
          {p && hasServiceRole() ? (
            <Card>
              <CardHeader title="Senha" description="Defina uma senha provisória caso o funcionário esqueça a dele." />
              <CardBody>
                <ActionForm action={setTemporaryPassword} reset className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <input type="hidden" name="profile_id" value={p.id} />
                  <Field name="password" label="Nova senha provisória" className="flex-1"><Input id="password" name="password" type="text" minLength={8} autoComplete="new-password" /></Field>
                  <SubmitButton size="md" variant="secondary">Definir</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
