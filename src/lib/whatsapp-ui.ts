// What the invoice WhatsApp screens show: send modes, statuses, safe error messages and
// when a retry is allowed. The rules themselves (who may send, duplicate protection,
// live gating) live in the send-invoice-whatsapp Edge Function; this only describes
// its answers to staff.
//
// Kept free of app imports so the unit tests can run with plain `node --test`.
import {
  maskPhone,
  normalizeIndianMobile,
} from "../../supabase/functions/send-invoice-whatsapp/whatsapp.ts";

/** Modes the app can ask for. Live is deliberately not one of them. */
export type WhatsAppSendMode = "dry_run" | "test";
export const DEFAULT_SEND_MODE: WhatsAppSendMode = "dry_run";

// ── Edge Function responses ─────────────────────────────────────────────────
export type WhatsAppPreview = {
  ok: true;
  action: "preview";
  campaign: string;
  mapping_verified: boolean;
  template_params: string[];
  recipient: { name: string; phone_masked: string };
  test_destination_masked: string | null;
  modes: { dry_run: boolean; test: boolean; live: boolean };
  already_sent: { live: boolean; test: boolean };
  attachment_filename: string;
};

export type WhatsAppSendResult =
  | {
      ok: true;
      status: "dry_run";
      message_id: string | null;
      note: string;
      destination_masked: string;
      attachment_filename: string;
      pdf_link?: string;
    }
  | {
      ok: true;
      status: "accepted";
      message_id: string | null;
      mode: WhatsAppSendMode;
      note: string;
      destination_masked: string;
      attachment_filename: string;
    };

// ── Send status shown in the dialog ─────────────────────────────────────────
export type SendPhase = "ready" | "preparing" | "sending" | "accepted" | "failed" | "dry_run_done";

export const phaseLabels: Record<SendPhase, string> = {
  ready: "Ready",
  preparing: "Preparing invoice",
  sending: "Sending",
  accepted: "Accepted by AiSensy",
  failed: "Failed",
  dry_run_done: "Dry run completed",
};

/** StatusBadge tones. */
export const phaseTones = {
  ready: "neutral",
  preparing: "pending",
  sending: "pending",
  accepted: "completed",
  failed: "overdue",
  dry_run_done: "assigned",
} as const satisfies Record<SendPhase, string>;

/** A dry run only prepares and checks the PDF; a test send also reaches AiSensy. */
export const inFlightPhase = (mode: WhatsAppSendMode): SendPhase =>
  mode === "dry_run" ? "preparing" : "sending";

export const resultPhase = (result: WhatsAppSendResult): SendPhase =>
  result.status === "dry_run" ? "dry_run_done" : "accepted";

export const ACCEPTED_NOTE =
  "Accepted by AiSensy means the message was handed over for sending. It is not a delivery confirmation.";

// ── History ─────────────────────────────────────────────────────────────────
export const modeLabels: Record<string, string> = {
  dry_run: "Dry run",
  test: "Test send",
  live: "Live",
};

export const historyStatusLabels: Record<string, string> = {
  dry_run: "Dry run completed",
  sending: "Sending",
  sent: "Accepted by AiSensy",
  failed: "Failed",
};

export const historyStatusTones = {
  dry_run: "assigned",
  sending: "pending",
  sent: "completed",
  failed: "overdue",
} as const satisfies Record<string, string>;

export const historyStatusTone = (status: string) =>
  historyStatusTones[status as keyof typeof historyStatusTones] ?? "neutral";

/** "+919845011223" -> "+91 ******1223". Never shows a full number. */
export const maskDestination = (e164: string | null | undefined) => (e164 ? maskPhone(e164) : "—");

/** Masks a customer's number as typed in their record ("98450 11223"). */
export function maskCustomerPhone(raw: string | null | undefined): string | null {
  const phone = normalizeIndianMobile(raw);
  if (phone.ok) return maskPhone(phone.e164);
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? `******${digits.slice(-4)}` : null;
}

/**
 * The stored error is written by the Edge Function from fixed messages, but it is
 * still cleaned before display: no links (signed URLs), single line, short.
 */
export function safeHistoryError(message: string | null | undefined): string | null {
  if (!message) return null;
  const clean = message
    .replace(/https?:\/\/\S+/gi, "[link]")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;
  return clean.length > 160 ? `${clean.slice(0, 159).trimEnd()}…` : clean;
}

// ── Errors ──────────────────────────────────────────────────────────────────
/**
 * What the dialog offers after an error:
 *  - retry:          nothing was sent, trying again is safe
 *  - confirm_resend: it may have reached (or did reach) the recipient; only with confirmation
 *  - wait:           another send is in progress; refresh instead
 *  - none:           trying again won't help until something is fixed
 */
export type RetryPolicy = "retry" | "confirm_resend" | "wait" | "none";

type ErrorInfo = { message: string; retry: RetryPolicy };

const errorInfo: Record<string, ErrorInfo> = {
  unauthenticated: { message: "Your session has expired. Sign in again.", retry: "none" },
  forbidden: {
    message: "Only active admins and telecallers can send invoices on WhatsApp.",
    retry: "none",
  },
  function_not_deployed: {
    message: "WhatsApp sending isn't set up on the server yet.",
    retry: "none",
  },
  not_configured: { message: "WhatsApp sending isn't configured on the server.", retry: "none" },
  test_not_configured: {
    message: "Test sending has no internal test number configured.",
    retry: "none",
  },
  live_disabled: { message: "Live sending to customers is switched off.", retry: "none" },
  mapping_unverified: {
    message: "The WhatsApp template mapping hasn't been verified yet.",
    retry: "none",
  },
  invalid_mode: { message: "That send mode isn't available.", retry: "none" },
  invalid_input: { message: "The request was incomplete. Reload the page.", retry: "none" },
  invoice_not_found: { message: "This invoice could not be found.", retry: "none" },
  invoice_not_sendable: {
    message: "Draft and cancelled invoices can't be sent.",
    retry: "none",
  },
  customer_missing: { message: "This invoice has no customer.", retry: "none" },
  missing_phone: {
    message: "The customer has no WhatsApp or phone number. Add one to their profile.",
    retry: "none",
  },
  invalid_phone: {
    message: "The customer's number isn't a valid Indian mobile number. Check their profile.",
    retry: "none",
  },
  invalid_template_params: {
    message: "Some invoice details needed for the message are missing.",
    retry: "none",
  },
  send_in_progress: {
    message: "This invoice is already being sent. Wait a moment, then refresh.",
    retry: "wait",
  },
  already_sent: {
    message: "This invoice was already sent in this mode. Confirm below to send it again.",
    retry: "confirm_resend",
  },
  log_failed: { message: "Couldn't start the send. Nothing was sent.", retry: "retry" },
  pdf_failed: {
    message: "The invoice PDF couldn't be generated. Nothing was sent.",
    retry: "retry",
  },
  storage_failed: {
    message: "The invoice PDF couldn't be stored. Nothing was sent.",
    retry: "retry",
  },
  signed_url_failed: {
    message: "Couldn't create a link for the PDF. Nothing was sent.",
    retry: "retry",
  },
  pdf_link_unreachable: {
    message: "The PDF link couldn't be opened, so nothing was sent.",
    retry: "retry",
  },
  provider_rejected: {
    message: "AiSensy rejected the message. Check the campaign in AiSensy.",
    retry: "retry",
  },
  provider_unreachable: {
    message: "Couldn't reach AiSensy. Nothing was sent.",
    retry: "retry",
  },
  provider_timeout: {
    message:
      "AiSensy didn't answer in time. The message may or may not have been sent; check AiSensy before sending again.",
    retry: "confirm_resend",
  },
  network: {
    message: "Couldn't reach the server. Check the history before trying again.",
    retry: "confirm_resend",
  },
};

const UNKNOWN: ErrorInfo = {
  message: "Something went wrong. Check the history before trying again.",
  retry: "confirm_resend",
};

/** Staff-facing message and retry rule for an Edge Function error code. */
export const describeSendError = (code: string | null | undefined): ErrorInfo =>
  (code && errorInfo[code]) || UNKNOWN;

/**
 * The server couldn't say whether the message went out (timeout, lost connection,
 * unexpected error). Unlike already_sent, the server won't block the next send, so the
 * app keeps asking for confirmation itself.
 */
export const isOutcomeUnknown = (code: string | null | undefined) =>
  code !== "already_sent" && describeSendError(code).retry === "confirm_resend";

// ── Dialog actions ──────────────────────────────────────────────────────────
export type ModeOption = { mode: WhatsAppSendMode; available: boolean; reason: string | null };

/** Which modes the dialog can offer, from the server's preview. Live is never offered. */
export function modeOptions(preview: WhatsAppPreview | null | undefined): ModeOption[] {
  return [
    { mode: "dry_run", available: !!preview?.modes.dry_run, reason: null },
    {
      mode: "test",
      available: !!preview?.modes.test,
      reason: preview?.modes.test ? null : "Test sending isn't configured on the server.",
    },
  ];
}

/** A test send after an earlier successful test send needs an explicit "Send Again". */
export const needsResendConfirmation = (
  mode: WhatsAppSendMode,
  preview: WhatsAppPreview | null | undefined,
  lastErrorCode: string | null | undefined,
) =>
  mode !== "dry_run" &&
  (!!preview?.already_sent.test ||
    (lastErrorCode != null && describeSendError(lastErrorCode).retry === "confirm_resend"));

/**
 * Lets one send through at a time. React state updates are asynchronous, so a fast
 * double click can fire twice before the button is disabled; this check is synchronous.
 */
export function createSendGuard() {
  let busy = false;
  return {
    tryStart() {
      if (busy) return false;
      busy = true;
      return true;
    },
    finish() {
      busy = false;
    },
    get busy() {
      return busy;
    },
  };
}
