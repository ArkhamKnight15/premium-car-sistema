"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbFail, fail, ok } from "@/lib/action";
import type { ActionResult } from "@/lib/types";

export async function updateMyName(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { user } = await requireUser();
  const name = String(fd.get("full_name") ?? "").trim();
  if (name.length < 3) return fail("Informe seu nome completo.", { full_name: "Informe seu nome completo." });
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
  if (error) return dbFail(error);
  revalidatePath("/", "layout");
  return ok("Nome atualizado.");
}
