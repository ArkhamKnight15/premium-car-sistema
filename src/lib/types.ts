export type UserRole = "admin" | "employee";
export type OrderStatus = "received" | "evaluation" | "waiting" | "in_progress" | "quality_control" | "completed" | "awaiting_pickup" | "delivered" | "cancelled";
export type ItemStatus = "pending" | "in_progress" | "done";
export type PaymentStatus = "pending" | "partial" | "paid" | "refunded";
export type AppointmentStatus = "scheduled" | "confirmed" | "cancelled" | "no_show" | "converted";
export type PhotoKind = "entry" | "damage" | "progress" | "final";
export type VehicleType = "carro" | "suv" | "picape" | "utilitario" | "van" | "moto" | "caminhao" | "outro";

export interface Profile {
  id: string; full_name: string; email: string | null; role: UserRole; active: boolean;
  perm_customers: boolean; perm_all_orders: boolean; perm_payments: boolean; perm_discounts: boolean; created_at: string;
}

export interface Employee {
  id: string; profile_id: string | null; full_name: string; job_title: string | null; phone: string | null; active: boolean; created_at: string;
}

export interface Customer {
  id: string; person_type: "PF" | "PJ"; full_name: string; document: string | null; phone: string | null; whatsapp: string | null;
  email: string | null; zip_code: string | null; street: string | null; number: string | null; complement: string | null;
  district: string | null; city: string | null; state: string | null; notes: string | null; active: boolean;
  deactivated_at: string | null; deactivation_reason: string | null; anonymized_at: string | null; created_at: string;
}

export interface Vehicle {
  id: string; customer_id: string; plate: string | null; brand: string; model: string; manufacture_year: number | null;
  model_year: number | null; color: string | null; vehicle_type: VehicleType; mileage_km: number | null; notes: string | null;
  active: boolean; created_at: string;
}

export interface Service {
  id: string; name: string; description: string | null; category: string; default_price: number; price_reviewed: boolean;
  estimated_minutes: number; active: boolean; sort_order: number; created_at: string; updated_at: string;
}

export interface ServiceOrder {
  id: string; number: number; customer_id: string; vehicle_id: string; appointment_id: string | null; responsible_id: string | null;
  status: OrderStatus; entered_at: string; expected_at: string | null; completed_at: string | null; delivered_at: string | null;
  cancelled_at: string | null; cancel_reason: string | null; mileage_km: number | null; fuel_level: string | null;
  initial_condition: string | null; damages: string | null; notes: string | null; subtotal: number; discount: number; total: number;
  amount_paid: number; payment_status: PaymentStatus; created_by: string | null; created_at: string; updated_at: string;
}

export interface OrderItem {
  id: string; order_id: string; service_id: string | null; description: string; quantity: number; unit_price: number; discount: number;
  line_total: number; status: ItemStatus; employee_id: string | null; started_at: string | null; finished_at: string | null; created_at: string;
}

export interface OrderEvent {
  id: string; order_id: string; kind: string; message: string; actor_id: string | null; created_at: string;
}

export interface OrderPhoto {
  id: string; order_id: string; storage_path: string; kind: PhotoKind; caption: string | null; removed_at: string | null; created_at: string;
}

export interface PaymentMethod { id: string; name: string; active: boolean; sort_order: number }

export interface Payment {
  id: string; order_id: string; amount: number; method_id: string; paid_at: string; status: "confirmed" | "refunded"; notes: string | null;
  refunded_at: string | null; refund_reason: string | null; created_by: string | null; created_at: string;
}

export interface Appointment {
  id: string; customer_id: string; vehicle_id: string; employee_id: string | null; starts_at: string; ends_at: string;
  status: AppointmentStatus; channel: string; notes: string | null; cancel_reason: string | null; service_order_id: string | null; created_at: string;
}

export interface CompanySettings {
  id: number; company_name: string; legal_name: string | null; cnpj: string | null; phone: string | null; whatsapp: string | null;
  email: string | null; address: string | null; city: string | null; timezone: string; bays: number; slot_minutes: number; order_terms: string | null;
}

export interface BusinessHour { weekday: number; is_open: boolean; open_time: string; close_time: string }

export interface ActionResult<T = unknown> {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  data?: T;
  redirect?: string;
}
