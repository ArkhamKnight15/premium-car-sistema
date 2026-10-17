import Link from "next/link";
import type { Metadata } from "next";
import { Copy, Search, Upload, UserPlus, Users } from "lucide-react";
import { can, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button, buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, EmptyState, PageHeader, Pagination } from "@/components/ui/layout-bits";
import { date, doc, phone } from "@/lib/format";
import { digits, safeTerm } from "@/lib/utils";

export const metadata: Metadata = { title: "Clientes" };

const PER_PAGE = 25;
type SP = { q?: string; status?: string; tipo?: string; ordem?: string; p?: string };
type Row = {
  id: string; full_name: string; person_type: "PF" | "PJ"; document: string | null; phone: string | null; whatsapp: string | null; email: string | null;
  active: boolean; anonymized_at: string | null; created_at: string; vehicles: { count: number }[]; service_orders: { count: number }[];
};

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { profile } = await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.p) || 1);
  const status = sp.status ?? "ativos";
  const supabase = await createClient();

  let q = supabase
    .from("customers")
    .select("id, full_name, person_type, document, phone, whatsapp, email, active, anonymized_at, created_at, vehicles(count), service_orders(count)", { count: "exact" });
  const term = safeTerm(sp.q);
  if (term) {
    const d = digits(term);
    const ors = [`full_name.ilike.%${term}%`, `email.ilike.%${term}%`];
    if (d.length >= 3) ors.push(`phone.ilike.%${d}%`, `whatsapp.ilike.%${d}%`, `document.ilike.${d}%`);
    q = q.or(ors.join(","));
  }
  if (status === "ativos") q = q.eq("active", true);
  if (status === "inativos") q = q.eq("active", false);
  if (sp.tipo === "PF" || sp.tipo === "PJ") q = q.eq("person_type", sp.tipo);
  const order = sp.ordem ?? "nome";
  q = order === "recentes" ? q.order("created_at", { ascending: false }) : order === "antigos" ? q.order("created_at") : q.order("full_name");
  const { data, count } = await q.range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  const rows = (data ?? []) as unknown as Row[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PER_PAGE));
  const qs = (p: number) => `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v)), p: String(p) })}`;

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Cadastro, histórico de atendimentos e veículos de cada cliente."
        actions={
          <>
            <Link href="/clientes/duplicados" className={buttonClass("ghost")}><Copy /> Possíveis duplicados</Link>
            {can(profile, "customers") ? <Link href="/clientes/importar" className={buttonClass("secondary")}><Upload /> Importar contatos</Link> : null}
            {can(profile, "customers") ? <Link href="/clientes/novo" className={buttonClass("primary")}><UserPlus /> Novo cliente</Link> : null}
          </>
        }
      />
      <Card>
        <form className="grid gap-3 border-b border-ink-800 p-4 sm:grid-cols-[1fr_150px_150px_160px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            <Input name="q" defaultValue={sp.q} placeholder="Nome, telefone, CPF/CNPJ ou e-mail" className="pl-9" aria-label="Pesquisar clientes" />
          </div>
          <Select name="status" defaultValue={status} aria-label="Situação">
            <option value="ativos">Ativos</option><option value="inativos">Inativos</option><option value="todos">Todos</option>
          </Select>
          <Select name="tipo" defaultValue={sp.tipo ?? ""} aria-label="Tipo">
            <option value="">PF e PJ</option><option value="PF">Pessoa física</option><option value="PJ">Pessoa jurídica</option>
          </Select>
          <Select name="ordem" defaultValue={order} aria-label="Ordenar">
            <option value="nome">Nome (A–Z)</option><option value="recentes">Mais recentes</option><option value="antigos">Mais antigos</option>
          </Select>
          <Button type="submit" variant="secondary">Filtrar</Button>
        </form>
        {rows.length === 0 ? (
          <EmptyState icon={Users} title={term ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
            description={term ? "Confira a grafia ou pesquise por telefone ou CPF." : "Cadastre o primeiro cliente ou traga de uma vez os contatos da agenda do WhatsApp."}
            action={can(profile, "customers") ? (
              <div className="flex flex-wrap justify-center gap-2">
                {!term ? <Link href="/clientes/importar" className={buttonClass("outline", "sm")}><Upload /> Importar contatos</Link> : null}
                <Link href="/clientes/novo" className={buttonClass(term ? "outline" : "ghost", "sm")}>Cadastrar cliente</Link>
              </div>
            ) : null} />
        ) : (
          <DataTable head={["Cliente", "CPF/CNPJ", "Contato", "Veículos", "Atendimentos", "Cadastro", ""]} align={["left", "left", "left", "center", "center", "left", "right"]}>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/clientes/${c.id}`} className="font-medium text-ink-100 hover:text-gold-300">{c.full_name}</Link>
                  <span className="ml-2 text-[10px] font-semibold text-ink-500">{c.person_type}</span>
                </td>
                <td className="tabular-nums text-ink-300">{doc(c.document)}</td>
                <td className="text-ink-300">{phone(c.whatsapp ?? c.phone)}<span className="block max-w-[220px] truncate text-xs text-ink-500">{c.email ?? ""}</span></td>
                <td className="text-center tabular-nums">{c.vehicles?.[0]?.count ?? 0}</td>
                <td className="text-center tabular-nums">{c.service_orders?.[0]?.count ?? 0}</td>
                <td className="text-ink-400">{date(c.created_at)}</td>
                <td className="text-right">{c.anonymized_at ? <Badge tone="red">Anonimizado</Badge> : !c.active ? <Badge>Inativo</Badge> : null}</td>
              </tr>
            ))}
          </DataTable>
        )}
        <Pagination page={page} pages={pages} total={count ?? 0} href={qs} />
      </Card>
    </>
  );
}
