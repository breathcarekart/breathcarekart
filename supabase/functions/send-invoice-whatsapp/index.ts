// Supabase Edge Function: send an approved WhatsApp template (invoice, payment request,
// rental confirmation, return reminder) through AiSensy (Legacy Campaign API).
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
import {
  handleSendInvoiceWhatsApp,
  type Deps,
  type LoadedInvoice,
  type LoadedRental,
  type SubjectKey,
} from "./handler.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const PDF_BUCKET = "invoice-pdfs";
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

// Shape of the rental query below (the client here is untyped).
type RentalRow = Omit<LoadedRental, "items" | "invoice"> & {
  rental_items:
    | {
        description: string | null;
        quantity: number;
        rate: number | string | null;
        created_at: string;
        equipment_type: { name: string | null } | null;
      }[]
    | null;
  invoices:
    | { invoice_date: string; grand_total: number | string; created_at: string; status: string }[]
    | null;
};

// The whatsapp_messages column and value for one invoice or one rental.
const subjectColumn = (key: SubjectKey): [string, string] =>
  key.invoiceId ? ["invoice_id", key.invoiceId] : ["rental_id", key.rentalId!];

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
    async loadRental(rentalId) {
      const { data, error } = await asCaller
        .from("rentals")
        .select(
          `id, rental_number, status, start_date, due_date, returned_date, customer_id,
           customer:customers(id, name, phone, whatsapp, address, city),
           rental_items(description, quantity, rate, created_at, equipment_type:equipment_types(name)),
           invoices(invoice_date, grand_total, created_at, status)`,
        )
        .eq("id", rentalId)
        .maybeSingle();
      if (error) console.error("send-invoice-whatsapp: rental read failed", error.code);
      if (!data) return null;
      const r = data as unknown as RentalRow;
      // The invoice the rental was created with: the earliest one that isn't cancelled.
      const invoice =
        (r.invoices ?? [])
          .filter((i) => i.status !== "cancelled" && i.status !== "draft")
          .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0] ?? null;
      const rental: LoadedRental = {
        id: r.id,
        rental_number: r.rental_number,
        status: r.status,
        start_date: r.start_date,
        due_date: r.due_date,
        returned_date: r.returned_date,
        customer_id: r.customer_id,
        customer: r.customer ?? null,
        items: (r.rental_items ?? []).map((i) => ({
          description: i.description,
          type_name: i.equipment_type?.name ?? null,
          quantity: i.quantity,
          rate: i.rate,
          created_at: i.created_at,
        })),
        invoice: invoice
          ? { invoice_date: invoice.invoice_date, grand_total: invoice.grand_total }
          : null,
      };
      return rental;
    },
    async loadSettings() {
      const { data } = await asCaller
        .from("company_settings")
        // "*" so the function works before and after the business-settings migration.
        .select("*")
        .maybeSingle();
      return data;
    },
    async priorSuccess(key, campaignName, mode) {
      const [column, value] = subjectColumn(key);
      const { count } = await admin
        .from(LOG_TABLE)
        .select("id", { count: "exact", head: true })
        .eq(column, value)
        .eq("campaign_name", campaignName)
        .eq("mode", mode)
        .eq("status", "sent");
      return (count ?? 0) > 0;
    },
    async expireStale(key, campaignName, olderThan) {
      const [column, value] = subjectColumn(key);
      await admin
        .from(LOG_TABLE)
        .update({
          status: "failed",
          error_message: "Timed out: no result was recorded for this send.",
          completed_at: new Date().toISOString(),
        })
        .eq(column, value)
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
        .from(PDF_BUCKET)
        .upload(path, bytes, { contentType: "application/pdf", upsert: false });
      if (error) console.error("send-invoice-whatsapp: PDF upload failed", error.message);
      return !error;
    },
    async signUrl(bucket, path, expiresInSeconds) {
      const { data, error } = await admin.storage
        .from(bucket)
        .createSignedUrl(path, expiresInSeconds);
      if (error) console.error("send-invoice-whatsapp: signed URL failed", error.message);
      return data?.signedUrl ?? null;
    },
    async checkMediaUrl(signedUrl, kind) {
      // Fetch the first bytes over the public internet, the way AiSensy will.
      const res = await fetch(signedUrl, { headers: { Range: "bytes=0-1023" } });
      if (res.status !== 200 && res.status !== 206) return false;
      const type = res.headers.get("content-type") ?? "";
      const head = new Uint8Array(await res.arrayBuffer()).slice(0, 12);
      if (kind === "pdf")
        return type.includes("pdf") && String.fromCharCode(...head.slice(0, 5)) === "%PDF-";
      // PNG, JPEG or WebP signature.
      const png = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
      const jpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
      const webp =
        String.fromCharCode(...head.slice(0, 4)) === "RIFF" &&
        String.fromCharCode(...head.slice(8, 12)) === "WEBP";
      return type.startsWith("image/") && (png || jpeg || webp);
    },
    async sendCampaign(payload) {
      if (!apiKey) return { kind: "network_error" };
      return await postCampaign(payload, apiKey);
    },
    async logActivity(entry) {
      const { error } = await admin.from("activity_log").insert({
        entity_type: entry.entityType,
        entity_id: entry.entityId,
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
