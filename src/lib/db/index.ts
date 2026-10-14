// Data-access layer: typed Supabase reads and writes exposed as functions and
// TanStack Query options. Business workflows call database functions (RPCs) so
// they run atomically and are authorised server-side.
export * from "@/lib/db/types";
export * from "@/lib/db/errors";
export { db, unwrap, unwrapMaybe } from "@/lib/db/client";
export { queryKeys, workflowKeys } from "@/lib/db/query-keys";
export * from "@/lib/db/profiles";
export * from "@/lib/db/settings";
export * from "@/lib/db/equipment";
export * from "@/lib/db/customers";
export * from "@/lib/db/rentals";
export * from "@/lib/db/sales";
export * from "@/lib/db/invoices";
export * from "@/lib/db/payments";
export * from "@/lib/db/deliveries";
export * from "@/lib/db/activity";
