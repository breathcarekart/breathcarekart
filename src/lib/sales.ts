import type { SaleWithRelations } from "@/lib/db/sales";
import { paymentState, paymentStateLabels, paymentStateTone } from "@/lib/status";

/** The invoice raised for a sale (one per sale). */
export const saleInvoice = (s: SaleWithRelations) => s.invoices[0] ?? null;
export const saleAmount = (s: SaleWithRelations) => Number(saleInvoice(s)?.grand_total ?? 0);
export const saleStatus = (s: SaleWithRelations) => {
  if (s.status === "cancelled") return { tone: "cancelled" as const, label: "Cancelled" };
  const inv = saleInvoice(s);
  if (!inv) return { tone: "completed" as const, label: "Completed" };
  const st = paymentState(inv);
  return { tone: paymentStateTone[st], label: paymentStateLabels[st] };
};
