// Maps database status values to the labels and badge tones the UI shows.
// The database is the source of truth; nothing here is stored.
import type { Tone } from "@/components/shared/status-badge";
import { todayISO } from "@/lib/format";
import type { EquipmentStatus, Invoice, Rental } from "@/lib/db/types";

// ── Equipment ───────────────────────────────────────────────────────────────

export const equipmentStatusLabels: Record<EquipmentStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  on_rent: "On rent",
  maintenance: "Maintenance",
  repair: "Repair",
  sold: "Sold",
};

export const equipmentStatusTone: Record<EquipmentStatus, Tone> = {
  available: "available",
  reserved: "pending",
  on_rent: "rented",
  maintenance: "service",
  repair: "damaged",
  sold: "sold",
};

/** Statuses staff may set by hand; on_rent and sold only change through workflows. */
export const manualEquipmentStatuses: EquipmentStatus[] = [
  "available",
  "reserved",
  "maintenance",
  "repair",
];

// ── Rentals ─────────────────────────────────────────────────────────────────

export type DeliveryStatus = "pending" | "assigned" | "out_for_delivery" | "delivered";

export const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  pending: "Awaiting assignment",
  assigned: "Assigned",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
};

export const deliveryStatusTone: Record<DeliveryStatus, Tone> = {
  pending: "pending",
  assigned: "assigned",
  out_for_delivery: "out-for-delivery",
  delivered: "delivered",
};

export const asDeliveryStatus = (value: string): DeliveryStatus =>
  value === "assigned" || value === "out_for_delivery" || value === "delivered" ? value : "pending";

export type RentalStage =
  | "returned"
  | "cancelled"
  | "pending"
  | "assigned"
  | "out_for_delivery"
  | "active"
  | "due_soon"
  | "overdue";

/** Where a rental is in its lifecycle, combining status, delivery and due date. */
export function rentalStage(
  r: Pick<Rental, "status" | "delivery_status" | "due_date">,
): RentalStage {
  if (r.status === "completed") return "returned";
  if (r.status === "cancelled") return "cancelled";
  const delivery = asDeliveryStatus(r.delivery_status);
  if (delivery !== "delivered") return delivery;
  const today = todayISO();
  if (r.due_date < today) return "overdue";
  const soon = new Date();
  soon.setDate(soon.getDate() + 7);
  if (r.due_date <= soon.toISOString().slice(0, 10)) return "due_soon";
  return "active";
}

export const rentalStageLabels: Record<RentalStage, string> = {
  returned: "Returned",
  cancelled: "Cancelled",
  pending: "Awaiting delivery",
  assigned: "Assigned",
  out_for_delivery: "Out for delivery",
  active: "Active",
  due_soon: "Due soon",
  overdue: "Overdue",
};

export const rentalStageTone: Record<RentalStage, Tone> = {
  returned: "returned",
  cancelled: "cancelled",
  pending: "pending",
  assigned: "assigned",
  out_for_delivery: "out-for-delivery",
  active: "active",
  due_soon: "due-soon",
  overdue: "overdue",
};

export const isOpenRental = (r: Pick<Rental, "status">) =>
  r.status !== "completed" && r.status !== "cancelled";

// ── Invoices & payments ─────────────────────────────────────────────────────

export type PaymentState = "paid" | "partial" | "outstanding" | "overdue" | "draft" | "cancelled";

/** Payment position of an invoice, from its amounts (not just the stored status). */
export function paymentState(
  i: Pick<Invoice, "status" | "grand_total" | "amount_paid" | "due_date">,
): PaymentState {
  if (i.status === "cancelled") return "cancelled";
  if (i.status === "draft") return "draft";
  const total = Number(i.grand_total);
  const paid = Number(i.amount_paid);
  if (paid >= total) return "paid";
  if (i.due_date < todayISO()) return "overdue";
  return paid > 0 ? "partial" : "outstanding";
}

export const paymentStateLabels: Record<PaymentState, string> = {
  paid: "Paid",
  partial: "Partially paid",
  outstanding: "Outstanding",
  overdue: "Overdue",
  draft: "Draft",
  cancelled: "Cancelled",
};

export const paymentStateTone: Record<PaymentState, Tone> = {
  paid: "paid",
  partial: "partial",
  outstanding: "pending",
  overdue: "overdue",
  draft: "draft",
  cancelled: "cancelled",
};

export const outstandingOf = (i: Pick<Invoice, "grand_total" | "amount_paid" | "status">) =>
  i.status === "cancelled" || i.status === "draft"
    ? 0
    : Math.max(0, Number(i.grand_total) - Number(i.amount_paid));

export const paymentMethodLabels = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  other: "Other",
  unknown: "Not recorded",
} as const;
