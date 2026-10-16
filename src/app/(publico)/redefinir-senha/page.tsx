import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/auth-shell";
import { ActionForm, Field } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { getSession } from "@/lib/auth";
import { updatePassword } from "@/actions/auth";

export const metadata: Metadata = { title: "Nova senha" };

export default async function ResetPage() {
  const session = await getSession();
  if (!session) redirect("/login?erro=link");
  return (
    <AuthShell title="Criar nova senha" subtitle={session.user.email ?? undefined}>
      <ActionForm action={updatePassword} className="space-y-4" messageOnTop>
        <Field name="password" label="Nova senha" hint="Mínimo de 8 caracteres.">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Field name="confirm" label="Confirmar senha">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        </Field>
        <SubmitButton className="w-full" size="lg">Salvar nova senha</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
