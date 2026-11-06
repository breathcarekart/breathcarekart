// Role-aware UI: which screens each role sees in navigation and pages.
//
// This only shapes the interface. Real enforcement is in the database:
// Row Level Security and the workflow functions check the caller's role from
// `profiles`, so editing this file (or the browser) grants nothing.
import { createContext, useContext } from "react";
import type { Profile } from "@/lib/db/types";

export type Role = "admin" | "telecaller" | "supervisor";

export const roles: Role[] = ["admin", "telecaller", "supervisor"];

export const roleLabels: Record<Role, string> = {
  admin: "Admin",
  telecaller: "Telecaller",
  supervisor: "Supervisor",
};

export const roleLabel = (role: Role) => roleLabels[role];

/** Narrows the database's text role; unknown values get the least access. */
export const toRole = (value: string | null | undefined): Role =>
  value === "admin" || value === "telecaller" ? value : "supervisor";

const ALL: Role[] = ["admin", "telecaller", "supervisor"];
/** Admins and telecallers: telecallers have admin-level access except Reports. */
const OFFICE: Role[] = ["admin", "telecaller"];
const ADMIN: Role[] = ["admin"];

/** Which roles see each area. The longest matching path prefix wins. */
const routeAccess: [prefix: string, roles: Role[]][] = [
  ["/dashboard", ALL],
  ["/profile", ALL],
  ["/rentals", ALL],
  ["/deliveries", ALL],
  ["/inventory/rental-logs", ALL],
  ["/inventory/sales-logs", OFFICE],
  ["/inventory", OFFICE],
  ["/customers", OFFICE],
  ["/sales", OFFICE],
  ["/invoices", OFFICE],
  ["/payments", OFFICE],
  ["/reports", ADMIN],
  ["/users", OFFICE],
  ["/activity", OFFICE],
  ["/settings", OFFICE],
];

export function canAccess(role: Role, pathname: string) {
  const match = routeAccess
    .filter(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    .sort((a, b) => b[0].length - a[0].length)[0];
  return match ? match[1].includes(role) : true;
}

/** Admin-level access (everything but Reports for telecallers). */
export const isOfficeRole = (role: Role) => role === "admin" || role === "telecaller";

/**
 * Staff accounts a signed-in user may change. Admin accounts stay admin-only, so a
 * telecaller can't make themselves (or anyone) an admin and reach Reports that way.
 * The database enforces the same rule (profiles policies and role-guard trigger).
 */
export const canManageUser = (viewer: Role, target: Role) =>
  viewer === "admin" || (isOfficeRole(viewer) && target !== "admin");

/** Roles a signed-in user may give to an account they can manage. */
export const assignableRoles = (viewer: Role): Role[] =>
  viewer === "admin" ? roles : roles.filter((r) => r !== "admin");

/** Human-readable access summary per role, for the Users & Roles screen. */
export const roleSummaries: Record<Role, string> = {
  admin: "Full access, including users & roles, activity log and settings.",
  telecaller: "Same as admin, except reports. Can't change admin accounts.",
  supervisor: "Rentals assigned to them, delivery status and delivery photos.",
};

export type CurrentUser = {
  profile: Profile;
  role: Role;
  /** Display name: full name, else email. */
  name: string;
};

export const CurrentUserContext = createContext<CurrentUser | null>(null);

/** The signed-in staff member. Only available inside the protected app layout. */
export function useCurrentUser() {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) throw new Error("useCurrentUser must be used inside CurrentUserProvider");
  return ctx;
}
