import Link from "next/link";
import type { Metadata } from "next";
import { KeyRound, UserCog, UserPlus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasServiceRole } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Alert, DataTable, EmptyState, PageHeader } from "@/components/ui/layout-bits";
import { date, phone } from "@/lib/format";
import type { Employee, Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Funcionários" };

export default async function TeamPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: emps }, { data: profiles }] = await Promise.all([
    supabase.from("employees").select("*").order("active", { ascending: false }).order("full_name"),
    supabase.from("profiles").select("*"),
  ]);
  const byProfile = new Map(((profiles ?? []) as Profile[]).map((p) => [p.id, p]));
  const rows = (emps ?? []) as Employee[];
  const orphanLogins = ((profiles ?? []) as Profile[]).filter((p) => !rows.some((e) => e.profile_id === p.id));

  return (
    <>
      <PageHeader title="Funcionários" description="Equipe da empresa, logins individuais e permissões de acesso."
        actions={<Link href="/funcionarios/novo" className={buttonClass("primary")}><UserPlus /> Novo funcionário</Link>} />
      {!hasServiceRole() ? <Alert tone="warn" className="mb-5">Para criar ou bloquear logins, configure a variável SUPABASE_SERVICE_ROLE_KEY no servidor.</Alert> : null}
      {orphanLogins.length ? (
        <Alert tone="info" className="mb-5">
          {orphanLogins.length} login(s) sem cadastro de funcionário (ex.: criados direto no Supabase): {orphanLogins.map((p) => p.email).join(", ")}. Eles {orphanLogins.some((p) => !p.active) ? "não têm acesso até serem ativados" : "têm acesso conforme a função definida"}.
        </Alert>
      ) : null}
      <Card>
        {rows.length === 0 ? <EmptyState icon={UserCog} title="Nenhum funcionário cadastrado" /> : (
          <DataTable head={["Funcionário", "Cargo", "Telefone", "Acesso ao sistema", "Permissões", "Desde"]} minWidth={860}>
            {rows.map((e) => {
              const p = e.profile_id ? byProfile.get(e.profile_id) : undefined;
              const perms = p && p.role === "employee" ? [p.perm_customers && "cadastros", p.perm_all_orders ? "todas as OS" : "OS atribuídas", p.perm_payments && "pagamentos", p.perm_discounts && "descontos"].filter(Boolean).join(" · ") : p ? "Acesso total" : "—";
              return (
                <tr key={e.id} className={!e.active ? "opacity-60" : ""}>
                  <td><Link href={`/funcionarios/${e.id}`} className="font-medium hover:text-gold-300">{e.full_name}</Link>{!e.active ? <Badge className="ml-2">Inativo</Badge> : null}</td>
                  <td className="text-ink-300">{e.job_title ?? "—"}</td>
                  <td className="text-ink-300">{phone(e.phone)}</td>
                  <td>
                    {p ? (
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={p.role === "admin" ? "gold" : "blue"}>{p.role === "admin" ? "Administrador" : "Funcionário"}</Badge>
                        {!p.active ? <Badge tone="red">Bloqueado</Badge> : null}
                        <span className="block w-full text-xs text-ink-500">{p.email}</span>
                      </span>
                    ) : <span className="flex items-center gap-1 text-xs text-ink-500"><KeyRound className="h-3.5 w-3.5" /> Sem login</span>}
                  </td>
                  <td className="max-w-[240px] text-xs text-ink-400">{perms}</td>
                  <td className="text-ink-400">{date(e.created_at)}</td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Card>
    </>
  );
}
