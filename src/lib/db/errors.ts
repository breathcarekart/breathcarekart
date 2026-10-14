import { isSupabaseConfigured } from "@/lib/supabase";

export type DataErrorKind =
  | "not_configured"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "invalid"
  | "network"
  | "unknown";

/** Normalised error thrown by every data-layer function. */
export class DataError extends Error {
  readonly kind: DataErrorKind;
  readonly code: string | undefined;

  constructor(kind: DataErrorKind, message: string, code?: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DataError";
    this.kind = kind;
    this.code = code;
  }
}

const friendly: Record<DataErrorKind, string> = {
  not_configured: "The database connection isn't configured for this environment.",
  unauthenticated: "Your session has expired. Please sign in again.",
  forbidden: "You don't have permission to do that.",
  not_found: "That record could not be found.",
  conflict: "A record with these details already exists.",
  invalid: "Some of the details are invalid. Please check and try again.",
  network: "Couldn't reach the server. Check your connection and try again.",
  unknown: "Something went wrong. Please try again.",
};

/** Throws when the Supabase env vars are missing, so we never query the placeholder host. */
export function assertConfigured() {
  if (!isSupabaseConfigured) {
    throw new DataError("not_configured", friendly.not_configured);
  }
}

type PostgrestLikeError = { code?: string; message?: string; details?: string; status?: number };

/**
 * Maps Postgres / PostgREST / auth / network errors to a DataError.
 * Codes: https://postgrest.org/en/stable/references/errors.html
 */
export function toDataError(error: unknown): DataError {
  if (error instanceof DataError) return error;

  const e = (error ?? {}) as PostgrestLikeError;
  const code = e.code;
  let kind: DataErrorKind = "unknown";

  // 42501 insufficient_privilege / RLS violation
  if (code === "42501") kind = "forbidden";
  // JWT invalid (301), anonymous access disabled (302), JWT expired / bad claims (303)
  else if (["PGRST301", "PGRST302", "PGRST303"].includes(code ?? "") || e.status === 401)
    kind = "unauthenticated";
  // .single() matched 0 rows
  else if (code === "PGRST116") kind = "not_found";
  // unique_violation
  else if (code === "23505") kind = "conflict";
  // not_null / foreign_key / check violation, bad input syntax
  else if (["23502", "23503", "23514", "22P02"].includes(code ?? "")) kind = "invalid";
  // A thrown fetch error, or postgrest-js's wrapped form of one: it does not throw,
  // it returns { code: "", message: "TypeError: Failed to fetch" } (or "FetchError: …").
  else if (
    (error instanceof TypeError && /fetch/i.test(error.message)) ||
    (!code && /^(TypeError|FetchError|AbortError)\b/.test(e.message ?? ""))
  )
    kind = "network";

  // P0001 = RAISE EXCEPTION in our workflow functions. Those messages are written
  // for staff ("BiPAP Machine BIP-001 is not available"), so show them as-is.
  if (code === "P0001" && e.message) {
    return new DataError("invalid", e.message, code, { cause: error });
  }
  // Our functions' permission errors (42501) also carry a readable message.
  if (code === "42501" && e.message && /^You don't have permission/.test(e.message)) {
    return new DataError("forbidden", e.message, code, { cause: error });
  }

  return new DataError(kind, friendly[kind], code, { cause: error });
}

/** Errors that will not succeed on retry. */
export function isPermanentError(error: unknown) {
  const kind = toDataError(error).kind;
  return kind !== "network" && kind !== "unknown";
}
