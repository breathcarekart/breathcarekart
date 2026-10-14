// Payments reach a customer two ways:
//  - through an invoice (payments recorded in the app; these also carry the rental), or
//  - straight through a rental (the imported paper registers have no invoices).
// These helpers read both paths and never count the same payment twice.
//
// Kept free of app imports so the unit tests can run with plain `node --test`.

export type PaymentCustomer = { id: string; name: string };

type CustomerLinks = {
  invoice?: { customer?: PaymentCustomer | null } | null;
  rental?: { customer?: PaymentCustomer | null } | null;
};

/** The customer a payment belongs to: the invoice's, else the rental's. */
export function paymentCustomer(payment: CustomerLinks): PaymentCustomer | null {
  return payment.invoice?.customer ?? payment.rental?.customer ?? null;
}

/**
 * The transaction type for filtering and reports. Invoice payments use the
 * invoice's type; payments linked only to a rental are rental payments.
 */
export function paymentTransactionType(payment: {
  rental_id?: string | null;
  invoice?: { transaction_type?: string | null } | null;
}): string | null {
  return payment.invoice?.transaction_type ?? (payment.rental_id ? "rental" : null);
}

/** Keeps the first item for each id, in order. */
export function uniqueById<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}

/** Sum of payment amounts, each payment counted once. Summed in paise to avoid float drift. */
export function totalPaid(payments: readonly { id: string; amount: number | string }[]): number {
  const paise = uniqueById(payments).reduce(
    (sum, p) => sum + Math.round(Number(p.amount) * 100),
    0,
  );
  return paise / 100;
}
