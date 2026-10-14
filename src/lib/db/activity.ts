import { queryOptions } from "@tanstack/react-query";
import { db, unwrap } from "@/lib/db/client";
import { queryKeys } from "@/lib/db/query-keys";

const activitySelect = "*, actor:profiles(id, full_name, role)";

/** Most recent audit entries with the acting user (RLS: admin all, telecaller non-user entries). */
export async function fetchActivity(limit = 200) {
  return unwrap(
    await db()
      .from("activity_log")
      .select(activitySelect)
      .order("created_at", { ascending: false })
      .limit(limit),
  );
}

export type ActivityItem = Awaited<ReturnType<typeof fetchActivity>>[number];

/** Activity for a set of records, e.g. a customer and their rentals, sales, invoices and payments. */
export async function fetchActivityForEntities(ids: string[]) {
  if (ids.length === 0) return [];
  return unwrap(
    await db()
      .from("activity_log")
      .select(activitySelect)
      .in("entity_id", ids)
      .order("created_at", { ascending: false })
      .limit(200),
  );
}

export const activityQueries = {
  recent: (limit = 200) =>
    queryOptions({ queryKey: queryKeys.activity.list(limit), queryFn: () => fetchActivity(limit) }),
  forEntities: (ids: string[]) =>
    queryOptions({
      queryKey: queryKeys.activity.entities(ids),
      queryFn: () => fetchActivityForEntities(ids),
    }),
};
