import { supabase } from "@/lib/supabase";
import { DataError, assertConfigured, toDataError } from "@/lib/db/errors";

/** The typed Supabase client, after checking the environment is configured. */
export function db() {
  assertConfigured();
  return supabase;
}

type SupabaseResponse = { data: unknown; error: unknown };

/** Returns `data` from a Supabase response, or throws a normalised DataError. */
export function unwrap<R extends SupabaseResponse>(response: R): NonNullable<R["data"]> {
  if (response.error) throw toDataError(response.error);
  if (response.data == null) {
    throw new DataError("not_found", "That record could not be found.");
  }
  return response.data as NonNullable<R["data"]>;
}

/** Like `unwrap`, but treats a missing row as `null` instead of an error (for `.maybeSingle()`). */
export function unwrapMaybe<R extends SupabaseResponse>(
  response: R,
): NonNullable<R["data"]> | null {
  if (response.error) throw toDataError(response.error);
  return (response.data ?? null) as NonNullable<R["data"]> | null;
}
