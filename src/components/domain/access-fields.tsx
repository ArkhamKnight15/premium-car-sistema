"use client";
import { useState } from "react";
import { Field } from "@/components/forms/action-form";
import { Checkbox, Input, Select } from "@/components/ui/input";
import type { Profile } from "@/lib/types";

/** Função e permissões de acesso (usar dentro de <ActionForm>). */
export function PermissionFields({ p, showRole = true }: { p?: Partial<Profile>; showRole?: boolean }) {
  const [role, setRole] = useState(p?.role ?? "employee");
  return (
    <div className="space-y-3">
      {showRole ? (
        <Field name="role" label="Função">
          <Select id="role" name="role" value={role} onChange={(e) => setRole(e.target.value as "admin" | "employee")}>
            <option value="employee">Funcionário</option>
            <option value="admin">Administrador (acesso total)</option>
          </Select>
        </Field>
      ) : null}
      {role === "employee" ? (
        <fieldset className="space-y-2.5 rounded-lg border border-ink-800 p-3">
          <legend className="px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Permissões do funcionário</legend>
          <Checkbox name="perm_customers" defaultChecked={p?.perm_customers ?? true} label="Cadastrar e editar clientes e veículos" />
          <Checkbox name="perm_all_orders" defaultChecked={p?.perm_all_orders ?? true} label="Ver todas as ordens de serviço" hint="Desmarcado: vê apenas as OS em que é responsável ou executor." />
          <Checkbox name="perm_payments" defaultChecked={p?.perm_payments ?? false} label="Registrar pagamentos" />
          <Checkbox name="perm_discounts" defaultChecked={p?.perm_discounts ?? false} label="Alterar preços do catálogo e conceder descontos" />
          <p className="text-xs text-ink-500">Sempre permitido: registrar entradas, atualizar status, incluir observações e fotos. Financeiro, relatórios, equipe e configurações são exclusivos do administrador.</p>
        </fieldset>
      ) : (
        <p className="rounded-lg border border-gold-500/20 bg-gold-500/5 p-3 text-xs text-gold-200">Administradores têm acesso a todos os módulos, inclusive financeiro, relatórios, usuários e configurações.</p>
      )}
    </div>
  );
}

/** Dados de login novo: e-mail + senha provisória opcional (sem senha = convite por e-mail). */
export function LoginFields() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field name="email" label="E-mail de acesso" required><Input id="email" name="email" type="email" autoComplete="off" /></Field>
      <Field name="password" label="Senha provisória" hint="Em branco: envia convite por e-mail (requer SMTP no Supabase).">
        <Input id="password" name="password" type="text" autoComplete="new-password" minLength={8} />
      </Field>
    </div>
  );
}
