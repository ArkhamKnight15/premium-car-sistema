import { z } from "zod";
import { digits, normalizePlate } from "@/lib/utils";

export function isValidCPF(value: string) {
  const c = digits(value);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (len: number) => {
    let s = 0;
    for (let i = 0; i < len; i++) s += Number(c[i]) * (len + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

export function isValidCNPJ(value: string) {
  const c = digits(value);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (len: 12 | 13) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = w.reduce((acc, wi, i) => acc + Number(c[i]) * wi, 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(c[12]) && dv(13) === Number(c[13]);
}

/** Placa antiga (ABC1234) ou padrão Mercosul (ABC1D23). */
export const PLATE_RE = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

const text = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
const phoneField = z
  .string()
  .optional()
  .transform((v) => digits(v) || null)
  .refine((v) => v === null || (v.length >= 10 && v.length <= 13), "Use DDD + número (10 ou 11 dígitos).");
const intField = (min: number, max: number, msg: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v && digits(v) ? Number(digits(v)) : null))
    .refine((v) => v === null || (v >= min && v <= max), msg);

export const customerSchema = z
  .object({
    person_type: z.enum(["PF", "PJ"]),
    full_name: z.string().trim().min(3, "Informe o nome completo ou a razão social.").max(160),
    document: z.string().optional().transform((v) => digits(v) || null),
    phone: phoneField,
    whatsapp: phoneField,
    email: z
      .string()
      .trim()
      .toLowerCase()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || z.string().email().safeParse(v).success, "E-mail inválido."),
    zip_code: z.string().optional().transform((v) => digits(v) || null).refine((v) => v === null || v.length === 8, "CEP deve ter 8 dígitos."),
    street: text(160),
    number: text(20),
    complement: text(80),
    district: text(80),
    city: text(80),
    state: z.string().trim().toUpperCase().optional().transform((v) => (v ? v : null)).refine((v) => v === null || /^[A-Z]{2}$/.test(v), "UF inválida."),
    notes: text(4000),
  })
  .superRefine((c, ctx) => {
    if (c.document) {
      const valid = c.person_type === "PF" ? isValidCPF(c.document) : isValidCNPJ(c.document);
      if (!valid) ctx.addIssue({ code: "custom", path: ["document"], message: c.person_type === "PF" ? "CPF inválido." : "CNPJ inválido." });
    }
    if (!c.phone && !c.whatsapp && !c.email) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Informe ao menos um telefone, WhatsApp ou e-mail." });
    }
  });

const thisYear = new Date().getFullYear();

export const vehicleSchema = z
  .object({
    plate: z
      .string()
      .optional()
      .transform((v) => normalizePlate(v))
      .refine((v) => v === null || PLATE_RE.test(v), "Placa inválida. Use ABC1234 ou o padrão Mercosul ABC1D23."),
    brand: z.string().trim().min(1, "Informe a marca.").max(60),
    model: z.string().trim().min(1, "Informe o modelo.").max(80),
    manufacture_year: intField(1900, thisYear + 1, "Ano de fabricação inválido."),
    model_year: intField(1900, thisYear + 2, "Ano do modelo inválido."),
    color: text(40),
    vehicle_type: z.enum(["carro", "suv", "picape", "utilitario", "van", "moto", "caminhao", "outro"]),
    mileage_km: intField(0, 9_999_999, "Quilometragem inválida."),
    notes: text(4000),
  })
  .superRefine((v, ctx) => {
    if (v.manufacture_year && v.model_year && (v.model_year < v.manufacture_year || v.model_year > v.manufacture_year + 1)) {
      ctx.addIssue({ code: "custom", path: ["model_year"], message: "Deve ser igual ou 1 ano após o de fabricação." });
    }
  });

/** "1.234,56" · "1234.56" · "R$ 50" → número (2 casas) */
export function parseMoney(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/\s|R\$/g, "");
  if (!s) return null;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export const money = (label: string) =>
  z.preprocess(
    (v) => parseMoney(v),
    z.number({ invalid_type_error: `${label}: valor inválido.`, required_error: `Informe ${label.toLowerCase()}.` }).min(0, `${label} não pode ser negativo.`),
  );

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(100),
  description: text(1000),
  category: z.string().trim().min(2, "Informe a categoria.").max(40),
  default_price: money("Preço"),
  estimated_minutes: z.coerce.number({ invalid_type_error: "Duração inválida." }).int().min(5, "Mínimo de 5 minutos.").max(10080, "Máximo de 7 dias."),
  active: z.boolean(),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
});

export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const k = i.path.join(".");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

/** FormData → objeto; campos de checkbox listados viram boolean. */
export function formToObject(fd: FormData, checkboxes: string[] = []) {
  const o: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") o[k] = v;
  for (const c of checkboxes) o[c] = fd.get(c) === "on";
  return o;
}

export const uuid = z.string().uuid();
