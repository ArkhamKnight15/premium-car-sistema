import type { Metadata } from "next";
import { History } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPaymentMethods, getSettings } from "@/lib/data";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import { DataTable, EmptyState, PageHeader, Tabs } from "@/components/ui/layout-bits";
import { ActionForm, Field } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { WEEKDAYS } from "@/lib/constants";
import { dateTime, doc, phone } from "@/lib/format";
import type { BusinessHour } from "@/lib/types";
import { saveCompany, saveHours, savePaymentMethod } from "@/actions/settings";

export const metadata: Metadata = { title: "Configurações" };

const ENTITY: Record<string, string> = {
  profiles: "Usuário", employees: "Funcionário", customers: "Cliente", vehicles: "Veículo", services: "Serviço", payment_methods: "Forma de pagamento",
  company_settings: "Empresa", business_hours: "Horário", appointments: "Agenda",
};
const ACTION: Record<string, string> = { insert: "criou", update: "alterou", delete: "removeu" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  await requireAdmin();
  const { aba } = await searchParams;
  const tab = ["empresa", "horarios", "pagamentos", "auditoria"].includes(aba ?? "") ? aba! : "empresa";
  return (
    <>
      <PageHeader title="Configurações" description="Dados da empresa, agenda, formas de pagamento e auditoria." />
      <Tabs active={tab} tabs={[
        { id: "empresa", label: "Empresa", href: "/configuracoes" },
        { id: "horarios", label: "Horário de funcionamento", href: "/configuracoes?aba=horarios" },
        { id: "pagamentos", label: "Formas de pagamento", href: "/configuracoes?aba=pagamentos" },
        { id: "auditoria", label: "Registro de alterações", href: "/configuracoes?aba=auditoria" },
      ]} />
      {tab === "empresa" ? <Company /> : null}
      {tab === "horarios" ? <Hours /> : null}
      {tab === "pagamentos" ? <Methods /> : null}
      {tab === "auditoria" ? <Audit /> : null}
    </>
  );
}

async function Company() {
  const s = await getSettings();
  return (
    <ActionForm action={saveCompany} className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Dados da empresa" description="Aparecem na impressão da OS." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field name="company_name" label="Nome fantasia" required><Input id="company_name" name="company_name" defaultValue={s?.company_name} /></Field>
          <Field name="legal_name" label="Razão social"><Input id="legal_name" name="legal_name" defaultValue={s?.legal_name ?? ""} /></Field>
          <Field name="cnpj" label="CNPJ"><Input id="cnpj" name="cnpj" defaultValue={s?.cnpj ? doc(s.cnpj) : ""} /></Field>
          <Field name="email" label="E-mail"><Input id="email" name="email" type="email" defaultValue={s?.email ?? ""} /></Field>
          <Field name="phone" label="Telefone"><Input id="phone" name="phone" defaultValue={s?.phone ? phone(s.phone) : ""} /></Field>
          <Field name="whatsapp" label="WhatsApp"><Input id="whatsapp" name="whatsapp" defaultValue={s?.whatsapp ? phone(s.whatsapp) : ""} /></Field>
          <Field name="address" label="Endereço" className="sm:col-span-2"><Input id="address" name="address" defaultValue={s?.address ?? ""} /></Field>
          <Field name="city" label="Cidade/UF"><Input id="city" name="city" defaultValue={s?.city ?? ""} /></Field>
        </CardBody>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Agenda" description="Usado para evitar conflitos de horário." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field name="bays" label="Veículos atendidos ao mesmo tempo" hint="Quantidade de boxes/vagas de trabalho."><Input id="bays" name="bays" type="number" min={1} max={100} defaultValue={s?.bays ?? 3} /></Field>
            <Field name="slot_minutes" label="Intervalo da agenda (min)"><Input id="slot_minutes" name="slot_minutes" type="number" min={5} max={240} step={5} defaultValue={s?.slot_minutes ?? 30} /></Field>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Termos impressos na OS" />
          <CardBody>
            <Field name="order_terms" label="Texto" hint="Ex.: condições de garantia, prazo para retirada, responsabilidade sobre objetos no veículo.">
              <Textarea id="order_terms" name="order_terms" rows={5} defaultValue={s?.order_terms ?? ""} />
            </Field>
          </CardBody>
        </Card>
        <SubmitButton>Salvar configurações</SubmitButton>
      </div>
    </ActionForm>
  );
}

async function Hours() {
  const supabase = await createClient();
  const { data } = await supabase.from("business_hours").select("*").order("weekday");
  const hours = (data ?? []) as BusinessHour[];
  return (
    <Card className="max-w-2xl">
      <CardHeader title="Horário de funcionamento" description="Compromissos fora desse horário são recusados pela agenda." />
      <CardBody>
        <ActionForm action={saveHours} className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const h = hours.find((x) => x.weekday === d);
            return (
              <div key={d} className="grid grid-cols-[100px_90px_1fr_1fr] items-center gap-3">
                <span className="text-sm font-medium">{WEEKDAYS[d]}</span>
                <Checkbox name={`open_${d}`} defaultChecked={h?.is_open} label="Aberto" />
                <Input type="time" name={`from_${d}`} defaultValue={h?.open_time.slice(0, 5) ?? "08:00"} aria-label={`Abertura ${WEEKDAYS[d]}`} className="h-9" />
                <Input type="time" name={`to_${d}`} defaultValue={h?.close_time.slice(0, 5) ?? "18:00"} aria-label={`Fechamento ${WEEKDAYS[d]}`} className="h-9" />
              </div>
            );
          })}
          <SubmitButton size="sm">Salvar horários</SubmitButton>
        </ActionForm>
      </CardBody>
    </Card>
  );
}

async function Methods() {
  const methods = await getPaymentMethods(true);
  return (
    <Card className="max-w-2xl">
      <CardHeader title="Formas de pagamento" description="Pagamentos são registrados manualmente após a confirmação do recebimento. Não há integração bancária." />
      <CardBody className="space-y-3">
        {methods.map((m) => (
          <ActionForm key={m.id} action={savePaymentMethod} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={m.id} />
            <Input name="name" defaultValue={m.name} className="h-9 max-w-xs" aria-label="Nome" />
            <Checkbox name="active" defaultChecked={m.active} label="Ativa" />
            <SubmitButton size="sm" variant="ghost">Salvar</SubmitButton>
          </ActionForm>
        ))}
        <ActionForm action={savePaymentMethod} reset className="flex flex-wrap items-center gap-3 border-t border-ink-800 pt-4">
          <Input name="name" placeholder="Nova forma (ex.: Boleto)" className="h-9 max-w-xs" aria-label="Nova forma de pagamento" />
          <SubmitButton size="sm" variant="secondary">Adicionar</SubmitButton>
        </ActionForm>
      </CardBody>
    </Card>
  );
}

async function Audit() {
  const supabase = await createClient();
  const [{ data }, { data: users }] = await Promise.all([
    supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(150),
    supabase.from("profiles").select("id, full_name"),
  ]);
  const name = new Map((users ?? []).map((u) => [u.id, u.full_name as string]));
  const rows = (data ?? []) as { id: number; actor_id: string | null; action: string; entity: string; entity_id: string | null; details: Record<string, { de: unknown; para: unknown }> | null; created_at: string }[];
  const summarize = (r: (typeof rows)[number]) =>
    r.action === "update" && r.details ? Object.keys(r.details).filter((k) => !["created_at"].includes(k)).slice(0, 6).join(", ") : r.details && "full_name" in r.details ? String((r.details as unknown as { full_name: string }).full_name) : r.details && "name" in r.details ? String((r.details as unknown as { name: string }).name) : "";
  return (
    <Card>
      <CardHeader title="Registro de alterações (últimas 150)" description="Cadastros, preços, permissões e configurações. Alterações das OS ficam na linha do tempo de cada OS." />
      {rows.length === 0 ? <EmptyState icon={History} title="Nenhum registro" /> : (
        <DataTable head={["Quando", "Usuário", "Ação", "Registro", "Campos / detalhe"]} minWidth={820}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap text-ink-300">{dateTime(r.created_at)}</td>
              <td>{r.actor_id ? name.get(r.actor_id) ?? "—" : <span className="text-ink-500">Sistema</span>}</td>
              <td className="text-ink-300">{ACTION[r.action] ?? r.action}</td>
              <td>{ENTITY[r.entity] ?? r.entity}</td>
              <td className="max-w-[320px] truncate text-xs text-ink-400">{summarize(r)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </Card>
  );
}
