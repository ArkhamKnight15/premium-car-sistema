"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Plus, Trash2 } from "lucide-react";
import { ActionForm, Field, useFormResult } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { FUEL_LEVELS } from "@/lib/constants";
import { minutes, money, moneyInput } from "@/lib/format";
import { parseMoney } from "@/lib/validation";
import type { Employee, Service } from "@/lib/types";
import { checkPhotos, uploadOrderPhotos } from "@/lib/photo-upload";
import type { ActionResult } from "@/lib/types";
import { openOrder, registerPhotos } from "@/actions/orders";

type Row = { key: string; service_id: string | null; description: string; quantity: string; unit_price: string; discount: string; employee_id: string };

let seq = 0;
const newKey = () => `r${++seq}`;

export type EntryDefaults = {
  customerId: string;
  vehicleId: string;
  appointmentId?: string;
  responsibleId?: string;
  mileage?: number | null;
  notes?: string | null;
  serviceIds?: string[];
  executorId?: string | null;
};

/** Formulário de entrada do veículo e abertura da OS (serviços, valores, estado inicial e fotos). */
export function EntryForm({ services, employees, canDiscount, defaults }: { services: Service[]; employees: Employee[]; canDiscount: boolean; defaults: EntryDefaults }) {
  const byId = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const [rows, setRows] = useState<Row[]>(() =>
    (defaults.serviceIds ?? [])
      .map((id) => byId.get(id))
      .filter((s): s is Service => Boolean(s))
      .map((s) => ({ key: newKey(), service_id: s.id, description: s.name, quantity: "1", unit_price: moneyInput(s.default_price), discount: "0,00", employee_id: defaults.executorId ?? "" })),
  );
  const [picker, setPicker] = useState("");
  const [orderDiscount, setOrderDiscount] = useState("0,00");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  function pickPhotos(list: FileList | null) {
    const next = [...photos, ...Array.from(list ?? [])];
    const err = checkPhotos(next);
    setPhotoError(err);
    if (!err) setPhotos(next);
  }

  // Depois de abrir a OS, as fotos vão direto do navegador para o Storage privado.
  async function sendPhotos(state: ActionResult) {
    const orderId = (state.data as { orderId?: string } | undefined)?.orderId;
    if (!orderId || !photos.length) return;
    const { paths, failed } = await uploadOrderPhotos(orderId, photos, (d, t) => setUploading(`Enviando fotos ${d}/${t}…`));
    const saved = paths.length ? await registerPhotos(orderId, "entry", null, paths) : null;
    setUploading(null);
    if (failed.length || (saved && !saved.ok)) return `/ordens/${orderId}?fotos=falha`;
  }

  const lineTotal = (r: Row) => Math.max(0, (Number(r.quantity.replace(",", ".")) || 0) * (parseMoney(r.unit_price) ?? 0) - (parseMoney(r.discount) ?? 0));
  const subtotal = rows.reduce((a, r) => a + lineTotal(r), 0);
  const total = Math.max(0, subtotal - (parseMoney(orderDiscount) ?? 0));
  const duration = rows.reduce((a, r) => a + (r.service_id ? byId.get(r.service_id)?.estimated_minutes ?? 0 : 0), 0);

  function add(id: string) {
    if (!id) return;
    if (id === "__custom") {
      setRows((r) => [...r, { key: newKey(), service_id: null, description: "", quantity: "1", unit_price: "0,00", discount: "0,00", employee_id: "" }]);
    } else {
      const s = byId.get(id);
      if (!s) return;
      setRows((r) => [...r, { key: newKey(), service_id: s.id, description: s.name, quantity: "1", unit_price: moneyInput(s.default_price), discount: "0,00", employee_id: "" }]);
    }
    setPicker("");
  }
  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const payload = JSON.stringify(
    rows.map((r) => ({
      service_id: r.service_id,
      description: r.description,
      quantity: r.quantity.replace(",", "."),
      unit_price: r.unit_price,
      discount: canDiscount ? r.discount : "0",
      employee_id: r.employee_id || null,
    })),
  );

  return (
    <ActionForm action={openOrder} afterSuccess={sendPhotos} className="space-y-6">
      <input type="hidden" name="customer_id" value={defaults.customerId} />
      <input type="hidden" name="vehicle_id" value={defaults.vehicleId} />
      {defaults.appointmentId ? <input type="hidden" name="appointment_id" value={defaults.appointmentId} /> : null}
      <input type="hidden" name="items" value={payload} />

      {/* Serviços */}
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Serviços solicitados / autorizados</h3>
            <p className="text-xs text-ink-400">Inclua quantos forem necessários.{!canDiscount ? " Preços do catálogo; serviços personalizados podem ter valor livre." : ""}</p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <Select value={picker} onChange={(e) => add(e.target.value)} aria-label="Adicionar serviço" className="sm:w-72">
              <option value="">+ Adicionar serviço…</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name} — {money(s.default_price)}</option>)}
              <option value="__custom">Outro serviço (personalizado)</option>
            </Select>
          </div>
        </div>
        <ItemsError />
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-ink-700 px-4 py-8 text-center text-sm text-ink-400">Nenhum serviço adicionado.</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const custom = !r.service_id;
              const priceLocked = !custom && !canDiscount;
              return (
                <div key={r.key} className="grid gap-2 rounded-lg border border-ink-800 bg-ink-925 p-3 sm:grid-cols-12 sm:items-end">
                  <div className="sm:col-span-4">
                    <Label>{custom ? "Descrição" : "Serviço"}</Label>
                    {custom ? (
                      <Input value={r.description} onChange={(e) => update(r.key, { description: e.target.value })} placeholder="Descreva o serviço" />
                    ) : (
                      <p className="flex h-10 items-center truncate text-sm font-medium">{r.description}</p>
                    )}
                  </div>
                  <div className="sm:col-span-1">
                    <Label>Qtd.</Label>
                    <Input value={r.quantity} onChange={(e) => update(r.key, { quantity: e.target.value })} inputMode="decimal" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Valor (R$)</Label>
                    <Input value={r.unit_price} onChange={(e) => update(r.key, { unit_price: e.target.value })} inputMode="decimal" disabled={priceLocked} title={priceLocked ? "Sem permissão para alterar preços do catálogo" : undefined} />
                  </div>
                  {canDiscount ? (
                    <div className="sm:col-span-2">
                      <Label>Desconto (R$)</Label>
                      <Input value={r.discount} onChange={(e) => update(r.key, { discount: e.target.value })} inputMode="decimal" />
                    </div>
                  ) : null}
                  <div className={canDiscount ? "sm:col-span-2" : "sm:col-span-4"}>
                    <Label>Executor</Label>
                    <Select value={r.employee_id} onChange={(e) => update(r.key, { employee_id: e.target.value })}>
                      <option value="">A definir</option>
                      {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                    </Select>
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:col-span-1 sm:flex-col sm:items-end">
                    <span className="text-sm font-semibold tabular-nums text-ink-100">{money(lineTotal(r))}</span>
                    <Button variant="ghost" size="xs" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={`Remover ${r.description || "serviço"}`}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-end justify-end gap-x-6 gap-y-2 text-sm">
          {duration ? <span className="text-ink-400">Duração estimada: {minutes(duration)}</span> : null}
          <span className="text-ink-400">Subtotal <span className="tabular-nums text-ink-100">{money(subtotal)}</span></span>
          {canDiscount ? (
            <label className="flex items-center gap-2 text-ink-400">
              Desconto na OS
              <Input name="discount" value={orderDiscount} onChange={(e) => setOrderDiscount(e.target.value)} inputMode="decimal" className="h-8 w-28 text-right" />
            </label>
          ) : null}
          <span className="text-base font-semibold">Total <span className="tabular-nums text-gold-300">{money(total)}</span></span>
        </div>
      </section>

      {/* Entrada */}
      <section className="grid gap-4 border-t border-ink-800 pt-6 sm:grid-cols-6">
        <h3 className="text-sm font-semibold sm:col-span-6">Entrada do veículo</h3>
        <Field name="responsible_id" label="Funcionário responsável" className="sm:col-span-2">
          <Select id="responsible_id" name="responsible_id" defaultValue={defaults.responsibleId ?? ""}>
            <option value="">A definir</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}{e.job_title ? ` · ${e.job_title}` : ""}</option>)}
          </Select>
        </Field>
        <Field name="expected_at" label="Previsão de conclusão" className="sm:col-span-2">
          <Input id="expected_at" name="expected_at" type="datetime-local" />
        </Field>
        <Field name="mileage_km" label="Quilometragem" className="sm:col-span-1">
          <Input id="mileage_km" name="mileage_km" inputMode="numeric" defaultValue={defaults.mileage ?? ""} />
        </Field>
        <Field name="fuel_level" label="Combustível" className="sm:col-span-1">
          <Select id="fuel_level" name="fuel_level" defaultValue="">
            <option value="">—</option>
            {FUEL_LEVELS.map((f) => <option key={f} value={f}>{f}</option>)}
          </Select>
        </Field>
        <Field name="initial_condition" label="Estado inicial do veículo" className="sm:col-span-3">
          <Textarea id="initial_condition" name="initial_condition" rows={3} placeholder="Ex.: pintura com marcas de lavagem, interior com pelos de animal, objetos no porta-malas…" />
        </Field>
        <Field name="damages" label="Avarias preexistentes" className="sm:col-span-3">
          <Textarea id="damages" name="damages" rows={3} placeholder="Riscos, amassados, trincas, peças soltas… (registre também nas fotos)" />
        </Field>
        <Field name="notes" label="Observações" className="sm:col-span-6">
          <Textarea id="notes" name="notes" rows={2} defaultValue={defaults.notes ?? ""} placeholder="Pedidos do cliente, combinados, cuidados especiais…" />
        </Field>
        <div className="sm:col-span-6">
          <Label htmlFor="photos">Fotos de entrada</Label>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-ink-700 bg-ink-925 px-4 py-4 text-sm text-ink-300 hover:border-gold-500/50">
            <Camera className="h-5 w-5 text-gold-400" />
            <span>{photos.length ? `${photos.length} foto(s) — toque para adicionar mais` : "Tirar ou escolher fotos"}</span>
            {/* sem "name": as fotos não vão no formulário, e sim direto ao Storage */}
            <input id="photos" type="file" accept="image/*" multiple capture="environment" className="sr-only"
              onChange={(e) => { pickPhotos(e.currentTarget.files); e.currentTarget.value = ""; }} />
          </label>
          {photoError ? <p className="mt-1 text-xs text-red-300" role="alert">{photoError}</p> : <p className="mt-1 text-xs text-ink-500">Até 15 fotos (JPG, PNG, WEBP ou HEIC). As fotos grandes são reduzidas antes do envio.</p>}
          {photos.length ? (
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {photos.map((f, i) => (
                <li key={previews[i]} className="relative overflow-hidden rounded-md border border-ink-800 bg-ink-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previews[i]} alt={f.name} className="aspect-square w-full object-cover" />
                  <button type="button" onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))} aria-label={`Remover ${f.name}`}
                    className="absolute right-1 top-1 rounded bg-black/70 p-1 text-ink-100 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-800 pt-5">
        <p className="text-xs text-ink-500">A data e hora de entrada e o seu usuário são registrados automaticamente.</p>
        {uploading ? <p className="text-sm text-gold-300" role="status">{uploading}</p> : null}
        <SubmitButton size="lg" disabled={rows.length === 0 || !!uploading} pendingText="Abrindo OS…">
          <Plus /> Registrar entrada e abrir OS
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

function ItemsError() {
  const msg = useFormResult()?.fieldErrors?.items;
  return msg ? <p className="mb-2 text-xs text-red-300" role="alert">{msg}</p> : null;
}
