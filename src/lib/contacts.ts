/**
 * Leitura de contatos exportados do celular (vCard .vcf ou CSV do Google/Outlook)
 * para importação em massa de clientes. Funções puras: rodam no navegador e no servidor.
 */
import { digits } from "@/lib/utils";

export type RawContact = { name: string; phones: string[]; emails: string[]; org: string | null };

export type ContactStatus = "new" | "existing" | "repeated" | "invalid";

export interface ContactRow {
  key: string;
  name: string;
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  status: ContactStatus;
  /** Motivo exibido para contatos que não serão importados. */
  reason?: string;
  org: string | null;
  existing?: { id: string; full_name: string; active: boolean };
}

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const NAME_MIN = 3;
export const NAME_MAX = 160;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/* ------------------------------------------------------------------ */
/* Telefones                                                          */
/* ------------------------------------------------------------------ */

/**
 * Converte um número da agenda no formato salvo pelo sistema: DDD + número, sem o 55.
 * Celulares antigos com 8 dígitos ganham o 9 na frente. Números estrangeiros ou sem DDD
 * (quando não há DDD padrão) retornam null.
 */
export function normalizeBrPhone(raw: string, defaultDdd?: string | null): string | null {
  const trimmed = raw.trim();
  let d = digits(trimmed);
  if (!d) return null;
  if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
    d = d.replace(/^00/, "");
    if (!d.startsWith("55")) return null;
    d = d.slice(2);
  } else if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    d = d.slice(2);
  } else if (d.startsWith("0")) {
    // 0 + DDD + número, ou 0 + operadora (2 dígitos) + DDD + número
    if (d.length === 11 || d.length === 12) d = d.slice(1);
    else if (d.length === 13 || d.length === 14) d = d.slice(3);
  }
  if ((d.length === 8 || d.length === 9) && defaultDdd && /^[1-9][1-9]$/.test(defaultDdd)) d = defaultDdd + d;
  if (!/^[1-9][1-9]/.test(d)) return null;
  if (d.length === 10 && /^[6-9]$/.test(d[2])) d = `${d.slice(0, 2)}9${d.slice(2)}`;
  if (d.length === 11) return d[2] === "9" ? d : null;
  if (d.length === 10) return /^[2-5]$/.test(d[2]) ? d : null;
  return null;
}

export const isMobile = (d: string) => d.length === 11;

/* ------------------------------------------------------------------ */
/* vCard                                                              */
/* ------------------------------------------------------------------ */

const utf8 = new TextDecoder("utf-8");

function decodeQuotedPrintable(value: string, charset: string) {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "=" && /^[0-9A-F]{2}$/i.test(value.slice(i + 1, i + 3))) {
      bytes.push(parseInt(value.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(...new TextEncoder().encode(ch));
    }
  }
  const arr = new Uint8Array(bytes);
  try {
    return new TextDecoder(charset || "utf-8").decode(arr);
  } catch {
    return utf8.decode(arr);
  }
}

const unescapeVcard = (v: string) => v.replace(/\\n/gi, " ").replace(/\\([,;:\\])/g, "$1").trim();

/** Junta linhas dobradas (RFC 6350) e as quebras "soft" do quoted-printable (vCard 2.1 do Android). */
function unfoldVcard(text: string) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    if (prev !== undefined && /^[ \t]/.test(line)) out[out.length - 1] = prev + line.slice(1);
    else if (prev !== undefined && /ENCODING=QUOTED-PRINTABLE/i.test(prev.split(":")[0]) && prev.endsWith("=")) out[out.length - 1] = prev.slice(0, -1) + line;
    else out.push(line);
  }
  return out;
}

export function parseVCard(text: string): RawContact[] {
  const contacts: RawContact[] = [];
  let cur: (RawContact & { n: string }) | null = null;
  for (const line of unfoldVcard(text)) {
    const sep = line.indexOf(":");
    if (sep < 0) continue;
    const head = line.slice(0, sep);
    let value = line.slice(sep + 1);
    const [rawProp, ...params] = head.split(";");
    const prop = rawProp.replace(/^[^.]+\./, "").toUpperCase(); // "item1.TEL" (iPhone) → "TEL"
    if (prop === "BEGIN" && value.trim().toUpperCase() === "VCARD") {
      cur = { name: "", n: "", phones: [], emails: [], org: null };
      continue;
    }
    if (!cur) continue;
    if (prop === "END" && value.trim().toUpperCase() === "VCARD") {
      contacts.push({ name: cur.name || cur.n, phones: cur.phones, emails: cur.emails, org: cur.org });
      cur = null;
      continue;
    }
    const paramText = params.join(";").toUpperCase();
    if (paramText.includes("ENCODING=QUOTED-PRINTABLE")) {
      value = decodeQuotedPrintable(value, /CHARSET=([\w-]+)/.exec(paramText)?.[1]?.toLowerCase() ?? "utf-8");
    }
    if (prop === "FN") cur.name = unescapeVcard(value);
    else if (prop === "N") {
      const [family = "", given = "", middle = "", prefix = "", suffix = ""] = value.split(/(?<!\\);/).map(unescapeVcard);
      cur.n = [prefix, given, middle, family, suffix].filter(Boolean).join(" ");
    } else if (prop === "TEL") cur.phones.push(value.replace(/^tel:/i, "").trim());
    else if (prop === "EMAIL") cur.emails.push(unescapeVcard(value));
    else if (prop === "ORG") cur.org = unescapeVcard(value.split(/(?<!\\);/)[0] ?? "") || null;
  }
  return contacts;
}

/* ------------------------------------------------------------------ */
/* CSV                                                                */
/* ------------------------------------------------------------------ */

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0];
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}

/** CSV com aspas (RFC 4180), aceitando quebras de linha dentro das células. */
export function parseCsvRows(text: string): string[][] {
  const delim = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const norm = (h: string) => h.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const IGNORED_COL = /label|type|tipo|rotulo/;

/** Lê o CSV do Google Contatos, do Outlook ou uma planilha simples com colunas de nome e telefone. */
export function parseContactsCsv(text: string): RawContact[] {
  const [header, ...rows] = parseCsvRows(text);
  if (!header) return [];
  const h = header.map(norm);
  const find = (re: RegExp) => h.findIndex((c) => re.test(c) && !IGNORED_COL.test(c));
  const fullName = find(/^(name|nome|nome completo|full name|display name|nome de exibicao|cliente)$/);
  const first = find(/^(first name|given name|primeiro nome)$/);
  const middle = find(/^(middle name|additional name|nome do meio)$/);
  const last = find(/^(last name|family name|sobrenome|ultimo nome)$/);
  const orgCol = find(/^(organization( 1)? - name|organization name|company|empresa)$/);
  const phoneCols = h.flatMap((c, i) => (/(phone|telefone|celular|whats|fone|mobile|^tel)/.test(c) && !IGNORED_COL.test(c) ? [i] : []));
  const emailCols = h.flatMap((c, i) => (/e-?mail/.test(c) && !IGNORED_COL.test(c) ? [i] : []));
  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  // Google junta vários números da mesma etiqueta em uma célula com " ::: "
  const split = (v: string) => v.split(/\s*:::\s*/).map((s) => s.trim()).filter(Boolean);
  return rows.map((r) => ({
    name: cell(r, fullName) || [cell(r, first), cell(r, middle), cell(r, last)].filter(Boolean).join(" "),
    phones: phoneCols.flatMap((i) => split(cell(r, i))),
    emails: emailCols.flatMap((i) => split(cell(r, i))),
    org: cell(r, orgCol) || null,
  }));
}

/* ------------------------------------------------------------------ */
/* Montagem das linhas para revisão                                   */
/* ------------------------------------------------------------------ */

export function parseContactsFile(fileName: string, text: string): RawContact[] {
  const clean = text.replace(/^﻿/, "");
  if (/\.vcf$|\.vcard$/i.test(fileName) || /^\s*BEGIN:VCARD/i.test(clean)) return parseVCard(clean);
  return parseContactsCsv(clean);
}

const cleanName = (v: string) => v.replace(/\s+/g, " ").trim().slice(0, NAME_MAX);

export const nameIsValid = (name: string) => cleanName(name).length >= NAME_MIN;

/**
 * Escolhe WhatsApp (primeiro celular) e telefone (outro número) de cada contato
 * e marca números inválidos e contatos repetidos no próprio arquivo.
 */
export function buildRows(contacts: RawContact[], defaultDdd?: string | null): ContactRow[] {
  const seen = new Set<string>();
  return contacts
    .filter((c) => c.name.trim() || c.phones.length || c.emails.length)
    .map((c, i) => {
      const numbers = [...new Set(c.phones.map((p) => normalizeBrPhone(p, defaultDdd)).filter((p): p is string => p !== null))];
      const whatsapp = numbers.find(isMobile) ?? null;
      const phone = numbers.find((n) => n !== whatsapp) ?? null;
      const email = c.emails.map((e) => e.trim().toLowerCase()).find((e) => EMAIL_RE.test(e)) ?? null;
      const row: ContactRow = { key: `c${i}`, name: cleanName(c.name || c.org || ""), whatsapp, phone, email, status: "new", org: c.org };
      if (!whatsapp && !phone) {
        row.status = "invalid";
        row.reason = c.phones.length ? "Número inválido" : "Sem telefone";
        return row;
      }
      const ids = [whatsapp, phone].filter((n): n is string => n !== null);
      if (ids.some((n) => seen.has(n))) {
        row.status = "repeated";
        row.reason = "Repetido no arquivo";
      }
      ids.forEach((n) => seen.add(n));
      return row;
    });
}

/**
 * Variações com que um número pode já estar no banco: com o 55 na frente
 * e, no celular, sem o 9 (cadastros antigos).
 */
export function numberVariants(n: string) {
  const out = [n, `55${n}`];
  if (isMobile(n) && /[6-9]/.test(n[3])) {
    const old = n.slice(0, 2) + n.slice(3);
    out.push(old, `55${old}`);
  }
  return out;
}

/** Leitura do arquivo como texto; arquivos antigos do Windows vêm em Latin-1. */
export async function readContactsFile(file: File) {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}
