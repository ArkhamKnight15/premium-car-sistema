import Link from "next/link";
import { Search, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/input";
import { Button, buttonClass } from "@/components/ui/button";
import { phone } from "@/lib/format";
import { digits, safeTerm } from "@/lib/utils";

/** Busca de cliente por URL (?q=) com link de seleção (?cliente=). Usado na entrada, agenda e cadastro de veículo. */
export async function CustomerPicker({ basePath, q, canCreate, keep = {} }: { basePath: string; q?: string; canCreate: boolean; keep?: Record<string, string> }) {
  const term = safeTerm(q);
  let results: { id: string; full_name: string; phone: string | null; whatsapp: string | null; email: string | null; vehicles: { plate: string | null; model: string }[] }[] = [];
  const supabase = await createClient();
  let query = supabase.from("customers").select("id, full_name, phone, whatsapp, email, vehicles(plate, model)").eq("active", true).limit(12);
  if (term.length >= 2) {
    const d = digits(term);
    const plate = term.toUpperCase().replace(/[^A-Z0-9]/g, "");
    let ids: string[] = [];
    if (plate.length >= 3) {
      const { data } = await supabase.from("vehicles").select("customer_id").ilike("plate", `%${plate}%`).limit(20);
      ids = (data ?? []).map((v) => v.customer_id);
    }
    const ors = [`full_name.ilike.%${term}%`, `email.ilike.%${term}%`];
    if (d.length >= 4) ors.push(`phone.ilike.%${d}%`, `whatsapp.ilike.%${d}%`, `document.ilike.${d}%`);
    if (ids.length) ors.push(`id.in.(${ids.join(",")})`);
    query = query.or(ors.join(",")).order("full_name");
  } else {
    query = query.order("created_at", { ascending: false }).limit(6);
  }
  const { data } = await query;
  results = (data ?? []) as typeof results;
  const params = (extra: Record<string, string>) => `?${new URLSearchParams({ ...keep, ...extra })}`;

  return (
    <div>
      <form action={basePath} className="flex gap-2">
        {Object.entries(keep).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <Input name="q" defaultValue={q} placeholder="Nome, telefone, CPF ou placa" className="pl-9" aria-label="Buscar cliente" autoFocus />
        </div>
        <Button type="submit" variant="secondary">Buscar</Button>
      </form>
      <p className="mt-3 text-xs text-ink-500">{term.length >= 2 ? `${results.length} resultado(s)` : "Clientes cadastrados recentemente"}</p>
      <ul className="mt-2 divide-y divide-ink-800 overflow-hidden rounded-lg border border-ink-800">
        {results.map((c) => (
          <li key={c.id}>
            <Link href={`${basePath}${params({ cliente: c.id })}`} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-ink-850">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink-100">{c.full_name}</span>
                <span className="block truncate text-xs text-ink-400">
                  {phone(c.whatsapp ?? c.phone)}{c.vehicles.length ? ` · ${c.vehicles.map((v) => v.plate ?? v.model).slice(0, 3).join(", ")}` : ""}
                </span>
              </span>
              <span className="text-xs font-semibold text-brand-300">Selecionar →</span>
            </Link>
          </li>
        ))}
        {results.length === 0 ? <li className="px-4 py-6 text-center text-sm text-ink-400">Nenhum cliente encontrado.</li> : null}
      </ul>
      {canCreate ? (
        <Link href={`/clientes/novo?voltar=${encodeURIComponent(basePath + params({}))}`} className={buttonClass("outline", "md", "mt-4")}>
          <UserPlus /> Cadastrar novo cliente
        </Link>
      ) : null}
    </div>
  );
}
