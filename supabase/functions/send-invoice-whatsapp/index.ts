// Supabase Edge Function: send an invoice on WhatsApp through AiSensy (Legacy Campaign API).
// Logic lives in ./handler.ts (unit-tested); this file only wires it to Supabase.
//
// Secrets (Edge Function secrets, never in the browser or Git):
//   AISENSY_API_KEY            required for test and live sends; sent ONLY as `apiKey` in the JSON body
//   WHATSAPP_TEST_DESTINATION  internal number that receives every test-mode send
//   WHATSAPP_LIVE_ENABLED      must be exactly "true" before live sends are allowed (off by default)
// Provided by Supabase automatically: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from "npm:@supabase/supabase-js@2";
import { BRAND_LOGO_DATA_URL } from "../_shared/brand-logo.ts";
import { renderInvoicePdf } from "../_shared/invoice-pdf-layout.ts";
import { postCampaign } from "./aisensy.ts";
import { handleSendInvoiceWhatsApp, type Deps, type LoadedInvoice } from "./handler.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const BUCKET = "invoice-pdfs";
const LOG_TABLE = "whatsapp_messages";
const SIGNED_URL_SECONDS = 24 * 60 * 60; // approved: 24 hours
const STALE_SENDING_MINUTES = 10;

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
    console.error("send-invoice-whatsapp: runtime keys are missing");
    return json(500, {
      ok: false,
      error: { code: "not_configured", message: "The function isn't configured." },
    });
  }
  const apiKey = Deno.env.get("AISENSY_API_KEY")?.trim() || null;

  const authorization = req.headers.get("Authorization");
  // Reads as the signed-in user, so RLS decides what they can see.
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Server-side only: message log, PDF upload, signed URL.
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const deps: Deps = {
    async authenticate(token) {
      const { data, error } = await admin.auth.getUser(token);
      return error || !data.user ? null : { id: data.user.id };
    },
    async callerProfile(userId) {
      const { data } = await asCaller
        .from("profiles")
        .select("role, is_active")
        .eq("id", userId)
        .maybeSingle();
      return data;
    },
    async loadInvoice(invoiceId) {
      const { data, error } = await asCaller
        .from("invoices")
        .select(
          `id, invoice_number, invoice_date, due_date, period_start, period_end, transaction_type,
           subtotal, discount, tax_rate, tax_amount, grand_total, amount_paid, status, notes, customer_id,
           customer:customers(id, name, phone, whatsapp, address, city),
           items:invoice_items(description, rental_period, quantity, rate, amount, created_at)`,
        )
        .eq("id", invoiceId)
        .maybeSingle();
      if (error) console.error("send-invoice-whatsapp: invoice read failed", error.code);
      return (data as unknown as LoadedInvoice | null) ?? null;
    },
    async loadSettings() {
      const { data } = await asCaller
        .from("company_settings")
        // "*" so the function works before and after the business-settings migration.
        .select("*")
        .maybeSingle();
      return data;
    },
    async priorSuccess(invoiceId, mode) {
      const { count } = await admin
        .from(LOG_TABLE)
        .select("id", { count: "exact", head: true })
        .eq("invoice_id", invoiceId)
        .eq("mode", mode)
        .eq("status", "sent");
      return (count ?? 0) > 0;
    },
    async expireStale(invoiceId, campaignName, olderThan) {
      await admin
        .from(LOG_TABLE)
        .update({
          status: "failed",
          error_message: "Timed out: no result was recorded for this send.",
          completed_at: new Date().toISOString(),
        })
        .eq("invoice_id", invoiceId)
        .eq("campaign_name", campaignName)
        .eq("status", "sending")
        .lt("created_at", olderThan.toISOString());
    },
    async claimSend(row) {
      const { data, error } = await admin.from(LOG_TABLE).insert(row).select("id").single();
      if (!error && data) return { ok: true, id: data.id as string };
      if (error?.code === "23505") return { ok: false, reason: "in_progress" };
      if (
        error?.hint === "already_sent" ||
        /already sent on WhatsApp/i.test(error?.message ?? "")
      ) {
        return { ok: false, reason: "already_sent" };
      }
      console.error("send-invoice-whatsapp: could not record the send", error?.code);
      return { ok: false, reason: "other" };
    },
    async insertLog(row) {
      const { data, error } = await admin.from(LOG_TABLE).insert(row).select("id").single();
      if (error) console.error("send-invoice-whatsapp: could not write the log", error.code);
      return data ? { id: data.id as string } : null;
    },
    async updateLog(id, patch) {
      const { error } = await admin.from(LOG_TABLE).update(patch).eq("id", id);
      if (error) console.error("send-invoice-whatsapp: could not update the log", error.code);
    },
    async renderPdf(data) {
      const doc = renderInvoicePdf(data, BRAND_LOGO_DATA_URL);
      return new Uint8Array(doc.output("arraybuffer"));
    },
    async uploadPdf(path, bytes) {
      const { error } = await admin.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: "application/pdf", upsert: false });
      if (error) console.error("send-invoice-whatsapp: PDF upload failed", error.message);
      return !error;
    },
    async signUrl(path, expiresInSeconds) {
      const { data, error } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(path, expiresInSeconds);
      if (error) console.error("send-invoice-whatsapp: signed URL failed", error.message);
      return data?.signedUrl ?? null;
    },
    async checkPdfUrl(signedUrl) {
      // Fetch the first bytes over the public internet, the way AiSensy will.
      const res = await fetch(signedUrl, { headers: { Range: "bytes=0-1023" } });
      if (res.status !== 200 && res.status !== 206) return false;
      const type = res.headers.get("content-type") ?? "";
      const head = new Uint8Array(await res.arrayBuffer()).slice(0, 5);
      return type.includes("pdf") && String.fromCharCode(...head) === "%PDF-";
    },
    async sendCampaign(payload) {
      if (!apiKey) return { kind: "network_error" };
      return await postCampaign(payload, apiKey);
    },
    async logActivity(entry) {
      const { error } = await admin.from("activity_log").insert({
        entity_type: "invoice",
        entity_id: entry.invoiceId,
        action: entry.action,
        description: entry.description,
        actor_id: entry.actorId,
        metadata: entry.metadata,
      });
      if (error) console.error("send-invoice-whatsapp: activity log failed", error.code);
    },
    randomId: () => crypto.randomUUID(),
    now: () => new Date(),
  };

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // Reported as invalid input by the handler.
  }

  const result = await handleSendInvoiceWhatsApp(
    { method: req.method, authorization, body },
    deps,
    {
      apiKeyConfigured: !!apiKey,
      testDestination: Deno.env.get("WHATSAPP_TEST_DESTINATION") ?? null,
      liveEnabled: Deno.env.get("WHATSAPP_LIVE_ENABLED") === "true",
      signedUrlSeconds: SIGNED_URL_SECONDS,
      staleAfterMinutes: STALE_SENDING_MINUTES,
    },
  );
  return json(result.status, result.body);
});
