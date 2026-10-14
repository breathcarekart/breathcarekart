import { queryOptions } from "@tanstack/react-query";
import { db, unwrap } from "@/lib/db/client";
import { toDataError } from "@/lib/db/errors";
import { queryKeys } from "@/lib/db/query-keys";
import type { PaymentMethod } from "@/lib/db/types";

/**
 * All payments with their invoice or rental, customer and who recorded them.
 * Imported register payments link only to a rental, so the customer can come
 * from either side; use paymentCustomer() from @/lib/payments to read it.
 */
export async function fetchPayments() {
  return unwrap(
    await db()
      .from("payments")
      .select(
        `*,
        invoice:invoices(id, invoice_number, grand_total, transaction_type, customer_id, customer:customers(id, name)),
        rental:rentals(id, rental_number, customer_id, customer:customers(id, name), rental_items(equipment_type_id)),
        recorder:profiles!payments_recorded_by_fkey(id, full_name, role)`,
      )
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false }),
  );
}

export type PaymentListItem = Awaited<ReturnType<typeof fetchPayments>>[number];

export type RecordPaymentInput = {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  paymentDate: string;
  reference?: string | undefined;
  notes?: string | undefined;
};

/** Records a payment; the database updates the invoice's paid amount and status. */
export async function recordPayment(input: RecordPaymentInput) {
  const { data, error } = await db().rpc("record_payment", {
    p_invoice_id: input.invoiceId,
    p_amount: input.amount,
    p_method: input.method,
    p_payment_date: input.paymentDate,
    ...(input.reference ? { p_reference: input.reference } : {}),
    ...(input.notes ? { p_notes: input.notes } : {}),
  });
  if (error) throw toDataError(error);
  return data;
}

export const paymentQueries = {
  list: () => queryOptions({ queryKey: queryKeys.payments.list(), queryFn: fetchPayments }),
};
