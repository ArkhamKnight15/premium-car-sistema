"use client";
import { useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, FileText, Loader2, Search, Upload, UserPlus, Users } from "lucide-react";
import { findExistingContacts, importCustomers, type ExistingContact } from "@/actions/customer-import";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button, buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, DataTable, EmptyState } from "@/components/ui/layout-bits";
import {
  MAX_FILE_BYTES, buildRows, nameIsValid, normalizeBrPhone, parseContactsFile, readContactsFile, type ContactRow,
} from "@/lib/contacts";
import { phone } from "@/lib/format";
import { cn, digits } from "@/lib/utils";

type Phase = "pick" | "reading" | "review" | "importing" | "done";
type Filter = "new" | "existing" | "skipped" | "all";
type Summary = { created: number; skipped: number; error?: string; remaining: number };

const BATCH = 100;
const PAGE = 100;

const STEPS = ["Arquivo", "Revisão", "Concluído"] as const;
const stepOf = (p: Phase) => (p === "pick" || p === "reading" ? 0 : p === "done" ? 2 : 1);

/** Marca os contatos que já são clientes (por WhatsApp, telefone ou e-mail). */
function markExisting(rows: ContactRow[], existing: ExistingContact[]): ContactRow[] {
  const index = new Map<string, ExistingContact>();
  for (const c of existing) {
    for (const n of [c.whatsapp, c.phone]) {
      const key = n ? normalizeBrPhone(n) : null;
      if (key && !index.has(key)) index.set(key, c);
    }
    if (c.email && !index.has(c.email.toLowerCase())) index.set(c.email.toLowerCase(), c);
  }
  return rows.map((r) => {
    if (r.status !== "new") return r;
    const hit = [r.whatsapp, r.phone, r.email].map((k) => (k ? index.get(k) : undefined)).find(Boolean);
    return hit ? { ...r, status: "existing", existing: { id: hit.id, full_name: hit.full_name, active: hit.active } } : r;
  });
}

export function ContactImporter({ defaultDdd, guide }: { defaultDdd: string; guide: ReactNode }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [readingStep, setReadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [ddd, setDdd] = useState(defaultDdd);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("new");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<Summary | null>(null);

  const pending = useMemo(() => rows.filter((r) => r.status === "new" && !imported.has(r.key)), [rows, imported]);
  const counts = useMemo(() => ({
    total: rows.length,
    new: pending.length,
    existing: rows.filter((r) => r.status === "existing").length,
    skipped: rows.filter((r) => r.status === "invalid" || r.status === "repeated").length,
  }), [rows, pending]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const d = digits(q);
    return rows.filter((r) => {
      if (imported.has(r.key)) return false;
      if (filter === "new" && r.status !== "new") return false;
      if (filter === "existing" && r.status !== "existing") return false;
      if (filter === "skipped" && r.status !== "invalid" && r.status !== "repeated") return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || (r.email ?? "").includes(q) || (d.length >= 3 && `${r.whatsapp ?? ""} ${r.phone ?? ""}`.includes(d));
    });
  }, [rows, imported, filter, query]);

  const selectable = filtered.filter((r) => r.status === "new" && nameIsValid(r.name));
  const allVisibleSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.key));
  const chosen = pending.filter((r) => selected.has(r.key) && nameIsValid(r.name));

  function reset() {
    setPhase("pick");
    setRows([]);
    setSelected(new Set());
    setImported(new Set());
    setSummary(null);
    setConfirming(false);
    setError(null);
    setQuery("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!/\.(vcf|vcard|csv|txt)$/i.test(file.name)) return setError("Use um arquivo .vcf (vCard) ou .csv exportado da agenda.");
    if (file.size > MAX_FILE_BYTES) return setError("O arquivo passa de 10 MB. Exporte só os contatos dos clientes ou divida o arquivo.");
    setFileName(file.name);
    setPhase("reading");
    try {
      setReadingStep("Lendo os contatos do arquivo…");
      const built = buildRows(parseContactsFile(file.name, await readContactsFile(file)), ddd);
      if (!built.length) {
        setPhase("pick");
        return setError("Nenhum contato encontrado. Confira se o arquivo é a exportação da agenda (vCard ou CSV).");
      }
      setReadingStep("Comparando com os clientes já cadastrados…");
      const valid = built.filter((r) => r.status !== "invalid");
      const existing = await findExistingContacts({
        numbers: valid.flatMap((r) => [r.whatsapp, r.phone]).filter((n): n is string => n !== null),
        emails: valid.map((r) => r.email).filter((e): e is string => e !== null),
      });
      const final = markExisting(built, existing);
      setRows(final);
      setImported(new Set());
      setSelected(new Set(final.filter((r) => r.status === "new" && nameIsValid(r.name)).map((r) => r.key)));
      setFilter(final.some((r) => r.status === "new") ? "new" : "all");
      setLimit(PAGE);
      setPhase("review");
    } catch {
      setPhase("pick");
      setError("Não foi possível ler o arquivo ou consultar os clientes. Verifique a conexão e tente de novo.");
    }
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    void handleFile(e.dataTransfer.files?.[0]);
  }

  function toggle(key: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleVisible(on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of selectable) {
        if (on) next.add(r.key);
        else next.delete(r.key);
      }
      return next;
    });
  }

  function rename(key: string, name: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, name } : r)));
    // Quem estava sem nome entra na seleção assim que o nome fica válido
    if (nameIsValid(name) && !nameIsValid(rows.find((r) => r.key === key)?.name ?? "")) toggle(key, true);
  }

  async function runImport() {
    const queue = chosen;
    setConfirming(false);
    setPhase("importing");
    setProgress({ done: 0, total: queue.length });
    let created = 0;
    let skipped = 0;
    const done = new Set(imported);
    for (let i = 0; i < queue.length; i += BATCH) {
      const batch = queue.slice(i, i + BATCH);
      const res = await importCustomers(batch.map((r) => ({ full_name: r.name, whatsapp: r.whatsapp, phone: r.phone, email: r.email, org: r.org })))
        .catch(() => ({ ok: false as const, message: "Falha de conexão com o servidor.", data: undefined }));
      if (!res.ok || !res.data) {
        setImported(done);
        setSummary({ created, skipped, error: res.message ?? "Não foi possível concluir a importação.", remaining: queue.length - i });
        setPhase("done");
        router.refresh();
        return;
      }
      created += res.data.created;
      skipped += res.data.skipped;
      batch.forEach((r) => done.add(r.key));
      setProgress({ done: i + batch.length, total: queue.length });
    }
    setImported(done);
    setSummary({ created, skipped, remaining: 0 });
    setPhase("done");
    router.refresh();
  }

  const step = stepOf(phase);

  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium" aria-label="Etapas da importação">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-3" aria-current={i === step ? "step" : undefined}>
            <span className={cn("flex items-center gap-2", i === step ? "text-ink-100" : i < step ? "text-brand-300" : "text-ink-500")}>
              <span className={cn("flex h-6 w-6 items-center justify-center rounded-full border text-[11px] tabular-nums transition-colors",
                i === step ? "border-brand-500 bg-brand-500 text-ink-950" : i < step ? "border-brand-500/50 text-brand-300" : "border-ink-700")}>
                {i < step ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : i + 1}
              </span>
              {label}
            </span>
            {i < STEPS.length - 1 ? <span className="h-px w-6 bg-ink-700 sm:w-10" aria-hidden /> : null}
          </li>
        ))}
      </ol>

      {phase === "pick" || phase === "reading" ? (
        <Card>
          <CardBody className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
            <div className="space-y-4">
              <label
                htmlFor="contacts-file"
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn(
                  "flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
                  "has-[:focus-visible]:border-brand-500/70 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-400/40",
                  dragging ? "border-brand-500 bg-brand-500/5" : "border-ink-700 bg-ink-925 hover:border-ink-600 hover:bg-ink-850",
                  phase === "reading" && "pointer-events-none",
                )}
              >
                <input ref={inputRef} id="contacts-file" type="file" accept=".vcf,.vcard,.csv,.txt,text/vcard,text/x-vcard,text/csv"
                  className="sr-only" disabled={phase === "reading"} onChange={(e) => void handleFile(e.target.files?.[0])} />
                {phase === "reading" ? (
                  <span className="flex flex-col items-center gap-3 animate-in" role="status">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-400" aria-hidden />
                    <span className="text-sm font-medium text-ink-100">{readingStep}</span>
                    <span className="text-xs text-ink-500">{fileName}</span>
                  </span>
                ) : (
                  <>
                    <span className="flex h-12 w-12 items-center justify-center rounded-full border border-ink-700 bg-ink-850">
                      <Upload className="h-5 w-5 text-brand-400" aria-hidden />
                    </span>
                    <span className="mt-4 text-sm font-semibold text-ink-100">Arraste o arquivo de contatos aqui</span>
                    <span className="mt-1 text-sm text-ink-400">ou <span className="text-brand-300 underline-offset-2 hover:underline">clique para escolher</span></span>
                    <span className="mt-3 text-xs text-ink-500">vCard (.vcf) ou CSV · até 10 MB</span>
                  </>
                )}
              </label>
              {error ? <Alert tone="error" icon={AlertCircle} className="animate-in">{error}</Alert> : null}
              <div className="max-w-xs">
                <Label htmlFor="ddd">DDD padrão</Label>
                <Input id="ddd" inputMode="numeric" maxLength={2} value={ddd} onChange={(e) => setDdd(digits(e.target.value))}
                  placeholder="11" disabled={phase === "reading"} aria-describedby="ddd-hint" />
                <p id="ddd-hint" className="mt-1 text-xs text-ink-500">Completa os números salvos na agenda sem DDD.</p>
              </div>
              <p className="text-xs text-ink-500">Nada é cadastrado antes da sua confirmação. O arquivo é lido no próprio navegador.</p>
            </div>
            {guide}
          </CardBody>
        </Card>
      ) : null}

      {phase === "review" ? (
        <Card className="animate-in">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 px-5 py-3.5">
            <p className="flex min-w-0 items-center gap-2 text-sm text-ink-300">
              <FileText className="h-4 w-4 shrink-0 text-brand-400" aria-hidden />
              <span className="truncate font-medium text-ink-100">{fileName}</span>
            </p>
            <Button variant="ghost" size="sm" onClick={reset}>Trocar arquivo</Button>
          </div>

          <dl className="grid grid-cols-2 gap-px border-b border-ink-800 bg-ink-800 sm:grid-cols-4">
            {([
              ["No arquivo", counts.total, "text-ink-100"],
              ["Novos", counts.new, "text-emerald-300"],
              ["Já cadastrados", counts.existing, "text-ink-300"],
              ["Não importáveis", counts.skipped, "text-amber-300"],
            ] as const).map(([label, value, tone]) => (
              <div key={label} className="bg-ink-900 px-5 py-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</dt>
                <dd className={cn("mt-0.5 text-xl font-semibold tabular-nums", tone)}>{value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-col gap-3 border-b border-ink-800 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="thin-scroll -mx-1 flex gap-1 overflow-x-auto px-1" role="group" aria-label="Mostrar">
              {([
                ["new", "Novos", counts.new],
                ["existing", "Já cadastrados", counts.existing],
                ["skipped", "Não importáveis", counts.skipped],
                ["all", "Todos", counts.total - imported.size],
              ] as const).map(([id, label, count]) => (
                <button key={id} type="button" aria-pressed={filter === id} onClick={() => { setFilter(id); setLimit(PAGE); }}
                  className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70",
                    filter === id ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:bg-ink-850 hover:text-ink-100")}>
                  {label}
                  <span className="rounded-full bg-ink-950/60 px-1.5 text-[10px] tabular-nums text-ink-300">{count}</span>
                </button>
              ))}
            </div>
            <div className="relative lg:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden />
              <Input value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} placeholder="Buscar nome, número ou e-mail"
                className="pl-9" aria-label="Buscar contato" type="search" />
            </div>
          </div>

          {filter === "skipped" && counts.skipped ? (
            <p className="border-b border-ink-800 px-5 py-3 text-xs text-ink-400">
              Números estrangeiros, sem DDD ou contatos sem telefone não entram. Se a agenda tem números salvos sem DDD,
              ajuste o DDD padrão e envie o arquivo de novo.
            </p>
          ) : null}

          {filtered.length === 0 ? (
            <EmptyState icon={Users} title={query ? "Nenhum contato encontrado" : "Nenhum contato nesta lista"}
              description={query ? "Confira a grafia ou busque pelo número." : filter === "new" ? "Todos os contatos do arquivo já são clientes ou não têm um número válido." : undefined} />
          ) : (
            <DataTable minWidth={820} align={["left", "left", "left", "left", "left", "left"]} head={[
              <input key="all" type="checkbox" checked={allVisibleSelected} disabled={!selectable.length}
                onChange={(e) => toggleVisible(e.target.checked)} aria-label="Selecionar todos os contatos listados"
                className="h-4 w-4 accent-[var(--color-brand-500)] disabled:opacity-40" />,
              "Nome", "WhatsApp", "Telefone", "E-mail", "Situação",
            ]}>
              {filtered.slice(0, limit).map((r) => {
                const validName = nameIsValid(r.name);
                const isNew = r.status === "new";
                return (
                  <tr key={r.key} className={cn(isNew && !selected.has(r.key) && "opacity-60")}>
                    <td className="w-10">
                      {isNew ? (
                        <input type="checkbox" checked={selected.has(r.key) && validName} disabled={!validName}
                          onChange={(e) => toggle(r.key, e.target.checked)} aria-label={`Importar ${r.name || phone(r.whatsapp ?? r.phone)}`}
                          className="h-4 w-4 accent-[var(--color-brand-500)] disabled:opacity-40" />
                      ) : null}
                    </td>
                    <td className="min-w-56">
                      {isNew ? (
                        <>
                          <Input value={r.name} onChange={(e) => rename(r.key, e.target.value)} maxLength={160}
                            aria-label={`Nome do contato ${phone(r.whatsapp ?? r.phone)}`} aria-invalid={!validName}
                            placeholder="Digite o nome do cliente"
                            className={cn("h-8 bg-transparent", !validName && "border-red-400/60")} />
                          {!validName ? <p className="mt-1 text-xs text-red-300">Informe o nome para importar.</p> : null}
                        </>
                      ) : (
                        <span className="text-ink-300">{r.name || "Sem nome"}</span>
                      )}
                      {r.whatsapp || r.phone ? <p className="mt-1 text-xs tabular-nums text-ink-500 sm:hidden">{phone(r.whatsapp ?? r.phone)}</p> : null}
                    </td>
                    <td className="whitespace-nowrap tabular-nums text-ink-300">{r.whatsapp ? phone(r.whatsapp) : "—"}</td>
                    <td className="whitespace-nowrap tabular-nums text-ink-400">{r.phone ? phone(r.phone) : "—"}</td>
                    <td className="max-w-56 truncate text-ink-400">{r.email ?? "—"}</td>
                    <td className="whitespace-nowrap">
                      {isNew ? <Badge tone="green" dot>Novo</Badge>
                        : r.status === "existing" && r.existing ? (
                          <Link href={`/clientes/${r.existing.id}`} target="_blank" className="group inline-flex items-center gap-1.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70"
                            title={`Cadastrado como ${r.existing.full_name}`}>
                            <Badge>{r.existing.active ? "Já cadastrado" : "Cadastrado (inativo)"}</Badge>
                            <span className="text-xs text-ink-500 group-hover:text-brand-300">ver</span>
                          </Link>
                        ) : <Badge tone={r.status === "repeated" ? "amber" : "red"}>{r.reason}</Badge>}
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
          {filtered.length > limit ? (
            <div className="border-t border-ink-800 px-5 py-3 text-center">
              <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
                Mostrar mais {Math.min(PAGE, filtered.length - limit)} de {filtered.length - limit} restantes
              </Button>
            </div>
          ) : null}

          <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 border-t border-ink-800 bg-ink-900/95 px-5 py-3.5 backdrop-blur lg:bottom-0 lg:rounded-b-xl">
            {confirming ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between animate-in" role="alertdialog" aria-labelledby="confirm-import">
                <p id="confirm-import" className="text-sm text-ink-100">
                  Cadastrar <strong className="tabular-nums">{chosen.length}</strong> cliente(s)?{" "}
                  <span className="text-ink-400">Clientes não podem ser apagados, apenas desativados.</span>
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setConfirming(false)}>Voltar</Button>
                  <Button onClick={() => void runImport()} autoFocus><UserPlus /> Confirmar</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink-400" aria-live="polite">
                  <strong className="tabular-nums text-ink-100">{chosen.length}</strong> de {counts.new} contato(s) novo(s) selecionado(s)
                </p>
                <Button onClick={() => setConfirming(true)} disabled={!chosen.length}>
                  <UserPlus /> Cadastrar {chosen.length || ""} cliente{chosen.length === 1 ? "" : "s"}
                </Button>
              </div>
            )}
          </div>
        </Card>
      ) : null}

      {phase === "importing" ? (
        <Card className="animate-in">
          <CardBody className="flex flex-col items-center py-14 text-center" role="status" aria-live="polite">
            <Loader2 className="h-8 w-8 animate-spin text-brand-400" aria-hidden />
            <p className="mt-4 text-sm font-semibold text-ink-100">Cadastrando clientes…</p>
            <p className="mt-1 text-sm tabular-nums text-ink-400">{progress.done} de {progress.total}</p>
            <div className="mt-5 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-ink-800"
              role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done} aria-label="Progresso da importação">
              <div className="h-full origin-left rounded-full bg-brand-500 transition-transform duration-300"
                style={{ transform: `scaleX(${progress.total ? progress.done / progress.total : 0})` }} />
            </div>
            <p className="mt-4 text-xs text-ink-500">Não feche esta página até terminar.</p>
          </CardBody>
        </Card>
      ) : null}

      {phase === "done" && summary ? (
        <Card className="animate-in">
          <CardBody className="flex flex-col items-center py-12 text-center">
            <span className={cn("flex h-12 w-12 items-center justify-center rounded-full border",
              summary.error ? "border-amber-400/30 bg-amber-400/10" : "border-emerald-400/30 bg-emerald-400/10")}>
              {summary.error ? <AlertCircle className="h-6 w-6 text-amber-300" aria-hidden /> : <CheckCircle2 className="h-6 w-6 text-emerald-300" aria-hidden />}
            </span>
            <h2 className="mt-4 text-lg font-semibold text-ink-100" role="status">
              {summary.created} cliente{summary.created === 1 ? "" : "s"} cadastrado{summary.created === 1 ? "" : "s"}
            </h2>
            {summary.skipped ? (
              <p className="mt-1 text-sm text-ink-400">{summary.skipped} já tinham sido cadastrados por outra pessoa durante a importação e foram ignorados.</p>
            ) : null}
            {summary.error ? (
              <Alert tone="warn" icon={AlertCircle} className="mt-4 max-w-md text-left">
                A importação parou: {summary.error} Faltaram {summary.remaining} contato(s). Os que já foram cadastrados estão salvos.
              </Alert>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {summary.error ? <Button onClick={() => { setSummary(null); setFilter("new"); setPhase("review"); }}>Revisar o que faltou</Button> : null}
              <Link href="/clientes?ordem=recentes" className={buttonClass(summary.error ? "secondary" : "primary")}><Users /> Ver clientes</Link>
              <Button variant="ghost" onClick={reset}>Importar outro arquivo</Button>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
