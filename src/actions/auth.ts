"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { fail, ok } from "@/lib/action";
import type { ActionResult } from "@/lib/types";

const safeNext = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/dashboard";
};

export async function signIn(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = z
    .object({ email: z.string().trim().toLowerCase().email("Informe um e-mail válido."), password: z.string().min(1, "Informe a senha.") })
    .safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return fail("Revise os campos.", Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail("E-mail ou senha incorretos.");

  const { data: profile } = await supabase.from("profiles").select("active").eq("id", data.user.id).maybeSingle();
  if (!profile?.active) {
    await supabase.auth.signOut();
    return fail("Seu acesso ainda não foi liberado ou foi desativado. Fale com o administrador.");
  }
  redirect(safeNext(fd.get("next")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const email = z.string().trim().toLowerCase().email().safeParse(fd.get("email"));
  if (!email.success) return fail("Informe um e-mail válido.", { email: "Informe um e-mail válido." });
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${env.siteUrl}/auth/callback?next=/redefinir-senha` });
  // Mesma resposta para e-mails cadastrados ou não (não revela quem tem acesso)
  return ok("Se o e-mail tiver acesso ao sistema, você receberá um link para criar uma nova senha.");
}

export async function updatePassword(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return fail("A senha precisa de pelo menos 8 caracteres.", { password: "Mínimo de 8 caracteres." });
  if (password !== fd.get("confirm")) return fail("As senhas não conferem.", { confirm: "As senhas não conferem." });
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail(error.message.includes("different") ? "Use uma senha diferente da atual." : "Não foi possível alterar a senha. Solicite um novo link.");
  return ok("Senha alterada com sucesso.", { redirect: "/dashboard" });
}
