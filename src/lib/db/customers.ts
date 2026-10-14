import { queryOptions } from "@tanstack/react-query";
import { db, unwrap } from "@/lib/db/client";
import { queryKeys } from "@/lib/db/query-keys";
import type { InsertRow, UpdateRow } from "@/lib/db/types";

/**
 * Customers with their rental count, invoice totals and payments. Payments are
 * fetched via invoices and via rentals (imported register payments have no
 * invoice); count them with totalPaid() from @/lib/payments, which skips repeats.
 */
export async function fetchCustomers() {
  return unwrap(
    await db()
      .from("customers")
      .select(
        "*, rentals(count), rental_payments:rentals(payments(id, amount)), invoices(grand_total, amount_paid, status, payments(id, amount))",
      )
      .order("created_at", { ascending: false }),
  );
}

export type CustomerListItem = Awaited<ReturnType<typeof fetchCustomers>>[number];

/** One customer with everything linked to them. RLS trims what a role may see. */
export async function fetchCustomer(id: string) {
  return unwrap(
    await db()
      .from("customers")
      .select(
        `*,
        rentals(*, rental_items(*, equipment_unit:equipment_units(id, unit_code, brand, model), equipment_type:equipment_types(id, name)), payments(*)),
        sales(*, sale_items(*)),
        invoices(*, payments(*))`,
      )
      .eq("id", id)
      .single(),
  );
}

export type CustomerInput = Pick<
  InsertRow<"customers">,
  | "name"
  | "age"
  | "gender"
  | "attender_name"
  | "attender_relation"
  | "phone"
  | "whatsapp"
  | "emergency_contact"
  | "city"
  | "address"
  | "notes"
>;

export async function createCustomer(input: CustomerInput) {
  return unwrap(await db().from("customers").insert(input).select().single());
}

export async function updateCustomer(id: string, patch: UpdateRow<"customers">) {
  return unwrap(await db().from("customers").update(patch).eq("id", id).select().single());
}

export const customerQueries = {
  list: () => queryOptions({ queryKey: queryKeys.customers.list(), queryFn: fetchCustomers }),
  detail: (id: string) =>
    queryOptions({ queryKey: queryKeys.customers.detail(id), queryFn: () => fetchCustomer(id) }),
};
