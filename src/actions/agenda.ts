"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fromLocalInput } from "@/lib/format";
import { dbFail, fail, ok } from "@/lib/action";
import type { ActionResult } from "@/lib/types";

const createSchema = z.object({
  customer_id: z.string().uuid("Selecione o cliente."),
  vehicle_id: z.string().uuid("Selecione o veículo."),
  service_ids: z.array(z.string().uuid()).min(1, "Selecione ao menos um serviço."),
  starts_at: z.string().min(16, "Informe data e horário."),
  employee_id: z.string().uuid().nullable(),
  duration: z.number().int().min(5).max(10080).nullable(),
  channel: z.enum(["telefone", "whatsapp", "presencial", "outro"]),
  notes: z.string().max(2000).nullable(),
});

export async function createAppointment(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const durationRaw = String(fd.get("duration") ?? "").trim();
  const parsed = createSchema.safeParse({
    customer_id: fd.get("customer_id"),
    vehicle_id: fd.get("vehicle_id"),
    service_ids: fd.getAll("service_ids").map(String),
    starts_at: fd.get("starts_at"),
    employee_id: String(fd.get("employee_id") ?? "") || null,
    duration: durationRaw ? Number(durationRaw) : null,
    channel: fd.get("channel") ?? "telefone",
    notes: String(fd.get("notes") ?? "").trim() || null,
  });
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return fail(i?.message ?? "Revise os campos.", i ? { [String(i.path[0])]: i.message } : undefined);
  }
  const p = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_appointment", {
    p_customer_id: p.customer_id,
    p_vehicle_id: p.vehicle_id,
    p_starts_at: fromLocalInput(p.starts_at),
    p_service_ids: p.service_ids,
    p_employee_id: p.employee_id,
    p_duration_minutes: p.duration,
    p_channel: p.channel,
    p_notes: p.notes,
  });
  if (error) return dbFail(error);
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  return ok("Compromisso agendado.", { redirect: `/agenda/${data}` });
}

export async function rescheduleAppointment(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = String(fd.get("id"));
  const start = fromLocalInput(String(fd.get("starts_at") ?? ""));
  if (!start) return fail("Informe a nova data e horário.");
  const employee = String(fd.get("employee_id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("reschedule_appointment", {
    p_id: id,
    p_starts_at: start,
    p_employee_id: employee || null,
    p_change_employee: true,
  });
  if (error) return dbFail(error);
  revalidatePath("/agenda");
  revalidatePath(`/agenda/${id}`);
  return ok("Compromisso reagendado.");
}

export async function setAppointmentStatus(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = String(fd.get("id"));
  const status = z.enum(["scheduled", "confirmed", "cancelled", "no_show"]).safeParse(fd.get("status"));
  if (!status.success) return fail("Situação inválida.");
  const reason = String(fd.get("reason") ?? "").trim();
  if (status.data === "cancelled" && reason.length < 3) return fail("Informe o motivo do cancelamento.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ status: status.data, cancel_reason: status.data === "cancelled" ? reason : null })
    .eq("id", id);
  if (error) return dbFail(error);
  revalidatePath("/agenda");
  revalidatePath(`/agenda/${id}`);
  const labels = { scheduled: "voltou para agendado", confirmed: "confirmado", cancelled: "cancelado", no_show: "marcado como não compareceu" };
  return ok(`Compromisso ${labels[status.data]}.`);
}

export async function updateAppointmentNotes(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = String(fd.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.from("appointments").update({ notes: String(fd.get("notes") ?? "").trim() || null }).eq("id", id);
  if (error) return dbFail(error);
  revalidatePath(`/agenda/${id}`);
  return ok("Observações salvas.");
}
