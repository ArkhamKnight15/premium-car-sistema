import Link from "next/link";
import type { Metadata } from "next";
import { Car, ClipboardList, Search, User } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { globalSearch } from "@/actions/search";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/layout-bits";

export const metadata: Metadata = { title: "Pesquisa" };

const ICON = { order: ClipboardList, vehicle: Car, customer: User };
const LABEL = { order: "Ordem de serviço", vehicle: "Veículo", customer: "Cliente" };
const HREF = { order: "/ordens/", vehicle: "/veiculos/", customer: "/clientes/" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const { q = "" } = await searchParams;
  const hits = q.trim().length >= 2 ? await globalSearch(q) : [];
  return (
    <>
      <PageHeader title="Pesquisa" description="Clientes, placas e números de OS." />
      <form className="mb-5 flex max-w-xl gap-2">
        <Input name="q" defaultValue={q} placeholder="Ex.: Carlos, BRA2E19, 1042" autoFocus aria-label="Pesquisar" />
        <Button type="submit"><Search /> Pesquisar</Button>
      </form>
      <Card>
        {hits.length === 0 ? (
          <EmptyState icon={Search} title={q ? `Nada encontrado para “${q}”` : "Digite ao menos 2 caracteres"} />
        ) : (
          <ul className="divide-y divide-ink-800">
            {hits.map((h) => {
              const Icon = ICON[h.kind];
              return (
                <li key={`${h.kind}-${h.id}`}>
                  <Link href={`${HREF[h.kind]}${h.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-ink-850/60">
                    <Icon className="h-4 w-4 text-gold-400" />
                    <span className="min-w-0"><span className="block truncate text-sm font-medium">{h.title}</span><span className="block truncate text-xs text-ink-400">{LABEL[h.kind]}{h.subtitle ? ` · ${h.subtitle}` : ""}</span></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
