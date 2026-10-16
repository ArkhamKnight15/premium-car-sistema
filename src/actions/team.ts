"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { fieldErrors } from "@/lib/validation";
import { dbFail, fail, ok } from "@/lib/action";
import { digits } from "@/lib/utils";
import type { ActionResult } from "@/lib/types";

const employeeSchema = z.object({
  full_name: z.string().trim().min(3, "Informe o nome completo.").max(120),
  job_title: z.string().trim().max(60).optional().transform((v) => (v ? v : null)),
  phone: z.string().optional().transform((v) => digits(v) || null).refine((v) => v === null || (v.length >= 10 && v.length <= 13), "Telefone inválido."),
});

const accessSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  role: z.enum(["admin", "employee"]),
  password: z.string().optional().transform((v) => (v ? v : null)).refine((v) => v === null || v.length >= 8, "Senha provisória: mínimo de 8 caracteres."),
});

function perms(fd: FormData) {
  return {
    perm_customers: fd.get("perm_customers") === "on",
    perm_all_orders: fd.get("perm_all_orders") === "on",
    perm_payments: fd.get("perm_payments") === "on",
    perm_discounts: fd.get("perm_discounts") === "on",
  };
}

/** Cria o login no Supabase Auth e libera o perfil com função e permissões. */
async function createLogin(fd: FormData, fullName: string): Promise<{ id: string } | ActionResult> {
  if (!hasServiceRole()) return fail("Configure SUPABASE_SERVICE_ROLE_KEY no servidor para criar logins.");
  const parsed = accessSchema.safeParse({ email: fd.get("email"), role: fd.get("role") ?? "employee", password: fd.get("password") });
  if (!parsed.success) return fail("Revise os dados de acesso.", fieldErrors(parsed.error));
  const { email, role, password } = parsed.data;
  const admin = createAdminClient();
  const meta = { full_name: fullName };
  const { data, error } = password
    ? await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta })
    : await admin.auth.admin.inviteUserByEmail(email, { data: meta, redirectTo: `${env.siteUrl}/auth/callback?next=/redefinir-senha` });
  if (error || !data.user) {
    if (error?.message?.toLowerCase().includes("already")) return fail("Já existe um usuário com este e-mail.", { email: "E-mail já cadastrado." });
    return fail(password ? "Não foi possível criar o login." : "Não foi possível enviar o convite. Configure o SMTP do Supabase ou informe uma senha provisória.");
  }
  const { error: pErr } = await admin.from("profiles").update({ full_name: fullName, role, active: true, ...perms(fd) }).eq("id", data.user.id);
  if (pErr) return dbFail(pErr);
  return { id: data.user.id };
}

export async function createEmployee(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = employeeSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail("Revise os campos destacados.", fieldErrors(parsed.error));
  let profileId: string | null = null;
  if (fd.get("with_login") === "on") {
    const r = await createLogin(fd, parsed.data.full_name);
    if (!("id" in r)) return r;
    profileId = r.id;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("employees").insert({ ...parsed.data, profile_id: profileId }).select("id").single();
  if (error) return dbFail(error);
  revalidatePath("/funcionarios");
  return ok(profileId ? "Funcionário cadastrado com acesso ao sistema." : "Funcionário cadastrado (sem login).", { redirect: `/funcionarios/${data.id}` });
}

export async function updateEmployee(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = String(fd.get("id"));
  const parsed = employeeSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail("Revise os campos destacados.", fieldErrors(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase.from("employees").update(parsed.data).eq("id", id);
  if (error) return dbFail(error);
  revalidatePath(`/funcionarios/${id}`);
  revalidatePath("/funcionarios");
  return ok("Dados do funcionário salvos.");
}

export async function grantAccess(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = String(fd.get("id"));
  const supabase = await createClient();
  const { data: emp } = await supabase.from("employees").select("full_name, profile_id").eq("id", id).single();
  if (!emp) return fail("Funcionário não encontrado.");
  if (emp.profile_id) return fail("Este funcionário já possui login.");
  const r = await createLogin(fd, emp.full_name);
  if (!("id" in r)) return r;
  const { error } = await supabase.from("employees").update({ profile_id: r.id }).eq("id", id);
  if (error) return dbFail(error);
  revalidatePath(`/funcionarios/${id}`);
  return ok("Acesso criado.");
}

/** Função, permissões e bloqueio do login. O banco impede remover o último administrador. */
export async function updateAccess(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { user } = await requireAdmin();
  const employeeId = String(fd.get("employee_id"));
  const profileId = String(fd.get("profile_id"));
  const role = z.enum(["admin", "employee"]).safeParse(fd.get("role"));
  if (!role.success) return fail("Função inválida.");
  const active = fd.get("active") === "on";
  if (profileId === user.id && (!active || role.data !== "admin")) return fail("Você não pode remover o seu próprio acesso de administrador.");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role: role.data, active, ...perms(fd) }).eq("id", profileId);
  if (error) return dbFail(error);
  // Bloqueia/desbloqueia também no Auth, encerrando a possibilidade de novo login
  if (hasServiceRole()) {
    await createAdminClient().auth.admin.updateUserById(profileId, { ban_duration: active ? "none" : "876000h" });
  }
  revalidatePath(`/funcionarios/${employeeId}`);
  revalidatePath("/funcionarios");
  return ok(active ? "Acesso e permissões atualizados." : "Acesso bloqueado. O histórico do usuário foi mantido.");
}

export async function setEmployeeActive(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { user } = await requireAdmin();
  const id = String(fd.get("id"));
  const active = fd.get("active") === "true";
  const supabase = await createClient();
  const { data: emp } = await supabase.from("employees").select("profile_id").eq("id", id).single();
  if (!active && emp?.profile_id === user.id) return fail("Você não pode desativar a si mesmo.");
  if (!active && emp?.profile_id) {
    const { error: pErr } = await supabase.from("profiles").update({ active: false }).eq("id", emp.profile_id);
    if (pErr) return dbFail(pErr);
    if (hasServiceRole()) await createAdminClient().auth.admin.updateUserById(emp.profile_id, { ban_duration: "876000h" });
  }
  const { error } = await supabase.from("employees").update({ active }).eq("id", id);
  if (error) return dbFail(error);
  revalidatePath(`/funcionarios/${id}`);
  revalidatePath("/funcionarios");
  return ok(active ? "Funcionário reativado (reative o login na seção Acesso, se necessário)." : "Funcionário desativado e login bloqueado.");
}

export async function setTemporaryPassword(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (!hasServiceRole()) return fail("Configure SUPABASE_SERVICE_ROLE_KEY no servidor.");
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return fail("A senha provisória precisa de 8 caracteres ou mais.");
  const { error } = await createAdminClient().auth.admin.updateUserById(String(fd.get("profile_id")), { password });
  if (error) return fail("Não foi possível alterar a senha.");
  return ok("Senha provisória definida. Peça ao funcionário para trocá-la em Meu perfil.");
}
