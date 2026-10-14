// Core logic of the create-staff-user Edge Function.
//
// Kept free of Deno and Supabase imports: everything it needs from the outside
// world comes in through `Deps`, so it can be unit-tested with plain `node --test`.
//
// Security model
//  - The caller must send their own session token. We check it, then check in the
//    database (as that caller, under RLS) that they are an active admin.
//  - The only operation that needs the service-role key is creating the sign-in
//    account itself. The profile role and activation are then set AS THE ADMIN, so
//    the normal RLS policies, the role-guard trigger and the activity log all apply.
//  - Admin accounts can't be created here.

export const STAFF_ROLES = ["telecaller", "supervisor"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72; // bcrypt limit

export type CreateRequest = {
  method: string;
  authorization: string | null;
  body: unknown;
};

export type CreateResponse = { status: number; body: Record<string, unknown> };

export type CreateAuthUserResult =
  | { ok: true; id: string }
  | { ok: false; reason: "duplicate" | "weak_password" | "other"; message?: string };

export type Deps = {
  /** Resolves a bearer token to the signed-in user, or null if it isn't valid. */
  authenticate(token: string): Promise<{ id: string } | null>;
  /** The caller's own profile, read through their session (RLS applies). */
  callerProfile(callerId: string): Promise<{ role: string | null; is_active: boolean } | null>;
  /** Creates the sign-in account (service role). The database trigger adds an inactive profile. */
  createAuthUser(input: {
    email: string;
    password: string;
    fullName: string;
  }): Promise<CreateAuthUserResult>;
  /** Sets role, activation and name on the new profile, as the admin caller (RLS applies). */
  finalizeProfile(input: {
    id: string;
    role: StaffRole;
    isActive: boolean;
    fullName: string;
  }): Promise<{ ok: true } | { ok: false; message?: string }>;
  /** Removes an account created moments ago when a later step failed. */
  deleteAuthUser(id: string): Promise<void>;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const reply = (status: number, body: Record<string, unknown>): CreateResponse => ({
  status,
  body,
});
const fail = (status: number, code: string, message: string) =>
  reply(status, { error: { code, message } });

type Parsed =
  | {
      ok: true;
      fullName: string;
      email: string;
      password: string;
      role: StaffRole;
      activate: boolean;
    }
  | { ok: false; response: CreateResponse };

export function parseInput(body: unknown): Parsed {
  const invalid = (message: string): Parsed => ({
    ok: false,
    response: fail(400, "invalid_input", message),
  });
  if (!body || typeof body !== "object") return invalid("Send the user's details as JSON.");
  const b = body as Record<string, unknown>;

  const fullName = typeof b["full_name"] === "string" ? b["full_name"].trim() : "";
  if (fullName.length < 2 || fullName.length > 100) {
    return invalid("Enter the person's full name (2–100 characters).");
  }

  const email = typeof b["email"] === "string" ? b["email"].trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL.test(email)) return invalid("Enter a valid email address.");

  const password = typeof b["password"] === "string" ? b["password"] : "";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return invalid(`The temporary password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return invalid(`The temporary password can be at most ${MAX_PASSWORD_LENGTH} characters.`);
  }

  const role = b["role"];
  if (role === "admin") {
    return {
      ok: false,
      response: fail(
        400,
        "role_not_allowed",
        "Admin accounts can't be created here. Choose Telecaller or Supervisor.",
      ),
    };
  }
  if (typeof role !== "string" || !(STAFF_ROLES as readonly string[]).includes(role)) {
    return invalid("Choose Telecaller or Supervisor.");
  }

  const activate = b["activate"] === undefined ? true : b["activate"] === true;
  return { ok: true, fullName, email, password, role: role as StaffRole, activate };
}

export async function handleCreateStaffUser(
  req: CreateRequest,
  deps: Deps,
): Promise<CreateResponse> {
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Use POST.");

  // 1. Who is calling?
  const token = /^Bearer\s+(.+)$/i.exec(req.authorization ?? "")?.[1]?.trim();
  if (!token) return fail(401, "unauthenticated", "Sign in again to continue.");
  const caller = await deps.authenticate(token).catch(() => null);
  if (!caller) return fail(401, "unauthenticated", "Your session has expired. Sign in again.");

  // 2. Are they an active admin? Checked in the database as the caller, not from the request.
  const profile = await deps.callerProfile(caller.id).catch(() => null);
  if (!profile || profile.role !== "admin" || !profile.is_active) {
    return fail(403, "forbidden", "Only active admins can create staff accounts.");
  }

  // 3. Is the request valid?
  const input = parseInput(req.body);
  if (!input.ok) return input.response;

  // 4. Create the sign-in account.
  const created = await deps
    .createAuthUser({ email: input.email, password: input.password, fullName: input.fullName })
    .catch((): CreateAuthUserResult => ({ ok: false, reason: "other" }));
  if (!created.ok) {
    if (created.reason === "duplicate") {
      return fail(409, "email_exists", "An account with this email already exists.");
    }
    if (created.reason === "weak_password") {
      return fail(
        400,
        "weak_password",
        created.message ?? "That password is too weak. Choose a stronger one.",
      );
    }
    return fail(500, "create_failed", "Couldn't create the account. Try again.");
  }

  // 5. Give it the chosen role and activation, as the admin.
  const finalized = await deps
    .finalizeProfile({
      id: created.id,
      role: input.role,
      isActive: input.activate,
      fullName: input.fullName,
    })
    .catch((): { ok: false } => ({ ok: false }));
  if (!finalized.ok) {
    // Don't leave a half-set-up account behind (it would be an inactive supervisor).
    await deps.deleteAuthUser(created.id).catch(() => undefined);
    return fail(
      500,
      "profile_failed",
      "Couldn't finish setting up the account. Nothing was created.",
    );
  }

  // The password is never echoed back.
  return reply(201, {
    user: {
      id: created.id,
      email: input.email,
      full_name: input.fullName,
      role: input.role,
      is_active: input.activate,
    },
  });
}
