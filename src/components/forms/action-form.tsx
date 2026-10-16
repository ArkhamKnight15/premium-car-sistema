"use client";
import { createContext, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ActionResult } from "@/lib/types";
import { Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type FormAction = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

const ResultContext = createContext<ActionResult | null>(null);
export const useFormResult = () => useContext(ResultContext);

export function FormMessage({ state, className }: { state: ActionResult | null | undefined; className?: string }) {
  if (!state?.message) return null;
  const Icon = state.ok ? CheckCircle2 : AlertCircle;
  return (
    <div role={state.ok ? "status" : "alert"}
      className={cn("flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm animate-in",
        state.ok ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-red-400/25 bg-red-400/10 text-red-200", className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{state.message}</span>
    </div>
  );
}

/**
 * Formulário ligado a uma Server Action: mostra sucesso/erro, erros por campo,
 * estado de carregamento (via SubmitButton) e redireciona quando a ação pede.
 */
export function ActionForm({ action, children, className, reset, messageOnTop, id, onSuccessRedirect }: {
  action: FormAction; children: ReactNode; className?: string; reset?: boolean; messageOnTop?: boolean; id?: string; onSuccessRedirect?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!state?.ok) return;
    if (reset) ref.current?.reset();
    const to = state.redirect ?? onSuccessRedirect;
    if (to) router.push(to);
  }, [state, reset, router, onSuccessRedirect]);
  return (
    <ResultContext.Provider value={state}>
      <form ref={ref} action={formAction} className={className} id={id} noValidate>
        {messageOnTop ? <FormMessage state={state} className="mb-4" /> : null}
        {children}
        {!messageOnTop ? <FormMessage state={state} className="mt-4" /> : null}
      </form>
    </ResultContext.Provider>
  );
}

/** Rótulo + controle + erro do campo (lido do resultado da ação). */
export function Field({ name, label, required, hint, children, className }: {
  name: string; label: string; required?: boolean; hint?: ReactNode; children: ReactNode; className?: string;
}) {
  const error = useFormResult()?.fieldErrors?.[name];
  return (
    <div className={className}>
      <Label htmlFor={name} required={required}>{label}</Label>
      <div className={cn(error && "[&_input]:border-red-400/60 [&_select]:border-red-400/60 [&_textarea]:border-red-400/60")}>{children}</div>
      {error ? <p className="mt-1 text-xs text-red-300" role="alert">{error}</p> : hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}
