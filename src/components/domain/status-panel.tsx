"use client";
import { useState } from "react";
import { ActionForm, Field } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { Select, Textarea } from "@/components/ui/input";
import { ORDER_STATUS } from "@/lib/constants";
import { money } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";
import { changeStatus } from "@/actions/orders";

/** Alteração livre de status (incluindo cancelamento com motivo e entrega com saldo). */
export function StatusPanel({ orderId, status, balance, isAdmin }: { orderId: string; status: OrderStatus; balance: number; isAdmin: boolean }) {
  const [target, setTarget] = useState<OrderStatus>(status);
  const closed = status === "delivered" || status === "cancelled";
  if (closed && !isAdmin) return <p className="text-sm text-ink-400">OS encerrada. Somente administradores podem reabri-la.</p>;
  return (
    <ActionForm action={changeStatus} className="space-y-3">
      <input type="hidden" name="id" value={orderId} />
      <Field name="status" label={closed ? "Reabrir / alterar status" : "Alterar status"}>
        <Select id="status" name="status" value={target} onChange={(e) => setTarget(e.target.value as OrderStatus)}>
          {(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => <option key={s} value={s}>{ORDER_STATUS[s].label}</option>)}
        </Select>
      </Field>
      {target === "delivered" && balance > 0 ? (
        <label className="flex items-start gap-2 rounded-md border border-amber-400/30 bg-amber-400/5 p-2.5 text-xs text-amber-200">
          <input type="checkbox" name="allow_balance" className="mt-0.5 accent-[var(--color-brand-500)]" />
          Confirmo a entrega com saldo pendente de {money(balance)} (fica registrado na OS).
        </label>
      ) : null}
      <Field name="note" label={target === "cancelled" ? "Motivo do cancelamento" : "Observação (opcional)"}>
        <Textarea id="note" name="note" rows={2} required={target === "cancelled"} placeholder={target === "cancelled" ? "Obrigatório" : "Ex.: aguardando peça, cliente avisado…"} />
      </Field>
      <SubmitButton size="sm" variant={target === "cancelled" ? "danger" : "secondary"} disabled={target === status} className="w-full">
        {target === "cancelled" ? "Cancelar OS" : target === "delivered" ? "Registrar entrega" : "Salvar status"}
      </SubmitButton>
    </ActionForm>
  );
}
