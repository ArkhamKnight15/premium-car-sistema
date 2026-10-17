"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Car, ClipboardList, Loader2, Search, User, X } from "lucide-react";
import { globalSearch, type SearchHit } from "@/actions/search";
import { cn } from "@/lib/utils";

const ICON = { order: ClipboardList, vehicle: Car, customer: User };
const LABEL = { order: "Ordem de serviço", vehicle: "Veículo", customer: "Cliente" };
export const hitHref = (h: SearchHit) => (h.kind === "order" ? `/ordens/${h.id}` : h.kind === "vehicle" ? `/veiculos/${h.id}` : `/clientes/${h.id}`);

export function GlobalSearch({ className, autoFocus, onNavigate }: { className?: string; autoFocus?: boolean; onNavigate?: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Atalho: "/" ou Ctrl+K focam a pesquisa
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName);
      if ((e.key === "/" && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const id = setTimeout(() => {
      start(async () => {
        const r = await globalSearch(q);
        setHits(r);
        setActive(0);
        setOpen(true);
      });
    }, 220);
    return () => clearTimeout(id);
  }, [q]);

  function go(h: SearchHit) {
    setOpen(false);
    setQ("");
    onNavigate?.();
    router.push(hitHref(h));
  }

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (hits[active]) go(hits[active]);
          else if (q.trim().length >= 2) {
            setOpen(false);
            onNavigate?.();
            router.push(`/busca?q=${encodeURIComponent(q.trim())}`);
          }
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden />
        <input
          ref={inputRef}
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits.length && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Buscar cliente, placa ou nº da OS"
          aria-label="Pesquisa global"
          className="h-10 w-full rounded-lg border border-ink-700 bg-ink-925 pl-9 pr-16 text-sm text-ink-100 placeholder:text-ink-500 focus:border-brand-500/60 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
        />
        <span className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-400" /> : null}
          {q ? (
            <button type="button" onClick={() => { setQ(""); setHits([]); }} aria-label="Limpar" className="text-ink-500 hover:text-ink-100">
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="hidden rounded border border-ink-700 px-1.5 text-[10px] text-ink-500 sm:inline">/</kbd>
          )}
        </span>
      </form>
      {open && q.trim().length >= 2 ? (
        <div className="absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-2xl animate-in">
          {hits.length === 0 && !pending ? (
            <p className="px-4 py-3 text-sm text-ink-400">Nada encontrado para “{q}”.</p>
          ) : (
            <ul role="listbox" className="max-h-80 overflow-y-auto py-1">
              {hits.map((h, i) => {
                const Icon = ICON[h.kind];
                return (
                  <li key={`${h.kind}-${h.id}`} role="option" aria-selected={i === active}>
                    <button type="button" onMouseEnter={() => setActive(i)} onClick={() => go(h)}
                      className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left", i === active ? "bg-ink-800" : "")}>
                      <Icon className="h-4 w-4 shrink-0 text-brand-400" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink-100">{h.title}</span>
                        <span className="block truncate text-xs text-ink-400">{LABEL[h.kind]}{h.subtitle ? ` · ${h.subtitle}` : ""}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
