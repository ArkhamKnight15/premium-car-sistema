"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, formToObject, serviceSchema } from "@/lib/validation";
import { dbFail, fail, ok } from "@/lib/action";
import type { ActionResult } from "@/lib/types";

export async function saveService(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = serviceSchema.safeParse(formToObject(fd, ["active"]));
  if (!parsed.success) return fail("Revise os campos destacados.", fieldErrors(parsed.error));
  const supabase = await createClient();
  const id = String(fd.get("id") ?? "");
  // salvar pelo administrador confirma o preço (deixa de ser "a revisar")
  const payload = { ...parsed.data, price_reviewed: true };
  const { error } = id
    ? await supabase.from("services").update(payload).eq("id", id)
    : await supabase.from("services").insert(payload);
  if (error) return dbFail(error);
  revalidatePath("/servicos");
  return ok(id ? "Serviço atualizado." : "Serviço cadastrado.", { redirect: "/servicos" });
}

export async function setServiceActive(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const active = fd.get("active") === "true";
  const supabase = await createClient();
  const { error } = await supabase.from("services").update({ active }).eq("id", String(fd.get("id")));
  if (error) return dbFail(error);
  revalidatePath("/servicos");
  return ok(active ? "Serviço disponível novamente." : "Serviço indisponível para novas OS. O histórico foi mantido.");
}
