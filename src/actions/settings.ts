"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, isValidCNPJ } from "@/lib/validation";
import { dbFail, fail, ok } from "@/lib/action";
import { digits } from "@/lib/utils";
import type { ActionResult } from "@/lib/types";

const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
const phoneOpt = z.string().optional().transform((v) => digits(v) || null).refine((v) => v === null || (v.length >= 10 && v.length <= 13), "Telefone inválido.");

const companySchema = z.object({
  company_name: z.string().trim().min(2, "Informe o nome.").max(80),
  legal_name: opt(160),
  cnpj: z.string().optional().transform((v) => digits(v) || null).refine((v) => v === null || isValidCNPJ(v), "CNPJ inválido."),
  phone: phoneOpt,
  whatsapp: phoneOpt,
  email: z.string().trim().optional().transform((v) => (v ? v : null)).refine((v) => v === null || z.string().email().safeParse(v).success, "E-mail inválido."),
  address: opt(200),
  city: opt(80),
  bays: z.coerce.number({ invalid_type_error: "Número inválido." }).int().min(1, "Mínimo 1.").max(100),
  slot_minutes: z.coerce.number().int().min(5).max(240),
  order_terms: opt(3000),
});

export async function saveCompany(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = companySchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail("Revise os campos destacados.", fieldErrors(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase.from("company_settings").update(parsed.data).eq("id", 1);
  if (error) return dbFail(error);
  revalidatePath("/", "layout");
  return ok("Dados da empresa salvos.");
}

export async function saveHours(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const rows = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
    weekday: d,
    is_open: fd.get(`open_${d}`) === "on",
    open_time: String(fd.get(`from_${d}`) || "08:00"),
    close_time: String(fd.get(`to_${d}`) || "18:00"),
  }));
  if (rows.some((r) => r.close_time <= r.open_time)) return fail("O horário de fechamento deve ser depois da abertura.");
  const supabase = await createClient();
  const { error } = await supabase.from("business_hours").upsert(rows);
  if (error) return dbFail(error);
  revalidatePath("/configuracoes");
  return ok("Horário de funcionamento salvo.");
}

export async function savePaymentMethod(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 2) return fail("Informe o nome da forma de pagamento.");
  const supabase = await createClient();
  const id = String(fd.get("id") ?? "");
  const { error } = id
    ? await supabase.from("payment_methods").update({ name, active: fd.get("active") === "on" }).eq("id", id)
    : await supabase.from("payment_methods").insert({ name, sort_order: 50 });
  if (error) return dbFail(error);
  revalidatePath("/configuracoes");
  return ok("Forma de pagamento salva.");
}
