"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/forms/action-form";
import { ITEM_STATUS } from "@/lib/constants";
import { money, moneyInput, shortDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Employee, ItemStatus, OrderItem, Service } from "@/lib/types";
import { addItem, removeItem, updateItem } from "@/actions/orders";

type Props = { orderId: string; items: OrderItem[]; employees: Employee[]; services: Service[]; locked: boolean; canDiscount: boolean };

/** Serviços da OS: andamento por item, executor, preço/desconto (com permissão), inclusão e remoção. */
export function OrderItems({ orderId, items, employees, services, locked, canDiscount }: Props) {
  const empName = new Map(employees.map((e) => [e.id, e.full_name]));
  return (
    <div>
      <ul className="divide-y divide-ink-800">
        {items.map((it) => (
          <ItemRow key={it.id} orderId={orderId} item={it} employees={employees} employeeName={it.employee_id ? empName.get(it.employee_id) : undefined} locked={locked} canDiscount={canDiscount} single={items.length === 1} />
        ))}
      </ul>
      {!locked ? <AddItem orderId={orderId} services={services} employees={employees} canDiscount={canDiscount} /> : null}
    </div>
  );
}

function useRefreshOnSuccess(state: { ok: boolean } | null) {
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
}

function ItemRow({ orderId, item, employees, employeeName, locked, canDiscount, single }: {
  orderId: string; item: OrderItem; employees: Employee[]; employeeName?: string; locked: boolean; canDiscount: boolean; single: boolean;
}) {
  const [state, run, pending] = useActionState(updateItem, null);
  const [rmState, rm, removing] = useActionState(removeItem, null);
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const statusForm = useRef<HTMLFormElement>(null);
  const empForm = useRef<HTMLFormElement>(null);
  useRefreshOnSuccess(state);
  useRefreshOnSuccess(rmState);
  useEffect(() => {
    if (state?.ok) setEditing(false);
  }, [state]);
  const priceEditable = canDiscount || !item.service_id;

  return (
    <li className="py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink-100">{item.description}{Number(item.quantity) !== 1 ? <span className="text-ink-400"> × {String(item.quantity).replace(".", ",")}</span> : null}</p>
          <p className="mt-0.5 text-xs text-ink-400">
            {money(item.unit_price)}{Number(item.discount) > 0 ? ` − ${money(item.discount)} de desconto` : ""}
            {item.started_at ? ` · início ${shortDateTime(item.started_at)}` : ""}
            {item.finished_at ? ` · fim ${shortDateTime(item.finished_at)}` : ""}
          </p>
        </div>
        <p className="text-sm font-semibold tabular-nums">{money(item.line_total)}</p>
      </div>

      {locked ? (
        <p className="mt-2 text-xs text-ink-400">{ITEM_STATUS[item.status].label}{employeeName ? ` · ${employeeName}` : ""}</p>
      ) : (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <form ref={statusForm} action={run}>
            <input type="hidden" name="order_id" value={orderId} />
            <input type="hidden" name="item_id" value={item.id} />
            <Select name="status" defaultValue={item.status} onChange={() => statusForm.current?.requestSubmit()} aria-label="Situação do serviço"
              className={cn("h-8 w-36 text-xs", item.status === "in_progress" && "border-sky-400/40 text-sky-200", item.status === "done" && "border-emerald-400/40 text-emerald-200")}>
              {(Object.keys(ITEM_STATUS) as ItemStatus[]).map((s) => <option key={s} value={s}>{ITEM_STATUS[s].label}</option>)}
            </Select>
          </form>
          <form ref={empForm} action={run}>
            <input type="hidden" name="order_id" value={orderId} />
            <input type="hidden" name="item_id" value={item.id} />
            <Select name="employee_id" defaultValue={item.employee_id ?? ""} onChange={() => empForm.current?.requestSubmit()} aria-label="Executor" className="h-8 w-44 text-xs">
              <option value="">Executor a definir</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </Select>
          </form>
          {pending || removing ? <Loader2 className="h-4 w-4 animate-spin text-ink-400" /> : null}
          <span className="ml-auto flex gap-1">
            {priceEditable ? <Button size="xs" variant="ghost" onClick={() => setEditing((e) => !e)} aria-label="Editar valores"><Pencil /></Button> : null}
            {!single ? <Button size="xs" variant="ghost" onClick={() => setConfirmRemove(true)} aria-label="Remover serviço"><Trash2 /></Button> : null}
          </span>
        </div>
      )}

      {editing && !locked ? (
        <form action={run} className="mt-3 grid gap-2 rounded-lg border border-ink-800 bg-ink-925 p-3 sm:grid-cols-4 sm:items-end">
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="item_id" value={item.id} />
          <div><Label>Qtd.</Label><Input name="quantity" defaultValue={String(item.quantity).replace(".", ",")} inputMode="decimal" className="h-9" /></div>
          <div><Label>Valor unitário</Label><Input name="unit_price" defaultValue={moneyInput(item.unit_price)} inputMode="decimal" className="h-9" /></div>
          {canDiscount ? <div><Label>Desconto</Label><Input name="discount" defaultValue={moneyInput(item.discount)} inputMode="decimal" className="h-9" /></div> : <span />}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}><Check /> Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X /></Button>
          </div>
        </form>
      ) : null}

      {confirmRemove ? (
        <form action={rm} className="mt-3 space-y-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="item_id" value={item.id} />
          <p className="text-sm">Remover “{item.description}” da OS? A remoção fica registrada no histórico.</p>
          <Input name="reason" placeholder="Motivo (ex.: cliente não autorizou)" required minLength={3} className="h-9" autoFocus />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="danger" disabled={removing}>Remover</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>Voltar</Button>
          </div>
        </form>
      ) : null}
      {state && !state.ok ? <FormMessage state={state} className="mt-2" /> : null}
      {rmState && !rmState.ok ? <FormMessage state={rmState} className="mt-2" /> : null}
    </li>
  );
}

function AddItem({ orderId, services, employees, canDiscount }: { orderId: string; services: Service[]; employees: Employee[]; canDiscount: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, run, pending] = useActionState(addItem, null);
  const [serviceId, setServiceId] = useState("");
  const form = useRef<HTMLFormElement>(null);
  useRefreshOnSuccess(state);
  useEffect(() => {
    if (state?.ok) {
      form.current?.reset();
      setServiceId("");
      setOpen(false);
    }
  }, [state]);
  const svc = services.find((s) => s.id === serviceId);
  const custom = serviceId === "__custom";

  if (!open) {
    return (
      <div className="border-t border-ink-800 pt-3">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Plus /> Incluir serviço</Button>
        {state?.ok ? <FormMessage state={state} className="mt-2" /> : null}
      </div>
    );
  }
  return (
    <form ref={form} action={run} className="mt-2 grid gap-3 rounded-lg border border-ink-800 bg-ink-925 p-3 sm:grid-cols-6 sm:items-end">
      <input type="hidden" name="order_id" value={orderId} />
      <div className="sm:col-span-3">
        <Label>Serviço</Label>
        <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required>
          <option value="">Selecione…</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name} — {money(s.default_price)}</option>)}
          <option value="__custom">Outro (personalizado)</option>
        </Select>
        {!custom && serviceId ? <input type="hidden" name="service_id" value={serviceId} /> : null}
      </div>
      <div className="sm:col-span-3">
        <Label>Executor</Label>
        <Select name="employee_id" defaultValue="">
          <option value="">A definir</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </Select>
      </div>
      {custom ? <div className="sm:col-span-6"><Label required>Descrição</Label><Input name="description" required placeholder="Descreva o serviço" /></div> : null}
      <div className="sm:col-span-1"><Label>Qtd.</Label><Input name="quantity" defaultValue="1" inputMode="decimal" /></div>
      <div className="sm:col-span-2">
        <Label>Valor (R$)</Label>
        <Input key={serviceId} name="unit_price" defaultValue={svc ? moneyInput(svc.default_price) : ""} inputMode="decimal" readOnly={!custom && !canDiscount}
          className={!custom && !canDiscount ? "opacity-70" : undefined} />
      </div>
      {canDiscount ? <div className="sm:col-span-1"><Label>Desconto</Label><Input name="discount" defaultValue="0,00" inputMode="decimal" /></div> : null}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="md" disabled={pending || !serviceId}>{pending ? <Loader2 className="animate-spin" /> : <Plus />} Incluir</Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
      {state && !state.ok ? <FormMessage state={state} className="sm:col-span-6" /> : null}
    </form>
  );
}
