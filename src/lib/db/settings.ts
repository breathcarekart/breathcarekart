import { queryOptions } from "@tanstack/react-query";
import { db, unwrap, unwrapMaybe } from "@/lib/db/client";
import { queryKeys } from "@/lib/db/query-keys";
import type { UpdateRow } from "@/lib/db/types";

/** The single company settings row (name seeded; GSTIN, address etc. entered by an admin). */
export async function fetchCompanySettings() {
  return unwrapMaybe(await db().from("company_settings").select("*").eq("id", true).maybeSingle());
}

export async function updateCompanySettings(
  patch: Pick<
    UpdateRow<"company_settings">,
    "company_name" | "address" | "phone" | "email" | "gstin" | "invoice_prefix" | "invoice_terms"
  >,
) {
  return unwrap(await db().from("company_settings").update(patch).eq("id", true).select().single());
}

export const settingsQueries = {
  company: () =>
    queryOptions({
      queryKey: queryKeys.settings.company(),
      queryFn: fetchCompanySettings,
      staleTime: 5 * 60_000,
    }),
};
