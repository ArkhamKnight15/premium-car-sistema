import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

export function normalizePlate(v: string | null | undefined) {
  const p = (v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return p || null;
}

/** Texto seguro para filtros .or()/.ilike() do PostgREST. */
export const safeTerm = (v: string | null | undefined) => (v ?? "").replace(/[%,()*\\"]/g, " ").trim().slice(0, 80);

const AGENDA_REASONS: Record<string, string> = {
  closed: "A empresa não abre nesse dia.",
  outside_hours: "O horário termina depois do fechamento ou começa antes da abertura.",
  bays_full: "Todos os boxes já estão ocupados nesse horário.",
  employee_busy: "O funcionário já tem outro compromisso nesse horário.",
  employee_inactive: "O funcionário selecionado está inativo.",
};

/** Traduz erros do banco em mensagens claras. */
export function friendlyError(e: { message?: string; hint?: string; code?: string } | null | undefined) {
  if (!e) return "Não foi possível concluir a operação.";
  const reason = e.hint ?? e.message?.match(/\((\w+)\)/)?.[1];
  if (reason && AGENDA_REASONS[reason]) return AGENDA_REASONS[reason];
  const m = e.message ?? "";
  if (e.code === "23505") {
    if (m.includes("document")) return "Já existe um cliente com este CPF/CNPJ.";
    if (m.includes("plate")) return "Já existe um veículo ativo com esta placa.";
    if (m.includes("services_name")) return "Já existe um serviço com este nome.";
    if (m.includes("one_open_per_vehicle")) return "Este veículo já possui uma OS em aberto.";
    if (m.includes("payment_methods")) return "Já existe uma forma de pagamento com este nome.";
    return "Registro duplicado.";
  }
  if (e.code === "23P01") return AGENDA_REASONS.employee_busy;
  if (e.code === "23503") return "Este registro está vinculado a outros e não pode ser removido.";
  if (e.code === "23514") {
    if (m.includes("plate")) return "Placa inválida.";
    if (m.includes("vehicles_years")) return "Ano do modelo deve ser igual ou 1 ano após o de fabricação.";
    if (m.includes("contact_required")) return "Informe ao menos um telefone, WhatsApp ou e-mail.";
    return "Algum dado está em formato inválido.";
  }
  if (e.code === "42501" || m.includes("row-level security")) {
    return /^[A-ZÁÉÍÓÚ]/.test(m) && !m.startsWith("new row") ? m : "Você não tem permissão para esta ação.";
  }
  if (e.code === "P0001" || e.code === "P0002") return m || "Operação não permitida.";
  return "Não foi possível concluir a operação. Tente novamente.";
}
