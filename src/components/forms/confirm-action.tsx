"use client";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, type Size, type Variant } from "@/components/ui/button";
import { FormMessage, type FormAction } from "./action-form";

/** Botão para ações importantes ou destrutivas: pede confirmação (e motivo, se necessário). */
export function ConfirmAction({
  action, fields, label, icon, question = "Confirmar esta ação?", confirmLabel = "Confirmar", variant = "danger", size = "sm",
  reasonPlaceholder, reasonRequired = true, className, extra,
}: {
  action: FormAction; fields: Record<string, string>; label: ReactNode; icon?: ReactNode; question?: ReactNode; confirmLabel?: string;
  variant?: Variant; size?: Size; reasonPlaceholder?: string; reasonRequired?: boolean; className?: string; extra?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, run, pending] = useActionState(action, null);
  const router = useRouter();
  useEffect(() => {
    if (!state?.ok) return;
    setOpen(false);
    if (state.redirect) router.push(state.redirect);
  }, [state, router]);
  return (
    <div className={className}>
      {!open ? (
        <Button variant={variant} size={size} onClick={() => setOpen(true)}>{icon}{label}</Button>
      ) : (
        <form action={run} className="space-y-2.5 rounded-lg border border-ink-700 bg-ink-850 p-3 animate-in">
          {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <p className="text-sm text-ink-100">{question}</p>
          {extra}
          {reasonPlaceholder ? (
            <input name="reason" required={reasonRequired} minLength={reasonRequired ? 3 : undefined} placeholder={reasonPlaceholder} autoFocus
              className="h-9 w-full rounded-md border border-ink-700 bg-ink-925 px-2.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-gold-500 focus:outline-none" />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" variant={variant === "danger" ? "danger" : "primary"} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}{confirmLabel}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Voltar</Button>
          </div>
        </form>
      )}
      {!open || state?.ok === false ? <FormMessage state={state} className="mt-2" /> : null}
    </div>
  );
}
