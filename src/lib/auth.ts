import { redirect, type ParsedLocation } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session;
}

/**
 * Route guard for `beforeLoad`. Sends signed-out users to the login page and
 * remembers where they were going. Only meaningful in the browser (the session
 * lives in browser storage), so guarded routes must set `ssr: false`.
 */
export async function requireSession(location: ParsedLocation) {
  const session = await getSession();
  if (!session) {
    throw redirect({ to: "/", search: { redirect: location.href } });
  }
  return session;
}

/**
 * Returns `value` if it is a same-origin path (e.g. "/invoices/123?tab=x"),
 * otherwise null. Prevents open redirects via the login `redirect` param.
 */
export function safeRedirectPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value === "/" || value.startsWith("/?")) return null;
  return value;
}
