"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { checkDuplicates, type DuplicateHit } from "@/actions/customers";
import { phone } from "@/lib/format";

/** Observa nome, documento, telefone e e-mail do formulário e avisa sobre cadastros parecidos. */
export function DuplicateWatcher({ ignoreId }: { ignoreId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hits, setHits] = useState<DuplicateHit[]>([]);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    let timer: ReturnType<typeof setTimeout>;
    const read = (n: string) => (form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? "";
    const run = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const name = read("full_name");
        const phoneValue = read("phone") || read("whatsapp");
        if (name.trim().length < 5 && !read("document") && !phoneValue && !read("email")) return setHits([]);
        setHits(await checkDuplicates({ name, document: read("document"), phone: phoneValue, email: read("email"), ignore: ignoreId }));
      }, 500);
    };
    form.addEventListener("input", run);
    return () => {
      clearTimeout(timer);
      form.removeEventListener("input", run);
    };
  }, [ignoreId]);

  return (
    <div ref={ref} aria-live="polite">
      {hits.length ? (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3.5 text-sm animate-in">
          <p className="flex items-center gap-2 font-semibold text-amber-200">
            <AlertTriangle className="h-4 w-4" /> Possível cadastro duplicado
          </p>
          <ul className="mt-2 space-y-1.5">
            {hits.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 text-ink-300">
                <span>
                  <Link href={`/clientes/${h.id}`} target="_blank" className="font-medium text-ink-100 underline-offset-2 hover:underline">{h.full_name}</Link>
                  {" · "}{phone(h.phone ?? h.whatsapp)}{!h.active ? " · inativo" : ""}
                </span>
                <span className="text-xs text-amber-200/80">{h.reason}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-400">Confira antes de salvar. Se for a mesma pessoa, use o cadastro existente.</p>
        </div>
      ) : null}
    </div>
  );
}
