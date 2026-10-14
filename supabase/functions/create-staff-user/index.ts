// Supabase Edge Function: create a staff account from the Users & Roles screen.
// Logic lives in ./handler.ts (unit-tested). This file only wires it to Supabase.
//
// Needs no secrets set by hand: the hosted runtime provides SUPABASE_URL,
// SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY to every Edge Function. The
// service-role key stays inside this function and never reaches the browser.
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCreateStaffUser, type Deps } from "./handler.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) {
    console.error("create-staff-user: runtime keys are missing");
    return json(500, {
      error: { code: "not_configured", message: "The function isn't configured." },
    });
  }

  const authorization = req.headers.get("Authorization");
  // Acts as the signed-in admin, so RLS and the role-guard trigger apply to what it does.
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Only used to create/remove the sign-in account itself.
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const deps: Deps = {
    async authenticate(token) {
      const { data, error } = await admin.auth.getUser(token);
      return error || !data.user ? null : { id: data.user.id };
    },
    async callerProfile(callerId) {
      const { data } = await asCaller
        .from("profiles")
        .select("role, is_active")
        .eq("id", callerId)
        .maybeSingle();
      return data;
    },
    async createAuthUser({ email, password, fullName }) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (error || !data.user) {
        const code = (error as { code?: string } | null)?.code;
        const message = error?.message ?? "";
        if (code === "email_exists" || /already (been )?registered/i.test(message)) {
          return { ok: false, reason: "duplicate" };
        }
        if (code === "weak_password") return { ok: false, reason: "weak_password", message };
        console.error("create-staff-user: createUser failed", code, message);
        return { ok: false, reason: "other" };
      }
      return { ok: true, id: data.user.id };
    },
    async finalizeProfile({ id, role, isActive, fullName }) {
      const { data, error } = await asCaller
        .from("profiles")
        .update({ role, is_active: isActive, full_name: fullName })
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error || !data) {
        console.error("create-staff-user: profile update failed", error?.code, error?.message);
        return { ok: false };
      }
      return { ok: true };
    },
    async deleteAuthUser(id) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) console.error("create-staff-user: cleanup failed", error.message);
    },
  };

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // Handled as invalid input below.
  }

  const result = await handleCreateStaffUser({ method: req.method, authorization, body }, deps);
  return json(result.status, result.body);
});
