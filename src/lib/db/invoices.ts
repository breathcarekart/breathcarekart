import { queryOptions } from "@tanstack/react-query";
import { db, unwrap } from "@/lib/db/client";
import { DataError, toDataError } from "@/lib/db/errors";
import { queryKeys } from "@/lib/db/query-keys";
import type { TransactionType } from "@/lib/db/types";

/** Invoices with customer, line items and creator. */
export async function fetchInvoices() {
  return unwrap(
    await db()
      .from("invoices")
      .select(
        `*,
        customer:customers(id, name),
        invoice_items(*),
        creator:profiles!invoices_created_by_fkey(id, full_name, role)`,
      )
      .order("invoice_date", { ascending: false })
      .order("created_at", { ascending: false }),
  );
}

export type InvoiceListItem = Awaited<ReturnType<typeof fetchInvoices>>[number];

/** One invoice with everything needed for details, PDF and payments. */
export async function fetchInvoice(id: string) {
  return unwrap(
    await db()
      .from("invoices")
      .select(
        `*,
        customer:customers(*),
        rental:rentals(id, rental_number, start_date, due_date, status, delivery_status),
        sale:sales(id, sale_number, sale_date, status),
        invoice_items(*),
        payments(*, recorder:profiles!payments_recorded_by_fkey(id, full_name, role)),
        creator:profiles!invoices_created_by_fkey(id, full_name, role, email)`,
      )
      .eq("id", id)
      .single(),
  );
}

export type InvoiceWithRelations = Awaited<ReturnType<typeof fetchInvoice>>;

export type CreateInvoiceInput = {
  transaction_type: TransactionType;
  customer_id: string;
  invoice_date: string;
  due_date: string;
  tax_rate: number;
  discount: number;
  delivery_charge: number;
  notes?: string | undefined;
  /** Rental only */
  start_date?: string | undefined;
  end_date?: string | undefined;
  supervisor_id?: string | undefined;
  deposit_amount?: number | undefined;
  items: { equipment_unit_id: string; rate: number; months?: number | undefined }[];
};

export type CreateInvoiceResult = {
  invoice_id: string;
  invoice_number: string;
  rental_id: string | null;
  sale_id: string | null;
};

/**
 * Creates the rental or sale, its items, the invoice and its lines in one
 * transaction. Totals, invoice number and creator are set by the database.
 */
export async function createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
  const { data, error } = await db().rpc("create_invoice", { p: input });
  if (error) throw toDataError(error);
  const result = data as CreateInvoiceResult | null;
  if (!result?.invoice_id) throw new DataError("unknown", "The invoice could not be created.");
  return result;
}

export const invoiceQueries = {
  list: () => queryOptions({ queryKey: queryKeys.invoices.list(), queryFn: fetchInvoices }),
  detail: (id: string) =>
    queryOptions({ queryKey: queryKeys.invoices.detail(id), queryFn: () => fetchInvoice(id) }),
};
