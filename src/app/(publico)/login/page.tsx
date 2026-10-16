import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/layout/auth-shell";
import { ActionForm, Field } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/layout-bits";
import { signIn } from "@/actions/auth";

export const metadata: Metadata = { title: "Entrar" };

const MESSAGES: Record<string, string> = {
  "sem-acesso": "Seu usuário não está ativo. Peça ao administrador para liberar o acesso.",
  link: "O link expirou ou já foi usado. Solicite um novo.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const { next, erro } = await searchParams;
  return (
    <AuthShell
      title="Entrar no sistema"
      subtitle="Acesso exclusivo da equipe Premium Car."
      footer="Acesso restrito. As ações realizadas no sistema são registradas."
    >
      {erro && MESSAGES[erro] ? <Alert tone="warn" className="mb-4">{MESSAGES[erro]}</Alert> : null}
      <ActionForm action={signIn} className="space-y-4" messageOnTop>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <Field name="email" label="E-mail">
          <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
        </Field>
        <Field name="password" label="Senha">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <SubmitButton className="w-full" size="lg" pendingText="Entrando…">Entrar</SubmitButton>
        <p className="text-center text-sm">
          <Link href="/esqueci-senha" className="text-gold-300 hover:text-gold-200">Esqueci minha senha</Link>
        </p>
      </ActionForm>
    </AuthShell>
  );
}
