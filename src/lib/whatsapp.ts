// WhatsApp invoice delivery — service boundary.
//
// Sending happens server-side only: the `send-invoice-whatsapp` Edge Function holds
// the AiSensy key (never the browser), loads the invoice under the caller's
// permissions, renders and attaches the PDF, and records every attempt in
// `whatsapp_messages`. The app only asks for a preview, a dry run or a test send to
// the internal number; it never asks for a live send. Until the function is
// deployed and VITE_WHATSAPP_ENABLED=true is set, the app calls nothing.
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { queryOptions } from "@tanstack/react-query";
import { db, unwrap } from "@/lib/db/client";
import { DataError, type DataErrorKind } from "@/lib/db/errors";
import { queryKeys } from "@/lib/db/query-keys";
import { phoneDigits } from "@/lib/format";
import {
  describeSendError,
  type WhatsAppPreview,
  type WhatsAppSendMode,
  type WhatsAppSendResult,
} from "@/lib/whatsapp-ui";

export const WHATSAPP_FUNCTION = "send-invoice-whatsapp";

/** Whether invoice sending is switched on for this environment. */
export const isWhatsAppConfigured = () => import.meta.env["VITE_WHATSAPP_ENABLED"] === "true";

const kindByCode: Record<string, DataErrorKind> = {
  unauthenticated: "unauthenticated",
  forbidden: "forbidden",
  invoice_not_found: "not_found",
  send_in_progress: "conflict",
  already_sent: "conflict",
  not_configured: "not_configured",
  test_not_configured: "not_configured",
  function_not_deployed: "not_configured",
  network: "network",
  unexpected: "unknown",
};

/** A DataError whose message is always the app's own wording for the error code. */
const sendError = (code: string) =>
  new DataError(kindByCode[code] ?? "invalid", describeSendError(code).message, code);

async function toSendError(error: unknown): Promise<DataError> {
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response;
    // 404 means the function isn't deployed to this Supabase project yet.
    if (res.status === 404) return sendError("function_not_deployed");
    try {
      const body = (await res.json()) as { error?: { code?: string } };
      return sendError(body.error?.code ?? "unexpected");
    } catch {
      return sendError("unexpected");
    }
  }
  if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
    return sendError("network");
  }
  return sendError("unexpected");
}

async function callFunction<T>(body: Record<string, unknown>): Promise<T> {
  if (!isWhatsAppConfigured()) throw sendError("function_not_deployed");
  const { data, error } = await db().functions.invoke<T>(WHATSAPP_FUNCTION, { body });
  if (error) throw await toSendError(error);
  if (!data) throw sendError("unexpected");
  return data;
}

/** What would be sent: recipient (masked), template values and which modes are available. */
export async function previewInvoiceWhatsApp(invoiceId: string): Promise<WhatsAppPreview> {
  const data = await callFunction<WhatsAppPreview>({
    invoice_id: invoiceId,
    action: "preview",
    mode: "dry_run",
  });
  if (data.action !== "preview") throw sendError("unexpected");
  return data;
}

/**
 * Runs a dry run (nothing sent) or a test send to the internal number.
 * Never reports success unless the server does.
 */
export async function sendInvoiceWhatsApp(
  invoiceId: string,
  mode: WhatsAppSendMode,
  confirmResend: boolean,
): Promise<WhatsAppSendResult> {
  // Belt and braces: the type already rules out live, but plain JS callers exist.
  if (mode !== "dry_run" && mode !== "test") throw sendError("invalid_mode");
  const data = await callFunction<WhatsAppSendResult>({
    invoice_id: invoiceId,
    action: "send",
    mode,
    confirm_resend: confirmResend,
  });
  if (data.status !== "dry_run" && data.status !== "accepted") throw sendError("unexpected");
  return data;
}

/** Send attempts for one invoice, newest first. RLS limits this to admins and telecallers. */
export async function fetchWhatsAppHistory(invoiceId: string) {
  return unwrap(
    await db()
      .from("whatsapp_messages")
      .select(
        `id, mode, status, destination, error_message, is_resend, media_filename,
        created_at, completed_at,
        requester:profiles!whatsapp_messages_requested_by_fkey(id, full_name)`,
      )
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: false })
      .limit(50),
  );
}

export type WhatsAppHistoryEntry = Awaited<ReturnType<typeof fetchWhatsAppHistory>>[number];

export const whatsAppQueries = {
  preview: (invoiceId: string) =>
    queryOptions({
      queryKey: queryKeys.whatsapp.preview(invoiceId),
      queryFn: () => previewInvoiceWhatsApp(invoiceId),
      staleTime: 0,
      retry: false,
    }),
  history: (invoiceId: string) =>
    queryOptions({
      queryKey: queryKeys.whatsapp.history(invoiceId),
      queryFn: () => fetchWhatsAppHistory(invoiceId),
    }),
};

/** Manual fallback: opens a chat with the message pre-filled; staff send it themselves. */
export const whatsAppChatLink = (phone: string, message: string) => {
  const digits = phoneDigits(phone);
  return digits.length === 10
    ? `https://wa.me/91${digits}?text=${encodeURIComponent(message)}`
    : null;
};
