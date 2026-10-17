import { osNumber, plate } from "@/lib/format";
import { digits } from "@/lib/utils";
import { isReady } from "@/lib/constants";
import type { OrderStatus } from "@/lib/types";

type VehicleRef = { brand: string; model: string; plate: string | null };

/** Link do WhatsApp com a mensagem já escrita. Os números são salvos com DDD; o 55 só entra se faltar. */
export function whatsappLink(number: string, text?: string) {
  const d = digits(number);
  const full = d.length >= 12 && d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0];
const describe = (v: VehicleRef) => `${v.brand} ${v.model}${v.plate ? ` (placa ${plate(v.plate)})` : ""}`;

/** "Olá, João! Seu Honda Civic (placa ABC1D23) está pronto para retirada aqui na Premium Car. Estamos te esperando!" */
export function readyMessage(customerName: string, vehicles: VehicleRef[]) {
  const list = vehicles.map(describe);
  const subject = list.length > 1
    ? `Seus veículos ${list.slice(0, -1).join(", ")} e ${list[list.length - 1]} estão prontos`
    : `Seu ${list[0]} está pronto`;
  return `Olá, ${firstName(customerName)}! ${subject} para retirada aqui na Premium Car. Estamos te esperando!`;
}

/** Mensagem da OS: avisa que está pronto quando já pode ser retirado; antes disso, só abre a conversa. */
export function orderMessage(customerName: string, vehicle: VehicleRef, number: number, status: OrderStatus) {
  return isReady(status)
    ? readyMessage(customerName, [vehicle])
    : `Olá, ${firstName(customerName)}! Aqui é da Premium Car, sobre o seu ${vehicle.brand} ${vehicle.model} (${osNumber(number)}).`;
}
