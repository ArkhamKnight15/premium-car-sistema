"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePerm } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbFail, fail, ok } from "@/lib/action";
import { fieldErrors } from "@/lib/validation";
import { date } from "@/lib/format";
import { digits } from "@/lib/utils";
import { NAME_MAX, NAME_MIN, normalizeBrPhone, numberVariants } from "@/lib/contacts";
import type { ActionResult } from "@/lib/types";

export type ExistingContact = { id: string; full_name: string; active: boolean; phone: string | null; whatsapp: string | null; email: string | null };

const PAGE = 1000;
/** Tamanho máximo de cada lote enviado pelo navegador. */
const BATCH_MAX = 200;

/**
 * Clientes já cadastrados que têm algum dos números (DDD + número) ou e-mails informados.
 * Lê a base em páginas e compara aqui, porque os números podem ter sido salvos com 55 ou sem o 9.
 */
export async function findExistingContacts(input: { numbers: string[]; emails: string[] }): Promise<ExistingContact[]> {
  await requirePerm("customers");
  const numbers = new Set(input.numbers.slice(0, 50_000).map(digits));
  const emails = new Set(input.emails.slice(0, 50_000).map((e) => e.trim().toLowerCase()));
  const supabase = await createClient();
  const found: ExistingContact[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, full_name, active, phone, whatsapp, email")
      .is("anonymized_at", null)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error("Não foi possível consultar os clientes cadastrados.");
    for (const c of data as ExistingContact[]) {
      const nums = [c.whatsapp, c.phone].map((n) => (n ? normalizeBrPhone(n) : null));
      if (nums.some((n) => n && numbers.has(n)) || (c.email && emails.has(c.email.toLowerCase()))) found.push(c);
    }
    if (data.length < PAGE) break;
  }
  return found;
}

const phoneField = z.string().nullable().refine((v) => v === null || /^\d{10,11}$/.test(v), "Telefone inválido.");
const importSchema = z
  .array(
    z
      .object({
        full_name: z.string().trim().min(NAME_MIN, `O nome precisa de pelo menos ${NAME_MIN} letras.`).max(NAME_MAX),
        whatsapp: phoneField,
        phone: phoneField,
        email: z.string().trim().toLowerCase().email().nullable().catch(null),
        org: z.string().trim().max(160).nullable().catch(null),
      })
      .refine((r) => r.whatsapp || r.phone, "Contato sem telefone."),
  )
  .min(1, "Nenhum contato selecionado.")
  .max(BATCH_MAX, `Envie no máximo ${BATCH_MAX} contatos por vez.`);

export type ImportInput = z.input<typeof importSchema>;
export type ImportSummary = { created: number; skipped: number };

/**
 * Cadastra um lote de contatos como clientes. Confere de novo, no banco, os números
 * já cadastrados (outra pessoa pode ter cadastrado no meio da importação).
 */
export async function importCustomers(rows: ImportInput): Promise<ActionResult<ImportSummary>> {
  await requirePerm("customers");
  const parsed = importSchema.safeParse(rows);
  if (!parsed.success) {
    const first = Object.entries(fieldErrors(parsed.error))[0];
    return fail(first ? `Contato ${Number(first[0].split(".")[0]) + 1}: ${first[1]}` : "Dados inválidos.");
  }
  const supabase = await createClient();

  const variants = [...new Set(parsed.data.flatMap((r) => [r.whatsapp, r.phone]).filter((n): n is string => n !== null).flatMap(numberVariants))];
  const taken = new Set<string>();
  for (let i = 0; i < variants.length; i += 150) {
    const list = variants.slice(i, i + 150).join(",");
    const { data, error } = await supabase.from("customers").select("phone, whatsapp").or(`whatsapp.in.(${list}),phone.in.(${list})`);
    if (error) return dbFail(error);
    for (const c of data) for (const n of [c.whatsapp, c.phone]) if (n) taken.add(normalizeBrPhone(n) ?? n);
  }

  const note = `Importado da agenda de contatos em ${date(new Date())}.`;
  const fresh = parsed.data
    .filter((r) => ![r.whatsapp, r.phone].some((n) => n && taken.has(n)))
    .map((r) => ({
      person_type: "PF" as const,
      full_name: r.full_name,
      whatsapp: r.whatsapp,
      phone: r.phone,
      email: r.email,
      notes: r.org && r.org !== r.full_name ? `${note}\nEmpresa: ${r.org}` : note,
    }));

  if (fresh.length) {
    const { error } = await supabase.from("customers").insert(fresh);
    if (error) return dbFail(error);
    revalidatePath("/clientes");
    revalidatePath("/dashboard");
  }
  const skipped = parsed.data.length - fresh.length;
  return ok(`${fresh.length} cliente(s) cadastrado(s).`, { data: { created: fresh.length, skipped } });
}
