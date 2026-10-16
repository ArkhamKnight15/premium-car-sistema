import { plate as fmt } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Placa no estilo Mercosul (faixa superior azul) ou antiga. */
export function Plate({ value, size = "md", className }: { value: string | null | undefined; size?: "sm" | "md" | "lg"; className?: string }) {
  if (!value) return <span className={cn("rounded border border-dashed border-ink-600 px-2 py-0.5 text-[10px] font-semibold text-ink-400", className)}>SEM PLACA</span>;
  const mercosul = /^[A-Z]{3}\d[A-Z]\d{2}$/.test(value);
  const s = { sm: "text-[11px] px-1.5", md: "text-xs px-2", lg: "text-base px-3 py-0.5" }[size];
  return (
    <span className={cn("inline-flex flex-col overflow-hidden rounded-[5px] border border-ink-300/70 bg-ink-100 text-center font-display leading-none tracking-[0.12em] text-ink-950", className)}>
      {mercosul ? <span className="h-[3px] w-full bg-sky-700" aria-hidden /> : null}
      <span className={cn("py-1", s)}>{fmt(value)}</span>
    </span>
  );
}
