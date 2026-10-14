import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const url = import.meta.env["VITE_SUPABASE_URL"];
const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"];

/** True when both public Supabase env vars are present. Data calls refuse to run otherwise. */
export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  console.warn("Supabase env vars missing — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
}

const isBrowser = typeof window !== "undefined";

// Falls back to a placeholder so the client can construct without throwing when
// env vars aren't set yet (local dev without .env.local). Auth calls fail cleanly
// at call-time, and the data layer checks isSupabaseConfigured before querying.
//
// The session lives in browser storage, so persistence and refresh only run in
// the browser; protected routes render client-side only (ssr: false).
export const supabase = createClient<Database>(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key",
  {
    auth: {
      persistSession: isBrowser,
      autoRefreshToken: isBrowser,
      detectSessionInUrl: isBrowser,
    },
  },
);
