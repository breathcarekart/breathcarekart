/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { assignableRoles, canAccess, canManageUser, roles, type Role } from "./roles.ts";

// Every screen in src/routes/_app.*, by path.
const screens = [
  "/dashboard",
  "/profile",
  "/rentals",
  "/deliveries/r-1",
  "/inventory",
  "/inventory/new",
  "/inventory/e-1",
  "/inventory/rental-logs",
  "/inventory/sales-logs",
  "/customers",
  "/customers/new",
  "/customers/c-1",
  "/customers/edit/c-1",
  "/sales",
  "/invoices",
  "/invoices/new",
  "/invoices/i-1",
  "/payments",
  "/users",
  "/activity",
  "/settings",
  "/reports",
];

test("admin can open every screen, including Reports", () => {
  for (const path of screens) assert.equal(canAccess("admin", path), true, path);
});

test("telecaller can open every admin screen except Reports", () => {
  for (const path of screens) {
    assert.equal(
      canAccess("telecaller", path),
      canAccess("admin", path) && path !== "/reports",
      path,
    );
  }
});

test("Reports is blocked for telecallers on any URL under it", () => {
  for (const path of ["/reports", "/reports/", "/reports/anything", "/reports?tab=sale"]) {
    const pathname = path.split("?")[0]!;
    assert.equal(canAccess("telecaller", pathname), false, path);
    assert.equal(canAccess("admin", pathname), true, path);
  }
  // A different screen that only starts with the same letters isn't caught by mistake.
  assert.equal(canAccess("telecaller", "/reportsx"), true);
});

test("supervisor access is unchanged", () => {
  const allowed = [
    "/dashboard",
    "/profile",
    "/rentals",
    "/deliveries/r-1",
    "/inventory/rental-logs",
  ];
  for (const path of screens) {
    assert.equal(canAccess("supervisor", path), allowed.includes(path), path);
  }
});

test("admins manage every account; telecallers every account except admins", () => {
  for (const target of roles) assert.equal(canManageUser("admin", target), true);
  assert.equal(canManageUser("telecaller", "telecaller"), true);
  assert.equal(canManageUser("telecaller", "supervisor"), true);
  assert.equal(canManageUser("telecaller", "admin"), false);
  for (const target of roles) assert.equal(canManageUser("supervisor", target), false);
});

test("only admins can give the admin role", () => {
  assert.deepEqual(assignableRoles("admin"), roles);
  assert.deepEqual(assignableRoles("telecaller"), ["telecaller", "supervisor"] satisfies Role[]);
});
