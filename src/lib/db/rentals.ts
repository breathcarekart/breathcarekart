import { queryOptions } from "@tanstack/react-query";
import { db, unwrap } from "@/lib/db/client";
import { toDataError } from "@/lib/db/errors";
import { queryKeys } from "@/lib/db/query-keys";

const rentalSelect = `*,
  customer:customers(id, name, phone, whatsapp, address, city, attender_name, attender_relation),
  supervisor:profiles!rentals_supervisor_id_fkey(id, full_name, email, phone),
  rental_items(*, equipment_unit:equipment_units(id, unit_code, serial_number, brand, model), equipment_type:equipment_types(id, name))`;

/** Rentals the caller may see: all for office staff, assigned ones for a supervisor (RLS). */
export async function fetchRentals() {
  return unwrap(
    await db().from("rentals").select(rentalSelect).order("created_at", { ascending: false }),
  );
}

export type RentalListItem = Awaited<ReturnType<typeof fetchRentals>>[number];

/**
 * One rental with everything shown on its page. `payments` covers register and
 * invoice payments (both carry rental_id); RLS returns none to supervisors.
 */
export async function fetchRental(id: string) {
  return unwrap(
    await db()
      .from("rentals")
      .select(
        `${rentalSelect},
        creator:profiles!rentals_created_by_fkey(id, full_name, role),
        delivery_photos(*, uploader:profiles(id, full_name, role)),
        invoices(id, invoice_number, grand_total, amount_paid, status, due_date),
        payments(id, amount, payment_date, period_start, period_end, method, invoice_id)`,
      )
      .eq("id", id)
      .single(),
  );
}

async function rpc(response: { error: unknown }) {
  if (response.error) throw toDataError(response.error);
}

/** Closes the rental and frees its equipment (atomic, server-side). */
export async function returnRental(rentalId: string, returnedDate: string) {
  await rpc(
    await db().rpc("return_rental", { p_rental_id: rentalId, p_returned_date: returnedDate }),
  );
}

export async function renewRental(rentalId: string, newDueDate: string) {
  await rpc(await db().rpc("renew_rental", { p_rental_id: rentalId, p_new_due_date: newDueDate }));
}

export async function assignSupervisor(rentalId: string, supervisorId: string) {
  await rpc(
    await db().rpc("assign_rental_supervisor", {
      p_rental_id: rentalId,
      p_supervisor_id: supervisorId,
    }),
  );
}

export async function setDeliveryStatus(
  rentalId: string,
  status: "out_for_delivery" | "delivered",
  notes?: string,
) {
  await rpc(
    await db().rpc("set_delivery_status", {
      p_rental_id: rentalId,
      p_status: status,
      ...(notes ? { p_notes: notes } : {}),
    }),
  );
}

export const rentalQueries = {
  list: () => queryOptions({ queryKey: queryKeys.rentals.list(), queryFn: fetchRentals }),
  detail: (id: string) =>
    queryOptions({ queryKey: queryKeys.rentals.detail(id), queryFn: () => fetchRental(id) }),
};
