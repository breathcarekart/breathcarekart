import { queryOptions } from "@tanstack/react-query";
import { db, unwrap } from "@/lib/db/client";
import { queryKeys } from "@/lib/db/query-keys";

/** Sales with customer, items, their invoice and who created them. */
export async function fetchSales() {
  return unwrap(
    await db()
      .from("sales")
      .select(
        `*,
        customer:customers(id, name),
        sale_items(*),
        invoices(id, invoice_number, grand_total, amount_paid, status, due_date),
        creator:profiles!sales_created_by_fkey(id, full_name, role)`,
      )
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false }),
  );
}

export type SaleWithRelations = Awaited<ReturnType<typeof fetchSales>>[number];

export const saleQueries = {
  list: () => queryOptions({ queryKey: queryKeys.sales.list(), queryFn: fetchSales }),
};
