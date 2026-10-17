import type { AppointmentStatus, ItemStatus, OrderStatus, PaymentStatus, PhotoKind, VehicleType } from "./types";

export type Tone = "neutral" | "amber" | "blue" | "cyan" | "violet" | "green" | "red" | "brand";

export const ORDER_STATUS: Record<OrderStatus, { label: string; short: string; tone: Tone }> = {
  received: { label: "Recebido", short: "Recebido", tone: "neutral" },
  evaluation: { label: "Em avaliação", short: "Avaliação", tone: "cyan" },
  waiting: { label: "Aguardando início", short: "Aguardando", tone: "amber" },
  in_progress: { label: "Em execução", short: "Execução", tone: "blue" },
  quality_control: { label: "Em controle de qualidade", short: "Qualidade", tone: "violet" },
  completed: { label: "Concluído", short: "Concluído", tone: "green" },
  awaiting_pickup: { label: "Aguardando retirada", short: "Retirada", tone: "brand" },
  delivered: { label: "Entregue", short: "Entregue", tone: "green" },
  cancelled: { label: "Cancelado", short: "Cancelado", tone: "red" },
};

/** Sequência normal de andamento (sem "Cancelado"). */
export const FLOW: OrderStatus[] = ["received", "evaluation", "waiting", "in_progress", "quality_control", "completed", "awaiting_pickup", "delivered"];
export const OPEN_STATUSES: OrderStatus[] = FLOW.slice(0, 7);
export const CLOSED_STATUSES: OrderStatus[] = ["delivered", "cancelled"];
/** Veículo pronto: já pode ser retirado pelo cliente. */
export const READY_STATUSES: OrderStatus[] = ["completed", "awaiting_pickup"];
export const isReady = (status: OrderStatus) => READY_STATUSES.includes(status);

export const ITEM_STATUS: Record<ItemStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pendente", tone: "neutral" },
  in_progress: { label: "Em execução", tone: "blue" },
  done: { label: "Concluído", tone: "green" },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pendente", tone: "amber" },
  partial: { label: "Parcialmente pago", tone: "blue" },
  paid: { label: "Pago", tone: "green" },
  refunded: { label: "Estornado", tone: "red" },
};

export const APPOINTMENT_STATUS: Record<AppointmentStatus, { label: string; tone: Tone }> = {
  scheduled: { label: "Agendado", tone: "amber" },
  confirmed: { label: "Confirmado", tone: "blue" },
  cancelled: { label: "Cancelado", tone: "red" },
  no_show: { label: "Não compareceu", tone: "neutral" },
  converted: { label: "Virou OS", tone: "green" },
};

export const CHANNELS: Record<string, string> = { telefone: "Telefone", whatsapp: "WhatsApp", presencial: "Presencial", outro: "Outro" };

export const VEHICLE_TYPES: Record<VehicleType, string> = {
  carro: "Carro", suv: "SUV", picape: "Picape", utilitario: "Utilitário", van: "Van", moto: "Moto", caminhao: "Caminhão", outro: "Outro",
};

export const PHOTO_KIND: Record<PhotoKind, string> = { entry: "Entrada", damage: "Avaria", progress: "Andamento", final: "Finalização" };

export const FUEL_LEVELS = ["Reserva", "1/4", "1/2", "3/4", "Cheio"];

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
