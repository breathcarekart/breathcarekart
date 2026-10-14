// WhatsApp invoice delivery — service boundary.
//
// Sending must happen server-side: a Supabase Edge Function named
// `send-invoice-whatsapp` will hold the WhatsApp Business API credentials
// (never the browser), load the invoice under the caller's permissions,
// render/attach the PDF, send it to the customer's number and record the
// result. Until that function is deployed and VITE_WHATSAPP_ENABLED=true is
// set, the app reports "not configured" and sends nothing.
import { supabase } from "@/lib/supabase";
import { DataError, assertConfigured, toDataError } from "@/lib/db/errors";
import { phoneDigits } from "@/lib/format";

export const WHATSAPP_FUNCTION = "send-invoice-whatsapp";

/** Whether invoice sending is switched on for this environment. */
export const isWhatsAppConfigured = () => import.meta.env["VITE_WHATSAPP_ENABLED"] === "true";

export type SendInvoiceResult = { status: "sent" | "queued"; messageId?: string };

/** Asks the server to send the invoice. Never reports success unless the server does. */
export async function sendInvoiceViaWhatsApp(
  invoiceId: string,
  message: string,
): Promise<SendInvoiceResult> {
  if (!isWhatsAppConfigured()) {
    throw new DataError("not_configured", "WhatsApp integration is not configured.");
  }
  assertConfigured();
  const { data, error } = await supabase.functions.invoke<SendInvoiceResult>(WHATSAPP_FUNCTION, {
    body: { invoice_id: invoiceId, message },
  });
  if (error) throw toDataError(error);
  if (!data || (data.status !== "sent" && data.status !== "queued")) {
    throw new DataError("unknown", "WhatsApp didn't confirm the message.");
  }
  return data;
}

/** Manual fallback: opens a chat with the message pre-filled; staff send it themselves. */
export const whatsAppChatLink = (phone: string, message: string) => {
  const digits = phoneDigits(phone);
  return digits.length === 10
    ? `https://wa.me/91${digits}?text=${encodeURIComponent(message)}`
    : null;
};
