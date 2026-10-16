import Link from "next/link";
import type { Metadata } from "next";
import { Car, Plus, Search } from "lucide-react";
import { can, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button, buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, EmptyState, PageHeader, Pagination } from "@/components/ui/layout-bits";
import { Plate } from "@/components/domain/plate";
import { VEHICLE_TYPES } from "@/lib/constants";
import { km } from "@/lib/format";
import { safeTerm } from "@/lib/utils";
import type { VehicleType } from "@/lib/types";

export const metadata: Metadata = { title: "Veículos" };

const PER_PAGE = 25;
type SP = { q?: string; tipo?: string; status?: string; ordem?: string; p?: string };
type Row = {
  id: string; plate: string | null; brand: string; model: string; manufacture_year: number | null; model_year: number | null; color: string | null;
  vehicle_type: VehicleType; mileage_km: number | null; active: boolean; customers: { id: string; full_name: string } | null; service_orders: { count: number }[];
};

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { profile } = await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.p) || 1);
  const status = sp.status ?? "ativos";
  const supabase = await createClient();

  let q = supabase
    .from("vehicles")
    .select("id, plate, brand, model, manufacture_year, model_year, color, vehicle_type, mileage_km, active, customers(id, full_name), service_orders(count)", { count: "exact" });
  const term = safeTerm(sp.q);
  if (term) {
    const plate = term.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const { data: owners } = await supabase.from("customers").select("id").ilike("full_name", `%${term}%`).limit(200);
    const ors = [`model.ilike.%${term}%`, `brand.ilike.%${term}%`];
    if (plate.length >= 2) ors.push(`plate.ilike.%${plate}%`);
    if (owners?.length) ors.push(`customer_id.in.(${owners.map((o) => o.id).join(",")})`);
    q = q.or(ors.join(","));
  }
  if (status === "ativos") q = q.eq("active", true);
  if (status === "inativos") q = q.eq("active", false);
  if (sp.tipo && sp.tipo in VEHICLE_TYPES) q = q.eq("vehicle_type", sp.tipo);
  const order = sp.ordem ?? "recentes";
  q = order === "placa" ? q.order("plate") : order === "modelo" ? q.order("brand").order("model") : q.order("created_at", { ascending: false });
  const { data, count } = await q.range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  const rows = (data ?? []) as unknown as Row[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PER_PAGE));

  return (
    <>
      <PageHeader title="Veículos" description="Pesquise por placa, marca, modelo ou nome do proprietário."
        actions={can(profile, "customers") ? <Link href="/veiculos/novo" className={buttonClass("primary")}><Plus /> Novo veículo</Link> : null} />
      <Card>
        <form className="grid gap-3 border-b border-ink-800 p-4 sm:grid-cols-[1fr_150px_150px_150px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            <Input name="q" defaultValue={sp.q} placeholder="Placa, modelo, marca ou proprietário" className="pl-9" aria-label="Pesquisar veículos" />
          </div>
          <Select name="tipo" defaultValue={sp.tipo ?? ""} aria-label="Tipo">
            <option value="">Todos os tipos</option>
            {Object.entries(VEHICLE_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
          <Select name="status" defaultValue={status} aria-label="Situação">
            <option value="ativos">Ativos</option><option value="inativos">Inativos</option><option value="todos">Todos</option>
          </Select>
          <Select name="ordem" defaultValue={order} aria-label="Ordenar">
            <option value="recentes">Mais recentes</option><option value="placa">Placa</option><option value="modelo">Marca/modelo</option>
          </Select>
          <Button type="submit" variant="secondary">Filtrar</Button>
        </form>
        {rows.length === 0 ? (
          <EmptyState icon={Car} title="Nenhum veículo encontrado" />
        ) : (
          <DataTable head={["Placa", "Veículo", "Proprietário", "Tipo", "Km", "Atendimentos", ""]} align={["left", "left", "left", "left", "right", "center", "right"]}>
            {rows.map((v) => (
              <tr key={v.id}>
                <td><Link href={`/veiculos/${v.id}`}><Plate value={v.plate} size="sm" /></Link></td>
                <td>
                  <Link href={`/veiculos/${v.id}`} className="font-medium hover:text-gold-300">{v.brand} {v.model}</Link>
                  <span className="block text-xs text-ink-500">{[v.manufacture_year && v.model_year ? `${v.manufacture_year}/${v.model_year}` : v.model_year ?? v.manufacture_year, v.color].filter(Boolean).join(" · ")}</span>
                </td>
                <td>{v.customers ? <Link href={`/clientes/${v.customers.id}`} className="text-ink-300 hover:text-gold-300">{v.customers.full_name}</Link> : "—"}</td>
                <td className="text-ink-300">{VEHICLE_TYPES[v.vehicle_type]}</td>
                <td className="text-right tabular-nums text-ink-300">{km(v.mileage_km)}</td>
                <td className="text-center tabular-nums">{v.service_orders?.[0]?.count ?? 0}</td>
                <td className="text-right">{!v.active ? <Badge>Inativo</Badge> : null}</td>
              </tr>
            ))}
          </DataTable>
        )}
        <Pagination page={page} pages={pages} total={count ?? 0} href={(p) => `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v)), p: String(p) })}`} />
      </Card>
    </>
  );
}
