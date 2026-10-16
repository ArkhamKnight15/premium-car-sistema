export const TZ = "America/Sao_Paulo";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const money = (v: number | string | null | undefined) => brl.format(Number(v ?? 0));
export const moneyInput = (v: number | string | null | undefined) => Number(v ?? 0).toFixed(2).replace(".", ",");

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, ...o });
const F_DT = fmt({ day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const F_D = fmt({ day: "2-digit", month: "2-digit", year: "numeric" });
const F_T = fmt({ hour: "2-digit", minute: "2-digit" });
const F_SHORT = fmt({ day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export const dateTime = (v?: string | Date | null) => (v ? F_DT.format(new Date(v)) : "—");
export const date = (v?: string | Date | null) => (v ? F_D.format(new Date(v)) : "—");
export const time = (v?: string | Date | null) => (v ? F_T.format(new Date(v)) : "—");
export const shortDateTime = (v?: string | Date | null) => (v ? F_SHORT.format(new Date(v)) : "—");
export const longDate = (v: string | Date) => fmt({ weekday: "long", day: "2-digit", month: "long" }).format(new Date(v));

export function minutes(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export function since(from: string | Date, to: string | Date = new Date()) {
  const min = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h}h${min % 60 ? String(min % 60).padStart(2, "0") : ""}`;
  return `${Math.floor(h / 24)} dias`;
}

export function phone(v?: string | null) {
  const d = (v ?? "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v || "—";
}

export function doc(v?: string | null) {
  const d = (v ?? "").replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return v || "—";
}

export const cep = (v?: string | null) => (v && v.length === 8 ? `${v.slice(0, 5)}-${v.slice(5)}` : v || "");

export const plate = (v?: string | null) => (v ? (/^[A-Z]{3}\d{4}$/.test(v) ? `${v.slice(0, 3)}-${v.slice(3)}` : v) : "SEM PLACA");

export const osNumber = (n: number | string) => `OS ${String(n).padStart(5, "0")}`;

export const km = (v?: number | null) => (v == null ? "—" : `${v.toLocaleString("pt-BR")} km`);

/** Data local (YYYY-MM-DD) no fuso da empresa. */
export const dayKey = (v: string | Date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(v));

/** O Brasil não tem horário de verão desde 2019: deslocamento fixo de -03:00. */
export const dayStartIso = (key: string, hhmm = "00:00") => new Date(`${key}T${hhmm}:00-03:00`).toISOString();

export function toLocalInput(v?: string | null) {
  if (!v) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(v));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

export const fromLocalInput = (v?: string | null) => (v ? new Date(`${v}:00-03:00`).toISOString() : null);

export function addDays(key: string, n: number) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const weekday = (key: string) => new Date(`${key}T12:00:00Z`).getUTCDay();

export const isDayKey = (v?: string | null): v is string => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));
