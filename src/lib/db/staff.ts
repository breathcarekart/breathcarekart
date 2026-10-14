import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { db } from "@/lib/db/client";
import { DataError, type DataErrorKind } from "@/lib/db/errors";

/** Roles an admin can give to a new account here. Admin accounts aren't created from the app. */
export type StaffRole = "telecaller" | "supervisor";

export type CreateStaffInput = {
  fullName: string;
  email: string;
  password: string;
  role: StaffRole;
  activate: boolean;
};

export type CreatedStaff = {
  id: string;
  email: string;
  full_name: string;
  role: StaffRole;
  is_active: boolean;
};

const kindByCode: Record<string, DataErrorKind> = {
  unauthenticated: "unauthenticated",
  forbidden: "forbidden",
  email_exists: "conflict",
  invalid_input: "invalid",
  role_not_allowed: "invalid",
  weak_password: "invalid",
};

/**
 * Creates a staff account through the create-staff-user Edge Function. The
 * function checks that the caller is an active admin; the browser never sees a
 * service-role key.
 */
export async function createStaffUser(input: CreateStaffInput): Promise<CreatedStaff> {
  const { data, error } = await db().functions.invoke<{ user: CreatedStaff }>("create-staff-user", {
    body: {
      full_name: input.fullName,
      email: input.email,
      password: input.password,
      role: input.role,
      activate: input.activate,
    },
  });

  if (error) throw await toStaffError(error);
  if (!data?.user) throw new DataError("unknown", "The server sent an unexpected reply.");
  return data.user;
}

async function toStaffError(error: unknown): Promise<DataError> {
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response;
    // 404 means the function isn't deployed to this Supabase project yet.
    if (res.status === 404) {
      return new DataError(
        "unknown",
        "Staff creation isn't set up yet. Ask the developer to deploy the create-staff-user function.",
        "function_not_deployed",
      );
    }
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      const code = body.error?.code;
      return new DataError(
        (code && kindByCode[code]) || "unknown",
        body.error?.message ?? "Couldn't create the account.",
        code,
      );
    } catch {
      return new DataError("unknown", "Couldn't create the account. Try again.");
    }
  }
  if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
    return new DataError(
      "network",
      "Couldn't reach the server. Check your connection and try again.",
    );
  }
  return new DataError("unknown", "Couldn't create the account. Try again.");
}
