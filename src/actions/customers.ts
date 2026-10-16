"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requirePerm, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { customerSchema, fieldErrors, formToObject, uuid } from "@/lib/validation";
import { dbFail, fail, ok } from "@/lib/action";
import { digits } from "@/lib/utils";
import type { ActionResult } from "@/lib/types";

export type DuplicateHit = { id: string; full_name: string; phone: string | null; whatsapp: string | null; email: string | null; document: string | null; active: boolean; reason: string };

/** Aviso de possíveis duplicados enquanto o cadastro é preenchido. */
export async function checkDuplicates(input: { name: string; document?: string; phone?: string; email?: string; ignore?: string }): Promise<DuplicateHit[]> {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.rpc("find_customer_duplicates", {
    p_name: input.name ?? "",
    p_document: digits(input.document) || null,
    p_phone: digits(input.phone) || null,
    p_email: input.email?.trim() || null,
    p_ignore: input.ignore && uuid.safeParse(input.ignore).success ? input.ignore : null,
  });
  return (data ?? []) as DuplicateHit[];
}

export async function createCustomer(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requirePerm("customers");
  const parsed = customerSchema.safeParse(formToObject(fd));
  if (!parsed.success) return fail("Revise os campos destacados.", fieldErrors(parsed.error));
  const supabase = await createClient();
  const { data, error } = await supabase.from("customers").insert(parsed.data).select("id").single();
  if (error) return dbFail(error);
  revalidatePath("/clientes");
  const back = String(fd.get("return_to") ?? "");
  const redirect = back.startsWith("/") && !back.startsWith("//") ? `${back}${back.includes("?") ? "&" : "?"}cliente=${data.id}` : `/clientes/${data.id}`;
  return ok("Cliente cadastrado.", { redirect });
}

export async function updateCustomer(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requirePerm("customers");
  const id = String(fd.get("id"));
  const parsed = customerSchema.safeParse(formToObject(fd));
  if (!parsed.success) return fail("Revise os campos destacados.", fieldErrors(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase.from("customers").update(parsed.data).eq("id", id);
  if (error) return dbFail(error);
  revalidatePath(`/clientes/${id}`);
  return ok("Cadastro atualizado.", { redirect: `/clientes/${id}` });
}

export async function setCustomerActive(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requirePerm("customers");
  const id = String(fd.get("id"));
  const active = fd.get("active") === "true";
  const reason = String(fd.get("reason") ?? "").trim();
  if (!active && reason.length < 3) return fail("Informe o motivo da desativação.");
  const supabase = await createClient();
  const { error } = await supabase.from("customers").update({ active, deactivation_reason: active ? null : reason }).eq("id", id);
  if (error) return dbFail(error);
  revalidatePath(`/clientes/${id}`);
  revalidatePath("/clientes");
  return ok(active ? "Cliente reativado." : "Cliente desativado. O histórico foi mantido.");
}

export async function anonymizeCustomer(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = String(fd.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("anonymize_customer", { p_id: id });
  if (error) return dbFail(error);
  revalidatePath(`/clientes/${id}`);
  return ok("Dados pessoais anonimizados. Ordens de serviço e pagamentos foram preservados.");
}
