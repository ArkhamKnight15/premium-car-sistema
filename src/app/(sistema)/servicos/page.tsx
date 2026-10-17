import type { Metadata } from "next";
import { Ban, CheckCircle2, Pencil, Plus, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getServices } from "@/lib/data";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import { Alert, EmptyState, PageHeader } from "@/components/ui/layout-bits";
import { ActionForm, Field } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { minutes, money, moneyInput } from "@/lib/format";
import type { Service } from "@/lib/types";
import { saveService, setServiceActive } from "@/actions/services";

export const metadata: Metadata = { title: "Serviços e Preços" };

function ServiceForm({ s, categories }: { s?: Service; categories: string[] }) {
  return (
    <ActionForm action={saveService} className="grid gap-4 sm:grid-cols-6">
      {s ? <input type="hidden" name="id" value={s.id} /> : null}
      <Field name="name" label="Nome" required className="sm:col-span-3"><Input id="name" name="name" defaultValue={s?.name} required /></Field>
      <Field name="category" label="Categoria" required className="sm:col-span-3">
        <Input id="category" name="category" defaultValue={s?.category} list="categorias" required />
      </Field>
      <datalist id="categorias">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      <Field name="description" label="Descrição" className="sm:col-span-6"><Textarea id="description" name="description" rows={2} defaultValue={s?.description ?? ""} /></Field>
      <Field name="default_price" label="Preço padrão (R$)" required className="sm:col-span-2"><Input id="default_price" name="default_price" inputMode="decimal" defaultValue={s ? moneyInput(s.default_price) : ""} required /></Field>
      <Field name="estimated_minutes" label="Duração estimada (min)" required className="sm:col-span-2"><Input id="estimated_minutes" name="estimated_minutes" type="number" min={5} step={5} defaultValue={s?.estimated_minutes ?? 60} required /></Field>
      <Field name="sort_order" label="Ordem" className="sm:col-span-1"><Input id="sort_order" name="sort_order" type="number" min={0} defaultValue={s?.sort_order ?? 0} /></Field>
      <div className="flex items-end pb-2 sm:col-span-1"><Checkbox name="active" defaultChecked={s ? s.active : true} label="Disponível" /></div>
      <div className="sm:col-span-6"><SubmitButton size="sm">{s ? "Salvar alterações" : "Cadastrar serviço"}</SubmitButton></div>
    </ActionForm>
  );
}

export default async function ServicesPage() {
  const { isAdmin } = await requireUser();
  const services = await getServices(true);
  const supabase = await createClient();
  const { data: usage } = await supabase.from("service_order_items").select("service_id").not("service_id", "is", null).limit(5000);
  const uses = new Map<string, number>();
  for (const u of usage ?? []) uses.set(u.service_id as string, (uses.get(u.service_id as string) ?? 0) + 1);
  const categories = Array.from(new Set(services.map((s) => s.category)));
  const toReview = services.filter((s) => s.active && !s.price_reviewed).length;

  return (
    <>
      <PageHeader title="Serviços e Preços" description={isAdmin ? "Catálogo usado nas OS e na agenda. Preços são referência e podem ser ajustados por OS (com permissão)." : "Catálogo de serviços. Somente administradores alteram preços."} />
      {isAdmin && toReview > 0 ? (
        <Alert tone="warn" icon={Sparkles} className="mb-5">{toReview} serviço(s) com preço de exemplo, marcados como “a revisar”. Ao salvar o serviço, o preço é confirmado.</Alert>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <Card>
          <CardHeader title={`${services.length} serviço(s)`} />
          {services.length === 0 ? <EmptyState icon={Sparkles} title="Nenhum serviço cadastrado" /> : (
            <ul className="divide-y divide-ink-800">
              {services.map((s) => (
                <li key={s.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {s.name}
                        <span className="text-[11px] font-normal text-ink-500">{s.category}</span>
                        {!s.active ? <Badge>Indisponível</Badge> : null}
                        {!s.price_reviewed ? <Badge tone="amber">Preço a revisar</Badge> : null}
                      </p>
                      {s.description ? <p className="mt-0.5 text-sm text-ink-400">{s.description}</p> : null}
                      <p className="mt-1 text-xs text-ink-500">{minutes(s.estimated_minutes)} · usado em {uses.get(s.id) ?? 0} OS</p>
                    </div>
                    <p className="text-base font-semibold tabular-nums text-brand-300">{money(s.default_price)}</p>
                  </div>
                  {isAdmin ? (
                    <div className="mt-3 flex flex-wrap items-start gap-2">
                      <details className="group w-full">
                        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-brand-300"><Pencil className="h-3.5 w-3.5" /> Editar</summary>
                        <div className="mt-3 rounded-lg border border-ink-800 bg-ink-925 p-4"><ServiceForm s={s} categories={categories} /></div>
                      </details>
                      {s.active ? (
                        <ConfirmAction action={setServiceActive} fields={{ id: s.id, active: "false" }} label="Indisponibilizar" icon={<Ban />} variant="ghost" size="xs"
                          question="Tornar indisponível? Ele deixa de aparecer em novas OS e agendamentos; o histórico é mantido." confirmLabel="Indisponibilizar" />
                      ) : (
                        <ConfirmAction action={setServiceActive} fields={{ id: s.id, active: "true" }} label="Disponibilizar" icon={<CheckCircle2 />} variant="ghost" size="xs" question="Tornar disponível novamente?" confirmLabel="Confirmar" />
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
        {isAdmin ? (
          <Card className="h-fit">
            <CardHeader title={<span className="flex items-center gap-2"><Plus className="h-4 w-4 text-brand-400" /> Novo serviço</span>} />
            <CardBody><ServiceForm categories={categories} /></CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}
