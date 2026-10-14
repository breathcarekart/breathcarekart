import { queryOptions } from "@tanstack/react-query";
import { db, unwrap, unwrapMaybe } from "@/lib/db/client";
import { DataError } from "@/lib/db/errors";
import { queryKeys } from "@/lib/db/query-keys";
import type { UpdateRow } from "@/lib/db/types";

/** Profile of the signed-in user (null if the auth user has no profile row). */
export async function fetchCurrentProfile() {
  const client = db();
  const { data } = await client.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId)
    throw new DataError("unauthenticated", "Your session has expired. Please sign in again.");
  return unwrapMaybe(await client.from("profiles").select("*").eq("id", userId).maybeSingle());
}

/** Staff list (office roles see everyone; RLS limits others to themselves). */
export async function fetchProfiles() {
  return unwrap(await db().from("profiles").select("*").order("full_name"));
}

/**
 * Role/activation changes are admin-only (enforced by RLS + trigger);
 * anyone may update their own name and phone.
 */
export async function updateProfile(
  id: string,
  patch: Pick<UpdateRow<"profiles">, "full_name" | "phone" | "role" | "is_active">,
) {
  return unwrap(await db().from("profiles").update(patch).eq("id", id).select().single());
}

export const profileQueries = {
  current: () =>
    queryOptions({ queryKey: queryKeys.profiles.current(), queryFn: fetchCurrentProfile }),
  list: () => queryOptions({ queryKey: queryKeys.profiles.list(), queryFn: fetchProfiles }),
};
