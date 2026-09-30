import { createClient } from "@supabase/supabase-js";

const url = import.meta.env["VITE_SUPABASE_URL"];
const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"];

if (!url || !anonKey) {
  console.warn("Supabase env vars missing — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
}

// Falls back to a placeholder so the client can construct without throwing when
// env vars aren't set yet — auth calls will fail cleanly at call-time instead.
export const supabase = createClient(url || "https://placeholder.supabase.co", anonKey || "placeholder-anon-key");
