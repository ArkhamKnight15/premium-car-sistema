"use server";

import { revalidatePath } from "next/cache";
import { requirePerm } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, formToObject, vehicleSchema } from "@/lib/validation";
import { dbFail, fail, ok } from "@/lib/action";
import type { ActionResult } from "@/lib/types";

export async function createVehicle(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requirePerm("customers");
  const customerId = String(fd.get("customer_id") ?? "");
  if (!customerId) return fail("Selecione o proprietário.");
  const parsed = vehicleSchema.safeParse(formToObject(fd));
  if (!parsed.success) return fail("Revise os campos destacados.", fieldErrors(parsed.error));
  const supabase = await createClient();
  const { data, error } = await supabase.from("vehicles").insert({ ...parsed.data, customer_id: customerId }).select("id").single();
  if (error) return dbFail(error);
  revalidatePath(`/clientes/${customerId}`);
  revalidatePath("/veiculos");
  const back = String(fd.get("return_to") ?? "");
  const redirect = back.startsWith("/") && !back.startsWith("//") ? `${back}${back.includes("?") ? "&" : "?"}veiculo=${data.id}` : `/veiculos/${data.id}`;
  return ok("Veículo cadastrado.", { redirect });
}

export async function updateVehicle(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requirePerm("customers");
  const id = String(fd.get("id"));
  const parsed = vehicleSchema.safeParse(formToObject(fd));
  if (!parsed.success) return fail("Revise os campos destacados.", fieldErrors(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase.from("vehicles").update(parsed.data).eq("id", id);
  if (error) return dbFail(error);
  revalidatePath(`/veiculos/${id}`);
  return ok("Veículo atualizado.", { redirect: `/veiculos/${id}` });
}

export async function setVehicleActive(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requirePerm("customers");
  const id = String(fd.get("id"));
  const active = fd.get("active") === "true";
  const supabase = await createClient();
  const { error } = await supabase.from("vehicles").update({ active }).eq("id", id);
  if (error) return dbFail(error);
  revalidatePath(`/veiculos/${id}`);
  return ok(active ? "Veículo reativado." : "Veículo desativado. O histórico foi mantido.");
}

export async function transferVehicle(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requirePerm("customers");
  const id = String(fd.get("id"));
  const customerId = String(fd.get("customer_id") ?? "");
  if (!customerId) return fail("Selecione o novo proprietário.");
  const supabase = await createClient();
  const { error } = await supabase.from("vehicles").update({ customer_id: customerId }).eq("id", id);
  if (error) return dbFail(error);
  revalidatePath(`/veiculos/${id}`);
  return ok("Proprietário alterado. As OS anteriores continuam no histórico do proprietário anterior.", { redirect: `/veiculos/${id}` });
}
