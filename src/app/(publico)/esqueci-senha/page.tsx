import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/auth-shell";
import { ActionForm, Field } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/actions/auth";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPage() {
  return (
    <AuthShell title="Recuperar senha" subtitle="Enviaremos um link para você criar uma nova senha." footer={<Link href="/login" className="text-gold-300">Voltar ao login</Link>}>
      <ActionForm action={requestPasswordReset} className="space-y-4" messageOnTop reset>
        <Field name="email" label="E-mail">
          <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
        </Field>
        <SubmitButton className="w-full" size="lg" pendingText="Enviando…">Enviar link</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
