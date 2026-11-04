// Core logic of the send-invoice-whatsapp Edge Function.
//
// Everything outside (database, storage, PDF rendering, AiSensy) comes in through `Deps`,
// so it can be unit-tested with mocks under plain `node --test`. index.ts wires the real
// implementations.
//
// Trust model
//  - The browser sends only: invoice_id, mode, action and confirm_resend.
//    Customer name, phone, amounts, invoice number and template values are ALWAYS read
//    from the database here, never taken from the request.
//  - The caller must be an active admin or telecaller. The invoice is read with the
//    caller's own session, so RLS applies as well.
//  - Log rows, the PDF upload and the signed URL use the server-side service role.
//  - The AiSensy API key never passes through this file (see aisensy.ts / index.ts).
import {
  buildInvoicePdfData,
  todayInIndia,
  type CompanySettingsRow,
  type InvoiceCustomer,
  type InvoiceItemRow,
  type InvoiceRow,
} from "../_shared/invoice-document.ts";
import { invoicePdfFilename, type InvoicePdfData } from "../_shared/invoice-pdf-layout.ts";
import type { ProviderResult } from "./aisensy.ts";
import {
  buildCampaignPayload,
  buildTemplateParams,
  INVOICE_SEND_TEMPLATE,
  maskPhone,
  normalizeIndianMobile,
  redactSignedUrl,
  type CampaignPayload,
} from "./whatsapp.ts";

export const MODES = ["dry_run", "test", "live"] as const;
export type Mode = (typeof MODES)[number];
export type Action = "send" | "preview";

export type SendConfig = {
  apiKeyConfigured: boolean;
  /** Raw WHATSAPP_TEST_DESTINATION secret (validated here). */
  testDestination: string | null;
  /** WHATSAPP_LIVE_ENABLED === "true". Off by default. */
  liveEnabled: boolean;
  signedUrlSeconds: number;
  staleAfterMinutes: number;
};

export type LoadedInvoice = InvoiceRow & {
  customer_id: string;
  customer: InvoiceCustomer | null;
  items: InvoiceItemRow[];
};

export type LogInsert = {
  invoice_id: string;
  customer_id: string;
  campaign_name: string;
  mode: Mode;
  status: "sending" | "sent" | "failed" | "dry_run";
  destination: string;
  template_params: string[];
  media_path?: string | null;
  media_filename?: string | null;
  provider_http_status?: number | null;
  provider_response?: unknown;
  error_message?: string | null;
  is_resend: boolean;
  requested_by: string;
  completed_at?: string | null;
};

export type LogPatch = Partial<
  Pick<
    LogInsert,
    | "status"
    | "media_path"
    | "media_filename"
    | "provider_http_status"
    | "provider_response"
    | "error_message"
    | "completed_at"
  >
>;

export type ClaimResult =
  { ok: true; id: string } | { ok: false; reason: "in_progress" | "already_sent" | "other" };

export type Deps = {
  authenticate(token: string): Promise<{ id: string } | null>;
  callerProfile(userId: string): Promise<{ role: string | null; is_active: boolean } | null>;
  loadInvoice(invoiceId: string): Promise<LoadedInvoice | null>;
  loadSettings(): Promise<CompanySettingsRow | null>;
  priorSuccess(invoiceId: string, mode: Mode): Promise<boolean>;
  expireStale(invoiceId: string, campaignName: string, olderThan: Date): Promise<void>;
  claimSend(row: LogInsert): Promise<ClaimResult>;
  insertLog(row: LogInsert): Promise<{ id: string } | null>;
  updateLog(id: string, patch: LogPatch): Promise<void>;
  renderPdf(data: InvoicePdfData): Promise<Uint8Array>;
  uploadPdf(path: string, bytes: Uint8Array): Promise<boolean>;
  signUrl(path: string, expiresInSeconds: number): Promise<string | null>;
  checkPdfUrl(url: string): Promise<boolean>;
  sendCampaign(payload: CampaignPayload): Promise<ProviderResult>;
  logActivity(entry: {
    invoiceId: string;
    action: string;
    description: string;
    actorId: string;
    metadata: Record<string, unknown>;
  }): Promise<void>;
  randomId(): string;
  now(): Date;
};

export type HandlerRequest = { method: string; authorization: string | null; body: unknown };
export type HandlerResponse = { status: number; body: Record<string, unknown> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OFFICE_ROLES = new Set(["admin", "telecaller"]);

const reply = (status: number, body: Record<string, unknown>): HandlerResponse => ({
  status,
  body,
});
const fail = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) =>
  reply(status, { ok: false, error: { code, message }, ...extra });

type Input = { invoiceId: string; mode: Mode; action: Action; confirmResend: boolean };

function parseInput(body: unknown): Input | HandlerResponse {
  if (!body || typeof body !== "object")
    return fail(400, "invalid_input", "Send the request as JSON.");
  const b = body as Record<string, unknown>;
  const invoiceId = typeof b["invoice_id"] === "string" ? b["invoice_id"].trim() : "";
  if (!UUID.test(invoiceId)) return fail(400, "invalid_input", "A valid invoice is required.");
  const mode = b["mode"] ?? "dry_run";
  if (typeof mode !== "string" || !(MODES as readonly string[]).includes(mode)) {
    return fail(400, "invalid_mode", "Mode must be dry_run, test or live.");
  }
  const action = b["action"] ?? "send";
  if (action !== "send" && action !== "preview") {
    return fail(400, "invalid_input", "Action must be send or preview.");
  }
  // Only a literal `true` counts as the explicit resend confirmation.
  return { invoiceId, mode: mode as Mode, action, confirmResend: b["confirm_resend"] === true };
}

function modeAvailability(config: SendConfig) {
  const test = normalizeIndianMobile(config.testDestination);
  return {
    testDestination: test.ok ? test.e164 : null,
    dry_run: true,
    test: config.apiKeyConfigured && test.ok,
    live: config.apiKeyConfigured && config.liveEnabled && INVOICE_SEND_TEMPLATE.mappingVerified,
  };
}

export async function handleSendInvoiceWhatsApp(
  req: HandlerRequest,
  deps: Deps,
  config: SendConfig,
): Promise<HandlerResponse> {
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Use POST.");

  // 1. Who is calling, and may they send?
  const token = /^Bearer\s+(.+)$/i.exec(req.authorization ?? "")?.[1]?.trim();
  if (!token) return fail(401, "unauthenticated", "Sign in again to continue.");
  const caller = await deps.authenticate(token).catch(() => null);
  if (!caller) return fail(401, "unauthenticated", "Your session has expired. Sign in again.");
  const profile = await deps.callerProfile(caller.id).catch(() => null);
  if (!profile || !profile.is_active || !OFFICE_ROLES.has(profile.role ?? "")) {
    return fail(
      403,
      "forbidden",
      "Only active admins and telecallers can send invoices on WhatsApp.",
    );
  }

  // 2. What do they want?
  const input = parseInput(req.body);
  if ("status" in input) return input;
  const availability = modeAvailability(config);

  if (input.action === "send") {
    if (input.mode === "live") {
      if (!config.liveEnabled) {
        return fail(403, "live_disabled", "Live sending to customers is switched off.");
      }
      if (!INVOICE_SEND_TEMPLATE.mappingVerified) {
        return fail(
          403,
          "mapping_unverified",
          "The WhatsApp template mapping hasn't been verified yet.",
        );
      }
    }
    if (input.mode !== "dry_run" && !config.apiKeyConfigured) {
      return fail(503, "not_configured", "WhatsApp sending isn't configured on the server.");
    }
    if (input.mode === "test" && !availability.testDestination) {
      return fail(
        503,
        "test_not_configured",
        "Test mode has no valid internal test number configured.",
      );
    }
  }

  // 3. Everything about the invoice comes from the database (read as the caller).
  const invoice = await deps.loadInvoice(input.invoiceId).catch(() => null);
  if (!invoice) return fail(404, "invoice_not_found", "Invoice not found.");
  if (invoice.status === "draft" || invoice.status === "cancelled") {
    return fail(400, "invoice_not_sendable", `A ${invoice.status} invoice can't be sent.`);
  }
  if (!invoice.customer) return fail(400, "customer_missing", "This invoice has no customer.");
  const customerPhone = normalizeIndianMobile(invoice.customer.whatsapp || invoice.customer.phone);
  if (!customerPhone.ok) {
    return customerPhone.reason === "missing"
      ? fail(400, "missing_phone", "The customer has no WhatsApp or phone number.")
      : fail(400, "invalid_phone", "The customer's number isn't a valid Indian mobile number.");
  }
  const built = buildTemplateParams({
    customerName: invoice.customer.name,
    invoiceNumber: invoice.invoice_number,
    invoiceDate: invoice.invoice_date,
    items: invoice.items,
    grandTotal: invoice.grand_total,
  });
  if (!built.ok) return fail(422, "invalid_template_params", built.message);
  const filename = invoicePdfFilename(invoice.invoice_number);
  const campaign = INVOICE_SEND_TEMPLATE.campaignName;

  // 4. Preview: nothing is written, generated or sent.
  if (input.action === "preview") {
    const [sentLive, sentTest] = await Promise.all([
      deps.priorSuccess(invoice.id, "live").catch(() => false),
      deps.priorSuccess(invoice.id, "test").catch(() => false),
    ]);
    return reply(200, {
      ok: true,
      action: "preview",
      campaign,
      mapping_verified: INVOICE_SEND_TEMPLATE.mappingVerified,
      template_params: built.params,
      recipient: { name: built.values.customer_name, phone_masked: maskPhone(customerPhone.e164) },
      test_destination_masked: availability.testDestination
        ? maskPhone(availability.testDestination)
        : null,
      modes: { dry_run: availability.dry_run, test: availability.test, live: availability.live },
      already_sent: { live: sentLive, test: sentTest },
      attachment_filename: filename,
    });
  }

  // 5. Send (or dry run).
  const destination = input.mode === "test" ? availability.testDestination! : customerPhone.e164;
  const baseRow: LogInsert = {
    invoice_id: invoice.id,
    customer_id: invoice.customer_id,
    campaign_name: campaign,
    mode: input.mode,
    status: input.mode === "dry_run" ? "dry_run" : "sending",
    destination,
    template_params: built.params,
    is_resend: input.confirmResend,
    requested_by: caller.id,
  };

  // Real sends claim the invoice first. The database refuses a second send in progress
  // and a send after a success without confirmation; dry runs are never blocked.
  let logId: string | null = null;
  if (input.mode !== "dry_run") {
    const olderThan = new Date(deps.now().getTime() - config.staleAfterMinutes * 60_000);
    await deps.expireStale(invoice.id, campaign, olderThan).catch(() => undefined);
    const claim = await deps.claimSend(baseRow);
    if (!claim.ok) {
      if (claim.reason === "in_progress") {
        return fail(
          409,
          "send_in_progress",
          "This invoice is already being sent. Wait a moment and refresh.",
        );
      }
      if (claim.reason === "already_sent") {
        return fail(
          409,
          "already_sent",
          'This invoice was already sent on WhatsApp. Confirm "Send again" to resend it.',
          {
            requires_confirmation: true,
          },
        );
      }
      return fail(500, "log_failed", "Couldn't start the send. Try again.");
    }
    logId = claim.id;
  }

  const finish = async (status: "sent" | "failed" | "dry_run", patch: LogPatch) => {
    const completed = { completed_at: deps.now().toISOString(), ...patch };
    if (logId) {
      await deps.updateLog(logId, { status, ...completed }).catch(() => undefined);
    } else {
      const row = await deps.insertLog({ ...baseRow, status, ...completed }).catch(() => null);
      logId = row?.id ?? null;
    }
  };
  const failed = async (http: number, code: string, message: string, patch: LogPatch = {}) => {
    await finish("failed", { error_message: message, ...patch });
    await deps
      .logActivity({
        invoiceId: invoice.id,
        action: "whatsapp_failed",
        description: `WhatsApp ${input.mode.replace("_", " ")} failed for invoice ${invoice.invoice_number}`,
        actorId: caller.id,
        metadata: { mode: input.mode, message_id: logId, code },
      })
      .catch(() => undefined);
    return fail(http, code, message, { message_id: logId });
  };

  try {
    // 5a. The same PDF the browser would download, rendered on the server.
    let bytes: Uint8Array;
    try {
      const settings = await deps.loadSettings().catch(() => null);
      const pdfData = buildInvoicePdfData(
        invoice,
        invoice.customer,
        invoice.items,
        settings,
        todayInIndia(deps.now()),
      );
      bytes = await deps.renderPdf(pdfData);
      if (bytes.length < 100 || String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") {
        throw new Error("not a PDF");
      }
    } catch {
      return await failed(500, "pdf_failed", "The invoice PDF couldn't be generated.");
    }

    // 5b. Private bucket, unguessable path, short-lived signed link. Never a public URL.
    const path = `${invoice.id}/${deps.randomId()}.pdf`;
    if (!(await deps.uploadPdf(path, bytes).catch(() => false))) {
      return await failed(500, "storage_failed", "The invoice PDF couldn't be stored.");
    }
    const media = { media_path: path, media_filename: filename };
    const signedUrl = await deps.signUrl(path, config.signedUrlSeconds).catch(() => null);
    if (!signedUrl)
      return await failed(500, "signed_url_failed", "Couldn't create a link for the PDF.", media);
    if (!(await deps.checkPdfUrl(signedUrl).catch(() => false))) {
      return await failed(
        502,
        "pdf_link_unreachable",
        "The PDF link couldn't be opened, so nothing was sent.",
        media,
      );
    }

    const payload = buildCampaignPayload({
      destination,
      userName: built.values.customer_name,
      mediaUrl: signedUrl,
      mediaFilename: filename,
      templateParams: built.params,
    });

    // 5c. Dry run: everything above was real; AiSensy is never called.
    if (input.mode === "dry_run") {
      await finish("dry_run", media);
      await deps
        .logActivity({
          invoiceId: invoice.id,
          action: "whatsapp_dry_run",
          description: `WhatsApp dry run for invoice ${invoice.invoice_number} (nothing sent)`,
          actorId: caller.id,
          metadata: { mode: "dry_run", message_id: logId },
        })
        .catch(() => undefined);
      return reply(200, {
        ok: true,
        status: "dry_run",
        message_id: logId,
        note: "Dry run: the PDF was generated and checked, nothing was sent.",
        mapping_verified: INVOICE_SEND_TEMPLATE.mappingVerified,
        destination_masked: maskPhone(destination),
        attachment_filename: filename,
        pdf_link: signedUrl,
        payload: {
          ...payload,
          media: { ...payload.media, url: redactSignedUrl(payload.media.url) },
        },
      });
    }

    // 5d. Test or live: call AiSensy.
    const result = await deps.sendCampaign(payload);
    if (result.kind === "accepted") {
      await finish("sent", {
        ...media,
        provider_http_status: result.httpStatus,
        provider_response: result.response,
      });
      await deps
        .logActivity({
          invoiceId: invoice.id,
          action: "whatsapp_sent",
          description: `Invoice ${invoice.invoice_number} sent on WhatsApp (${input.mode}), accepted by AiSensy`,
          actorId: caller.id,
          metadata: { mode: input.mode, message_id: logId, http_status: result.httpStatus },
        })
        .catch(() => undefined);
      return reply(200, {
        ok: true,
        status: "accepted",
        message_id: logId,
        mode: input.mode,
        note: "Accepted by AiSensy. This is not a delivery confirmation.",
        destination_masked: maskPhone(destination),
        attachment_filename: filename,
      });
    }
    if (result.kind === "rejected") {
      return await failed(
        502,
        "provider_rejected",
        `AiSensy rejected the message (HTTP ${result.httpStatus}).`,
        {
          ...media,
          provider_http_status: result.httpStatus,
          provider_response: result.response,
        },
      );
    }
    if (result.kind === "timeout") {
      return await failed(
        504,
        "provider_timeout",
        "AiSensy didn't answer in time. The message may or may not have been sent; check AiSensy before resending.",
        media,
      );
    }
    return await failed(
      502,
      "provider_unreachable",
      "Couldn't reach AiSensy. Nothing was confirmed.",
      media,
    );
  } catch {
    // Never leave a row stuck in "sending".
    return await failed(500, "unexpected", "Something went wrong. Nothing was confirmed.");
  }
}
