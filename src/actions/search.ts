"use server";

import { createClient } from "@/lib/supabase/server";

export type SearchHit = { kind: "order" | "vehicle" | "customer"; id: string; title: string; subtitle: string | null };

/** Pesquisa global (clientes, placas e OS). Respeita o RLS do usuário. */
export async function globalSearch(q: string): Promise<SearchHit[]> {
  const term = (q ?? "").trim().slice(0, 60);
  if (term.length < 2) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("global_search", { p_q: term });
  if (error) return [];
  return (data ?? []) as SearchHit[];
}
