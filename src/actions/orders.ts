"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fromLocalInput } from "@/lib/format";
import { parseMoney, uuid } from "@/lib/validation";
import { dbFail, fail, ok } from "@/lib/action";
import { digits } from "@/lib/utils";
import type { ActionResult, OrderStatus } from "@/lib/types";


const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
const intOrNull = (v: string | null) => (v && digits(v) ? Number(digits(v)) : null);

function touch(orderId: string) {
  revalidatePath(`/ordens/${orderId}`);
  revalidatePath("/ordens");
  revalidatePath("/na-empresa");
  revalidatePath("/dashboard");
}

const PHOTO_KINDS = ["entry", "damage", "progress", "final"] as const;

// ---------------------------------------------------------------------------
// Abertura (entrada do veículo)
// ---------------------------------------------------------------------------
const itemSchema = z.object({
  service_id: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(160).optional(),
  quantity: z.coerce.number().positive("Quantidade inválida.").max(999),
  unit_price: z.preprocess((v) => parseMoney(v), z.number().min(0, "Preço inválido.")),
  discount: z.preprocess((v) => parseMoney(v) ?? 0, z.number().min(0, "Desconto inválido.")),
  employee_id: z.string().uuid().nullable().optional(),
});

export async function openOrder(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const customerId = str(fd, "customer_id");
  const vehicleId = str(fd, "vehicle_id");
  if (!customerId || !vehicleId) return fail("Selecione o cliente e o veículo.");

  let rawItems: unknown;
  try {
    rawItems = JSON.parse(String(fd.get("items") ?? "[]"));
  } catch {
    return fail("Lista de serviços inválida.");
  }
  const items = z.array(itemSchema).min(1, "Inclua ao menos um serviço.").max(40).safeParse(rawItems);
  if (!items.success) return fail(items.error.issues[0]?.message ?? "Revise os serviços.", { items: items.error.issues[0]?.message ?? "" });
  for (const it of items.data) {
    if (!it.service_id && (!it.description || it.description.length < 2)) return fail("Descreva o serviço personalizado.", { items: "Descreva o serviço personalizado." });
    if (Math.round((it.quantity * it.unit_price - it.discount) * 100) < 0) return fail(`Desconto maior que o valor em “${it.description}”.`);
  }

  const discount = parseMoney(fd.get("discount")) ?? 0;
  const supabase = await createClient();
  const { data: orderId, error } = await supabase.rpc("open_service_order", {
    p_customer_id: customerId,
    p_vehicle_id: vehicleId,
    p_items: items.data.map((i) => ({ ...i, service_id: i.service_id ?? null, employee_id: i.employee_id ?? null })),
    p_responsible_id: str(fd, "responsible_id"),
    p_expected_at: fromLocalInput(str(fd, "expected_at")),
    p_mileage_km: intOrNull(str(fd, "mileage_km")),
    p_fuel_level: str(fd, "fuel_level"),
    p_initial_condition: str(fd, "initial_condition"),
    p_damages: str(fd, "damages"),
    p_notes: str(fd, "notes"),
    p_discount: discount,
    p_appointment_id: str(fd, "appointment_id"),
  });
  if (error) return dbFail(error);

  // Atualiza a quilometragem do cadastro do veículo, se informada
  const mileage = intOrNull(str(fd, "mileage_km"));
  if (mileage !== null) await supabase.from("vehicles").update({ mileage_km: mileage }).eq("id", vehicleId);

  // As fotos de entrada são enviadas pelo navegador logo em seguida (registerPhotos).
  touch(orderId as string);
  return ok("Entrada registrada e OS aberta.", { redirect: `/ordens/${orderId}`, data: { orderId: orderId as string } });
}

// ---------------------------------------------------------------------------
// Andamento
// ---------------------------------------------------------------------------
const STATUSES = ["received", "evaluation", "waiting", "in_progress", "quality_control", "completed", "awaiting_pickup", "delivered", "cancelled"] as const;

export async function changeStatus(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = String(fd.get("id"));
  const status = z.enum(STATUSES).safeParse(fd.get("status"));
  if (!status.success) return fail("Status inválido.");
  const note = str(fd, "note") ?? str(fd, "reason");
  if (status.data === "cancelled" && (!note || note.length < 3)) return fail("Informe o motivo do cancelamento.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("change_order_status", {
    p_order_id: id,
    p_status: status.data as OrderStatus,
    p_note: note,
    p_allow_balance: fd.get("allow_balance") === "on",
  });
  if (error) {
    if (error.hint === "pending_balance") return fail(error.message, { allow_balance: "pending" });
    return dbFail(error);
  }
  touch(id);
  return ok("Status atualizado.");
}

export async function addNote(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = String(fd.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_order_note", { p_order_id: id, p_note: String(fd.get("note") ?? "") });
  if (error) return dbFail(error);
  touch(id);
  return ok("Observação registrada.");
}

export async function updateOrderInfo(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = String(fd.get("id"));
  const responsible = str(fd, "responsible_id");
  if (responsible && !uuid.safeParse(responsible).success) return fail("Responsável inválido.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("service_orders")
    .update({
      responsible_id: responsible,
      expected_at: fromLocalInput(str(fd, "expected_at")),
      mileage_km: intOrNull(str(fd, "mileage_km")),
      fuel_level: str(fd, "fuel_level"),
      initial_condition: str(fd, "initial_condition"),
      damages: str(fd, "damages"),
      notes: str(fd, "notes"),
    })
    .eq("id", id);
  if (error) return dbFail(error);
  touch(id);
  return ok("Dados da OS atualizados.");
}

export async function setOrderDiscount(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const id = String(fd.get("id"));
  const value = parseMoney(fd.get("discount"));
  if (value === null || value < 0) return fail("Desconto inválido.");
  const supabase = await createClient();
  const { error } = await supabase.from("service_orders").update({ discount: value }).eq("id", id);
  if (error) return dbFail(error);
  touch(id);
  return ok("Desconto aplicado.");
}

// ---------------------------------------------------------------------------
// Serviços da OS
// ---------------------------------------------------------------------------
export async function addItem(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const orderId = String(fd.get("order_id"));
  const supabase = await createClient();
  const serviceId = str(fd, "service_id");
  let description = str(fd, "description");
  let price = parseMoney(fd.get("unit_price"));
  if (serviceId) {
    const { data: s } = await supabase.from("services").select("name, default_price").eq("id", serviceId).maybeSingle();
    if (!s) return fail("Serviço não encontrado.");
    description = description ?? s.name;
    price = price ?? Number(s.default_price);
  }
  if (!description || description.length < 2) return fail("Descreva o serviço.", { description: "Descreva o serviço." });
  if (price === null || price < 0) return fail("Informe o valor.", { unit_price: "Informe o valor." });
  const quantity = Number(String(fd.get("quantity") ?? "1").replace(",", ".")) || 1;
  const discount = parseMoney(fd.get("discount")) ?? 0;
  const { error } = await supabase.from("service_order_items").insert({
    order_id: orderId, service_id: serviceId, description, quantity, unit_price: price, discount, employee_id: str(fd, "employee_id"),
  });
  if (error) return dbFail(error);
  touch(orderId);
  return ok("Serviço incluído na OS.");
}

export async function updateItem(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const orderId = String(fd.get("order_id"));
  const itemId = String(fd.get("item_id"));
  const patch: Record<string, unknown> = {};
  if (fd.has("status")) {
    const s = z.enum(["pending", "in_progress", "done"]).safeParse(fd.get("status"));
    if (!s.success) return fail("Situação inválida.");
    patch.status = s.data;
  }
  if (fd.has("employee_id")) patch.employee_id = str(fd, "employee_id");
  if (fd.has("unit_price")) {
    const p = parseMoney(fd.get("unit_price"));
    if (p === null || p < 0) return fail("Valor inválido.");
    patch.unit_price = p;
  }
  if (fd.has("discount")) {
    const d = parseMoney(fd.get("discount"));
    if (d === null || d < 0) return fail("Desconto inválido.");
    patch.discount = d;
  }
  if (fd.has("quantity")) {
    const q = Number(String(fd.get("quantity")).replace(",", "."));
    if (!(q > 0)) return fail("Quantidade inválida.");
    patch.quantity = q;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("service_order_items").update(patch).eq("id", itemId);
  if (error) return dbFail(error);
  touch(orderId);
  return ok("Serviço atualizado.");
}

export async function removeItem(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const orderId = String(fd.get("order_id"));
  const reason = str(fd, "reason");
  if (!reason || reason.length < 3) return fail("Informe o motivo da remoção.");
  const supabase = await createClient();
  const { count } = await supabase.from("service_order_items").select("id", { count: "exact", head: true }).eq("order_id", orderId);
  if ((count ?? 0) <= 1) return fail("A OS precisa de pelo menos um serviço. Inclua outro antes de remover este.");
  const { error } = await supabase.from("service_order_items").delete().eq("id", String(fd.get("item_id")));
  if (error) return dbFail(error);
  await supabase.rpc("add_order_note", { p_order_id: orderId, p_note: `Motivo da remoção do serviço: ${reason}` });
  touch(orderId);
  return ok("Serviço removido (registrado no histórico).");
}

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------
/**
 * Registra na OS as fotos que o navegador já enviou ao Storage.
 * O banco confere que cada arquivo existe e está na pasta desta OS.
 */
export async function registerPhotos(orderId: string, kind: string, caption: string | null, paths: string[]): Promise<ActionResult> {
  await requireUser();
  if (!uuid.safeParse(orderId).success) return fail("OS inválida.");
  const k = z.enum(PHOTO_KINDS).safeParse(kind);
  if (!k.success) return fail("Tipo de foto inválido.");
  const pattern = new RegExp(`^orders/${orderId}/[0-9a-f-]{36}\\.(jpg|png|webp|heic|heif)$`);
  const list = z.array(z.string().regex(pattern)).min(1).max(15).safeParse(paths);
  if (!list.success) return fail("Arquivos de foto inválidos.");
  const text = caption?.trim().slice(0, 160) || null;
  const supabase = await createClient();
  const { error } = await supabase.from("order_photos").insert(list.data.map((p) => ({ order_id: orderId, storage_path: p, kind: k.data, caption: text })));
  if (error) return dbFail(error);
  touch(orderId);
  return ok(`${list.data.length} foto(s) anexada(s).`);
}

export async function removePhoto(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const orderId = String(fd.get("order_id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_order_photo", { p_photo_id: String(fd.get("photo_id")) });
  if (error) return dbFail(error);
  touch(orderId);
  return ok("Foto retirada da OS (o arquivo original fica preservado).");
}

// ---------------------------------------------------------------------------
// Pagamentos
// ---------------------------------------------------------------------------
export async function registerPayment(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const orderId = String(fd.get("order_id"));
  const amount = parseMoney(fd.get("amount"));
  if (!amount || amount <= 0) return fail("Informe o valor recebido.", { amount: "Informe o valor recebido." });
  const methodId = str(fd, "method_id");
  if (!methodId) return fail("Selecione a forma de pagamento.", { method_id: "Selecione a forma de pagamento." });
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_payment", {
    p_order_id: orderId,
    p_amount: amount,
    p_method_id: methodId,
    p_paid_at: fromLocalInput(str(fd, "paid_at")) ?? new Date().toISOString(),
    p_notes: str(fd, "notes"),
  });
  if (error) return dbFail(error);
  touch(orderId);
  revalidatePath("/financeiro");
  return ok("Pagamento registrado.");
}

export async function refundPayment(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const orderId = String(fd.get("order_id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("refund_payment", { p_payment_id: String(fd.get("payment_id")), p_reason: String(fd.get("reason") ?? "") });
  if (error) return dbFail(error);
  touch(orderId);
  revalidatePath("/financeiro");
  return ok("Estorno registrado.");
}
