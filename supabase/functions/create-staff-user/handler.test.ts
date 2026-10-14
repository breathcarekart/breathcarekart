/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { handleCreateStaffUser, type CreateRequest, type Deps } from "./handler.ts";

const ADMIN = { id: "admin-1" };

const valid = {
  full_name: "Test Person",
  email: "New.Person@Example.com",
  password: "Temp#12345",
  role: "telecaller",
};

type Calls = { created: unknown[]; finalized: unknown[]; deleted: string[] };

function setup(overrides: Partial<Deps> = {}) {
  const calls: Calls = { created: [], finalized: [], deleted: [] };
  const deps: Deps = {
    authenticate: async (token) => (token === "good-token" ? ADMIN : null),
    callerProfile: async () => ({ role: "admin", is_active: true }),
    createAuthUser: async (input) => {
      calls.created.push(input);
      return { ok: true, id: "new-user-1" };
    },
    finalizeProfile: async (input) => {
      calls.finalized.push(input);
      return { ok: true };
    },
    deleteAuthUser: async (id) => {
      calls.deleted.push(id);
    },
    ...overrides,
  };
  const run = (req: Partial<CreateRequest> = {}) =>
    handleCreateStaffUser(
      { method: "POST", authorization: "Bearer good-token", body: valid, ...req },
      deps,
    );
  return { run, calls };
}

const errorCode = (r: { body: Record<string, unknown> }) =>
  (r.body["error"] as { code: string } | undefined)?.code;

// ── Authorization ────────────────────────────────────────────────────────────
test("no token → 401, nothing created", async () => {
  const { run, calls } = setup();
  for (const authorization of [null, "", "Bearer ", "Basic abc"]) {
    const r = await run({ authorization });
    assert.equal(r.status, 401);
  }
  assert.equal(calls.created.length, 0);
});

test("invalid or expired token → 401", async () => {
  const { run, calls } = setup();
  const r = await run({ authorization: "Bearer stolen-token" });
  assert.equal(r.status, 401);
  assert.equal(calls.created.length, 0);
});

test("telecaller, supervisor and missing profile → 403, nothing created", async () => {
  for (const profile of [
    { role: "telecaller", is_active: true },
    { role: "supervisor", is_active: true },
    null,
  ]) {
    const { run, calls } = setup({ callerProfile: async () => profile });
    const r = await run();
    assert.equal(r.status, 403, JSON.stringify(profile));
    assert.equal(errorCode(r), "forbidden");
    assert.equal(calls.created.length, 0);
  }
});

test("inactive admin → 403", async () => {
  const { run, calls } = setup({
    callerProfile: async () => ({ role: "admin", is_active: false }),
  });
  const r = await run();
  assert.equal(r.status, 403);
  assert.equal(calls.created.length, 0);
});

test("token lookup throwing is treated as unauthenticated, not a crash", async () => {
  const { run } = setup({
    authenticate: async () => {
      throw new Error("network");
    },
  });
  assert.equal((await run()).status, 401);
});

test("only POST is accepted", async () => {
  const { run } = setup();
  assert.equal((await run({ method: "GET" })).status, 405);
});

// ── Invalid input / role ─────────────────────────────────────────────────────
test("admin role is rejected, nothing created", async () => {
  const { run, calls } = setup();
  const r = await run({ body: { ...valid, role: "admin" } });
  assert.equal(r.status, 400);
  assert.equal(errorCode(r), "role_not_allowed");
  assert.equal(calls.created.length, 0);
});

test("invalid roles are rejected", async () => {
  const { run, calls } = setup();
  for (const role of ["superuser", "", "Telecaller", null, 5, undefined, ["admin"]]) {
    const r = await run({ body: { ...valid, role } });
    assert.equal(r.status, 400, String(role));
  }
  assert.equal(calls.created.length, 0);
});

test("bad name, email and password are rejected", async () => {
  const { run, calls } = setup();
  const bad = [
    { ...valid, full_name: "A" },
    { ...valid, full_name: "" },
    { ...valid, email: "not-an-email" },
    { ...valid, email: "a@b" },
    { ...valid, password: "short" },
    { ...valid, password: "x".repeat(73) },
    { ...valid, password: undefined },
    null,
    "string body",
  ];
  for (const body of bad) assert.equal((await run({ body })).status, 400, JSON.stringify(body));
  assert.equal(calls.created.length, 0);
});

// ── Duplicate email ──────────────────────────────────────────────────────────
test("duplicate email → 409 and no profile change or cleanup of the existing user", async () => {
  const { run, calls } = setup({
    createAuthUser: async () => ({ ok: false, reason: "duplicate" }),
  });
  const r = await run();
  assert.equal(r.status, 409);
  assert.equal(errorCode(r), "email_exists");
  assert.equal(calls.finalized.length, 0);
  assert.equal(calls.deleted.length, 0);
});

test("weak password from the auth service → 400", async () => {
  const { run } = setup({
    createAuthUser: async () => ({ ok: false, reason: "weak_password", message: "Too common" }),
  });
  const r = await run();
  assert.equal(r.status, 400);
  assert.equal(errorCode(r), "weak_password");
});

// ── Success ──────────────────────────────────────────────────────────────────
test("success: lower-cased email, chosen role, active, password never returned", async () => {
  const { run, calls } = setup();
  const r = await run();
  assert.equal(r.status, 201);
  assert.deepEqual(calls.created, [
    { email: "new.person@example.com", password: "Temp#12345", fullName: "Test Person" },
  ]);
  assert.deepEqual(calls.finalized, [
    { id: "new-user-1", role: "telecaller", isActive: true, fullName: "Test Person" },
  ]);
  assert.deepEqual(r.body["user"], {
    id: "new-user-1",
    email: "new.person@example.com",
    full_name: "Test Person",
    role: "telecaller",
    is_active: true,
  });
  assert.ok(!JSON.stringify(r.body).includes("Temp#12345"));
});

test("success as supervisor, left inactive when asked", async () => {
  const { run, calls } = setup();
  const r = await run({ body: { ...valid, role: "supervisor", activate: false } });
  assert.equal(r.status, 201);
  assert.deepEqual(calls.finalized, [
    { id: "new-user-1", role: "supervisor", isActive: false, fullName: "Test Person" },
  ]);
});

test("profile step failing removes the new account and reports failure", async () => {
  const { run, calls } = setup({ finalizeProfile: async () => ({ ok: false }) });
  const r = await run();
  assert.equal(r.status, 500);
  assert.equal(errorCode(r), "profile_failed");
  assert.deepEqual(calls.deleted, ["new-user-1"]);
});

test("unexpected failure creating the account → 500 and no profile step", async () => {
  const { run, calls } = setup({
    createAuthUser: async () => {
      throw new Error("boom");
    },
  });
  const r = await run();
  assert.equal(r.status, 500);
  assert.equal(calls.finalized.length, 0);
});
