import { Check } from "lucide-react";
import { FLOW, ORDER_STATUS } from "@/lib/constants";
import type { OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Etapas do andamento (1 a 8), destacando a atual. */
export function StatusStepper({ status }: { status: OrderStatus }) {
  if (status === "cancelled") return null;
  const idx = FLOW.indexOf(status);
  return (
    <ol className="thin-scroll flex gap-1 overflow-x-auto pb-1" aria-label="Andamento">
      {FLOW.map((s, i) => {
        const done = i < idx, current = i === idx;
        return (
          <li key={s} className="min-w-[88px] flex-1" aria-current={current ? "step" : undefined}>
            <div className={cn("h-1 rounded-full", done || current ? "bg-gold-500" : "bg-ink-800", current && "bg-gold-300")} />
            <div className={cn("mt-2 flex items-center gap-1 text-[11px] font-medium", current ? "text-gold-300" : done ? "text-ink-300" : "text-ink-500")}>
              {done ? <Check className="h-3 w-3 shrink-0" /> : <span className="tabular-nums">{i + 1}.</span>}
              <span className="truncate">{ORDER_STATUS[s].short}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
