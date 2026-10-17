"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/forms/action-form";
import { FLOW, ORDER_STATUS } from "@/lib/constants";
import { money } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";
import { changeStatus } from "@/actions/orders";

/** Avanço rápido de status (usado nos cards de "Veículos na Empresa" e na OS). */
export function QuickStatus({ orderId, status, balance, compact }: { orderId: string; status: OrderStatus; balance: number; compact?: boolean }) {
  const [state, run, pending] = useActionState(changeStatus, null);
  const [confirmBalance, setConfirmBalance] = useState(false);
  const router = useRouter();
  const idx = FLOW.indexOf(status);
  const next = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;
  useEffect(() => {
    if (state?.ok) {
      setConfirmBalance(false);
      router.refresh();
    } else if (state?.fieldErrors?.allow_balance) setConfirmBalance(true);
  }, [state, router]);
  if (!next) return null;
  const delivering = next === "delivered";
  return (
    <form action={run} className="space-y-2">
      <input type="hidden" name="id" value={orderId} />
      <input type="hidden" name="status" value={next} />
      {confirmBalance || (delivering && balance > 0) ? (
        <label className="flex items-start gap-2 rounded-md border border-amber-400/30 bg-amber-400/5 p-2 text-xs text-amber-200">
          <input type="checkbox" name="allow_balance" className="mt-0.5 accent-[var(--color-brand-500)]" />
          Entregar com saldo pendente de {money(balance)}
        </label>
      ) : null}
      <Button type="submit" size={compact ? "sm" : "md"} variant={delivering ? "primary" : "secondary"} disabled={pending} className="w-full">
        {pending ? <Loader2 className="animate-spin" /> : <ArrowRight />}
        {delivering ? "Registrar entrega" : ORDER_STATUS[next].label}
      </Button>
      {state && !state.ok ? <FormMessage state={state} /> : null}
    </form>
  );
}
