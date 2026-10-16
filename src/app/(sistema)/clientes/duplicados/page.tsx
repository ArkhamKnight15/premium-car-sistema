import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, EmptyState, PageHeader } from "@/components/ui/layout-bits";
import { phone } from "@/lib/format";

export const metadata: Metadata = { title: "Possíveis duplicados" };

type Pair = { a_id: string; a_name: string; a_contact: string | null; b_id: string; b_name: string; b_contact: string | null; reason: string };
const contact = (v: string | null) => (v && /^\d+$/.test(v) ? phone(v) : v ?? "—");

export default async function DuplicatesPage() {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.rpc("possible_duplicate_customers");
  const pairs = (data ?? []) as Pair[];
  return (
    <>
      <PageHeader title="Possíveis cadastros duplicados" back={{ href: "/clientes", label: "Clientes" }}
        description="Clientes com o mesmo telefone, e-mail ou nome. Revise e desative o cadastro que não deve ser usado — o histórico é mantido." />
      <Card>
        {pairs.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Nenhum possível duplicado" description="Os cadastros não têm telefone, e-mail ou nome repetidos." />
        ) : (
          <DataTable head={["Cadastro A", "Cadastro B", "Coincidência"]} minWidth={640}>
            {pairs.map((p) => (
              <tr key={`${p.a_id}-${p.b_id}`}>
                <td><Link href={`/clientes/${p.a_id}`} className="font-medium hover:text-gold-300">{p.a_name}</Link><span className="block text-xs text-ink-500">{contact(p.a_contact)}</span></td>
                <td><Link href={`/clientes/${p.b_id}`} className="font-medium hover:text-gold-300">{p.b_name}</Link><span className="block text-xs text-ink-500">{contact(p.b_contact)}</span></td>
                <td><Badge tone="amber">{p.reason}</Badge></td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </>
  );
}
