import { Badge } from "@/components/ui/badge";
import { APPOINTMENT_STATUS, ITEM_STATUS, ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants";
import type { AppointmentStatus, ItemStatus, OrderStatus, PaymentStatus } from "@/lib/types";

export const OrderStatusBadge = ({ status, short }: { status: OrderStatus; short?: boolean }) => (
  <Badge tone={ORDER_STATUS[status].tone} dot>{short ? ORDER_STATUS[status].short : ORDER_STATUS[status].label}</Badge>
);
export const PaymentBadge = ({ status }: { status: PaymentStatus }) => <Badge tone={PAYMENT_STATUS[status].tone}>{PAYMENT_STATUS[status].label}</Badge>;
export const ItemBadge = ({ status }: { status: ItemStatus }) => <Badge tone={ITEM_STATUS[status].tone}>{ITEM_STATUS[status].label}</Badge>;
export const AppointmentBadge = ({ status }: { status: AppointmentStatus }) => (
  <Badge tone={APPOINTMENT_STATUS[status].tone} dot>{APPOINTMENT_STATUS[status].label}</Badge>
);
