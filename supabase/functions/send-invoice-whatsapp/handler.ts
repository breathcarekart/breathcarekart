// Core logic of the send-invoice-whatsapp Edge Function: sends one of the approved
// AiSensy templates (invoice_send, payment_request, rental_booking_confirmation,
// return_or_renew_reminder) for one invoice or rental.
//
// Everything outside (database, storage, PDF rendering, AiSensy) comes in through `Deps`,
// so it can be unit-tested with mocks under plain `node --test`. index.ts wires the real
// implementations.
//
// Trust model
//  - The browser sends only: template, invoice_id or rental_id, mode, action and
//    confirm_resend. Customer name, phone, amounts, dates and every template value are
//    ALWAYS read from the database here, never taken from the request.
//  - The caller must be an active admin or telecaller. Invoices and rentals are read with
//    the caller's own session, so RLS applies as well.
//  - Log rows, the PDF upload and signed URLs use the server-side service role.
//  - The AiSensy API key never passes through this file (see aisensy.ts / index.ts).
import {
  buildInvoicePdfData,
  outstandingOf,
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
  describeItems,
  formatTemplateAmount,
  formatTemplateDate,
  isTemplateName,
  isValidUpiId,
  maskPhone,
  normalizeIndianMobile,
  orderTemplateParams,
  redactSignedUrl,
  sanitizeTemplateValue,
  TEMPLATES,
  type CampaignPayload,
  type ParamsResult,
  type TemplateName,
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

export type LoadedRental = {
  id: string;
  rental_number: string;
  status: string;
  start_date: string;
  due_date: string;
  returned_date: string | null;
  customer_id: string;
  customer: InvoiceCustomer | null;
  items: {
    description: string | null;
    type_name: string | null;
    quantity: number;
    rate: number | string | null;
    created_at: string;
  }[];
  /** The invoice the rental was created with, if any (register rentals have none). */
  invoice: { invoice_date: string; grand_total: number | string } | null;
};

export type SettingsRow = CompanySettingsRow & {
  upi_id?: string | null;
  payment_qr_path?: string | null;
};

/** Which record a message is about. Exactly one of the two is set. */
export type SubjectKey = { invoiceId: string | null; rentalId: string | null };

export type LogInsert = {
  invoice_id: string | null;
  rental_id: string | null;
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

export type MediaBucket = "invoice-pdfs" | "business-assets";

export type Deps = {
  authenticate(token: string): Promise<{ id: string } | null>;
  callerProfile(userId: string): Promise<{ role: string | null; is_active: boolean } | null>;
  loadInvoice(invoiceId: string): Promise<LoadedInvoice | null>;
  loadRental(rentalId: string): Promise<LoadedRental | null>;
  loadSettings(): Promise<SettingsRow | null>;
  priorSuccess(key: SubjectKey, campaignName: string, mode: Mode): Promise<boolean>;
  expireStale(key: SubjectKey, campaignName: string, olderThan: Date): Promise<void>;
  claimSend(row: LogInsert): Promise<ClaimResult>;
  insertLog(row: LogInsert): Promise<{ id: string } | null>;
  updateLog(id: string, patch: LogPatch): Promise<void>;
  renderPdf(data: InvoicePdfData): Promise<Uint8Array>;
  uploadPdf(path: string, bytes: Uint8Array): Promise<boolean>;
  signUrl(bucket: MediaBucket, path: string, expiresInSeconds: number): Promise<string | null>;
  /** Fetches the start of the file over the internet, the way AiSensy will. */
  checkMediaUrl(url: string, kind: "pdf" | "image"): Promise<boolean>;
  sendCampaign(payload: CampaignPayload): Promise<ProviderResult>;
  logActivity(entry: {
    entityType: "invoice" | "rental";
    entityId: string;
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
const CLOSED_RENTAL = new Set(["returned", "cancelled"]);

const reply = (status: number, body: Record<string, unknown>): HandlerResponse => ({
  status,
  body,
});
const fail = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) =>
  reply(status, { ok: false, error: { code, message }, ...extra });

type Input = {
  template: TemplateName;
  subjectId: string;
  mode: Mode;
  action: Action;
  confirmResend: boolean;
};

function parseInput(body: unknown): Input | HandlerResponse {
  if (!body || typeof body !== "object")
    return fail(400, "invalid_input", "Send the request as JSON.");
  const b = body as Record<string, unknown>;
  const template = b["template"] ?? "invoice_send";
  if (!isTemplateName(template)) return fail(400, "invalid_template", "Unknown message template.");
  const field = TEMPLATES[template].subject === "invoice" ? "invoice_id" : "rental_id";
  const subjectId = typeof b[field] === "string" ? (b[field] as string).trim() : "";
  if (!UUID.test(subjectId)) {
    return fail(
      400,
      "invalid_input",
      `A valid ${field === "invoice_id" ? "invoice" : "rental"} is required.`,
    );
  }
  const mode = b["mode"] ?? "dry_run";
  if (typeof mode !== "string" || !(MODES as readonly string[]).includes(mode)) {
    return fail(400, "invalid_mode", "Mode must be dry_run, test or live.");
  }
  const action = b["action"] ?? "send";
  if (action !== "send" && action !== "preview") {
    return fail(400, "invalid_input", "Action must be send or preview.");
  }
  // Only a literal `true` counts as the explicit resend confirmation.
  return {
    template,
    subjectId,
    mode: mode as Mode,
    action,
    confirmResend: b["confirm_resend"] === true,
  };
}

function modeAvailability(config: SendConfig, template: TemplateName) {
  const test = normalizeIndianMobile(config.testDestination);
  return {
    testDestination: test.ok ? test.e164 : null,
    dry_run: true,
    test: config.apiKeyConfigured && test.ok,
    live: config.apiKeyConfigured && config.liveEnabled && TEMPLATES[template].mappingVerified,
  };
}

/** What a template needs to be sent, prepared from trusted rows. */
type Prepared = {
  key: SubjectKey;
  entity: { type: "invoice" | "rental"; id: string; label: string };
  customerId: string;
  customerName: string;
  customerPhone: string;
  params: string[];
  media:
    | {
        kind: "invoice_pdf";
        filename: string;
        invoice: LoadedInvoice;
        settings: SettingsRow | null;
      }
    | { kind: "payment_qr"; filename: string; path: string }
    | null;
};

const imageExtension = (path: string) =>
  /\.(png|jpe?g|webp)$/i.exec(path)?.[1]?.toLowerCase() ?? "jpg";

async function prepare(input: Input, deps: Deps): Promise<Prepared | HandlerResponse> {
  const t = input.template;
  const settings =
    t === "invoice_send" || t === "payment_request"
      ? await deps.loadSettings().catch(() => null)
      : null;

  let customer: InvoiceCustomer | null;
  let customerId: string;
  let built: ParamsResult;
  let key: SubjectKey;
  let entity: Prepared["entity"];
  let media: Prepared["media"] = null;

  if (TEMPLATES[t].subject === "invoice") {
    const invoice = await deps.loadInvoice(input.subjectId).catch(() => null);
    if (!invoice) return fail(404, "invoice_not_found", "Invoice not found.");
    if (invoice.status === "draft" || invoice.status === "cancelled") {
      return fail(400, "invoice_not_sendable", `A ${invoice.status} invoice can't be sent.`);
    }
    customer = invoice.customer;
    customerId = invoice.customer_id;
    key = { invoiceId: invoice.id, rentalId: null };
    entity = { type: "invoice", id: invoice.id, label: `invoice ${invoice.invoice_number}` };
    if (!customer) return fail(400, "customer_missing", "This invoice has no customer.");
    const name = customer.name;

    if (t === "invoice_send") {
      built = buildTemplateParams({
        customerName: name,
        invoiceNumber: invoice.invoice_number,
        invoiceDate: invoice.invoice_date,
        items: invoice.items,
        grandTotal: invoice.grand_total,
      });
      media = {
        kind: "invoice_pdf",
        filename: invoicePdfFilename(invoice.invoice_number),
        invoice,
        settings,
      };
    } else {
      const pending = outstandingOf(invoice);
      if (!(pending > 0)) return fail(400, "nothing_due", "This invoice has nothing left to pay.");
      const upi = settings?.upi_id?.trim() ?? "";
      const qr = settings?.payment_qr_path?.trim() ?? "";
      if (!isValidUpiId(upi) || !qr) {
        return fail(
          400,
          "payment_details_missing",
          "Add the UPI ID and payment QR image in Settings first.",
        );
      }
      built = orderTemplateParams("payment_request", () => ({
        customer_name: sanitizeTemplateValue(name, 100),
        invoice_number: sanitizeTemplateValue(invoice.invoice_number, 60),
        pending_amount: formatTemplateAmount(pending),
        due_date: formatTemplateDate(invoice.due_date),
        upi_id: upi,
      }));
      media = { kind: "payment_qr", filename: `payment-qr.${imageExtension(qr)}`, path: qr };
    }
  } else {
    const rental = await deps.loadRental(input.subjectId).catch(() => null);
    if (!rental) return fail(404, "rental_not_found", "Rental not found.");
    if (rental.status === "cancelled")
      return fail(400, "rental_closed", "This rental was cancelled.");
    if (t === "return_or_renew_reminder" && CLOSED_RENTAL.has(rental.status)) {
      return fail(400, "rental_closed", "This rental has already been returned.");
    }
    customer = rental.customer;
    customerId = rental.customer_id;
    key = { invoiceId: null, rentalId: rental.id };
    entity = { type: "rental", id: rental.id, label: `rental ${rental.rental_number}` };
    if (!customer) return fail(400, "customer_missing", "This rental has no customer.");
    const name = customer.name;
    const equipment = describeItems(
      rental.items.map((i) => ({
        description: i.description?.trim() || i.type_name?.trim() || "",
        created_at: i.created_at,
      })),
    );

    if (t === "rental_booking_confirmation") {
      // The amount on the rental's invoice; register rentals without one use the item rates.
      const amount = rental.invoice
        ? Number(rental.invoice.grand_total)
        : rental.items.reduce((sum, i) => sum + Number(i.rate ?? 0) * (i.quantity || 1), 0);
      built = orderTemplateParams("rental_booking_confirmation", () => ({
        customer_name: sanitizeTemplateValue(name, 100),
        equipment,
        booking_date: formatTemplateDate(rental.invoice?.invoice_date ?? rental.start_date),
        start_date: formatTemplateDate(rental.start_date),
        due_date: formatTemplateDate(rental.due_date),
        rental_amount: amount > 0 ? formatTemplateAmount(amount) : "",
      }));
    } else {
      built = orderTemplateParams("return_or_renew_reminder", () => ({
        customer_name: sanitizeTemplateValue(name, 100),
        equipment,
        due_date: formatTemplateDate(rental.due_date),
      }));
    }
  }

  const phone = normalizeIndianMobile(customer.whatsapp || customer.phone);
  if (!phone.ok) {
    return phone.reason === "missing"
      ? fail(400, "missing_phone", "The customer has no WhatsApp or phone number.")
      : fail(400, "invalid_phone", "The customer's number isn't a valid Indian mobile number.");
  }
  if (!built.ok) return fail(422, "invalid_template_params", built.message);

  return {
    key,
    entity,
    customerId,
    customerName: built.values["customer_name"] ?? customer.name,
    customerPhone: phone.e164,
    params: built.params,
    media,
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
    return fail(403, "forbidden", "Only active admins and telecallers can send WhatsApp messages.");
  }

  // 2. What do they want?
  const input = parseInput(req.body);
  if ("status" in input) return input;
  const template = TEMPLATES[input.template];
  const campaign = template.campaignName;
  const availability = modeAvailability(config, input.template);

  if (input.action === "send") {
    if (input.mode === "live") {
      if (!config.liveEnabled) {
        return fail(403, "live_disabled", "Sending to customers is switched off.");
      }
      if (!template.mappingVerified) {
        return fail(403, "mapping_unverified", "This template's mapping hasn't been verified yet.");
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

  // 3. Everything about the message comes from the database (read as the caller).
  const prepared = await prepare(input, deps);
  if ("status" in prepared) return prepared;
  const filename = prepared.media?.filename ?? null;

  // 4. Preview: nothing is written, generated or sent.
  if (input.action === "preview") {
    const [sentLive, sentTest] = await Promise.all([
      deps.priorSuccess(prepared.key, campaign, "live").catch(() => false),
      deps.priorSuccess(prepared.key, campaign, "test").catch(() => false),
    ]);
    return reply(200, {
      ok: true,
      action: "preview",
      template: input.template,
      campaign,
      mapping_verified: template.mappingVerified,
      template_params: prepared.params,
      param_labels: template.labels,
      recipient: { name: prepared.customerName, phone_masked: maskPhone(prepared.customerPhone) },
      test_destination_masked: availability.testDestination
        ? maskPhone(availability.testDestination)
        : null,
      modes: { dry_run: availability.dry_run, test: availability.test, live: availability.live },
      // Which server settings are in place (yes/no only, never values), so the app can tell
      // an admin exactly what's missing instead of failing at send time.
      setup: {
        api_key: config.apiKeyConfigured,
        live_switch: config.liveEnabled,
        test_number: !!availability.testDestination,
      },
      already_sent: { live: sentLive, test: sentTest },
      attachment_filename: filename,
    });
  }

  // 5. Send (or dry run).
  const destination =
    input.mode === "test" ? availability.testDestination! : prepared.customerPhone;
  const baseRow: LogInsert = {
    invoice_id: prepared.key.invoiceId,
    rental_id: prepared.key.rentalId,
    customer_id: prepared.customerId,
    campaign_name: campaign,
    mode: input.mode,
    status: input.mode === "dry_run" ? "dry_run" : "sending",
    destination,
    template_params: prepared.params,
    is_resend: input.confirmResend,
    requested_by: caller.id,
  };

  // Real sends claim the record first. The database refuses a second send in progress
  // and a send after a success without confirmation; dry runs are never blocked.
  let logId: string | null = null;
  if (input.mode !== "dry_run") {
    const olderThan = new Date(deps.now().getTime() - config.staleAfterMinutes * 60_000);
    await deps.expireStale(prepared.key, campaign, olderThan).catch(() => undefined);
    const claim = await deps.claimSend(baseRow);
    if (!claim.ok) {
      if (claim.reason === "in_progress") {
        return fail(
          409,
          "send_in_progress",
          "This message is already being sent. Wait a moment and refresh.",
        );
      }
      if (claim.reason === "already_sent") {
        return fail(
          409,
          "already_sent",
          'This message was already sent. Confirm "Send again" to send it once more.',
          { requires_confirmation: true },
        );
      }
      return fail(500, "log_failed", "Couldn't start the send. Try again.");
    }
    logId = claim.id;
  }

  const activity = (action: string, description: string, metadata: Record<string, unknown>) =>
    deps
      .logActivity({
        entityType: prepared.entity.type,
        entityId: prepared.entity.id,
        action,
        description,
        actorId: caller.id,
        metadata: { template: input.template, mode: input.mode, message_id: logId, ...metadata },
      })
      .catch(() => undefined);

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
    await activity(
      "whatsapp_failed",
      `WhatsApp ${campaign} (${input.mode.replace("_", " ")}) failed for ${prepared.entity.label}`,
      { code },
    );
    return fail(http, code, message, { message_id: logId });
  };

  try {
    // 5a. The attachment, if the template has one: private storage, short-lived signed
    // link, fetched once over the internet to be sure AiSensy can open it.
    let mediaUrl: string | null = null;
    let media: LogPatch = {};
    if (prepared.media?.kind === "invoice_pdf") {
      let bytes: Uint8Array;
      try {
        const m = prepared.media;
        const pdfData = buildInvoicePdfData(
          m.invoice,
          m.invoice.customer!,
          m.invoice.items,
          m.settings,
          todayInIndia(deps.now()),
        );
        bytes = await deps.renderPdf(pdfData);
        if (bytes.length < 100 || String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") {
          throw new Error("not a PDF");
        }
      } catch {
        return await failed(500, "pdf_failed", "The invoice PDF couldn't be generated.");
      }
      const path = `${prepared.entity.id}/${deps.randomId()}.pdf`;
      if (!(await deps.uploadPdf(path, bytes).catch(() => false))) {
        return await failed(500, "storage_failed", "The invoice PDF couldn't be stored.");
      }
      media = { media_path: path, media_filename: prepared.media.filename };
      mediaUrl = await deps
        .signUrl("invoice-pdfs", path, config.signedUrlSeconds)
        .catch(() => null);
    } else if (prepared.media?.kind === "payment_qr") {
      media = { media_path: prepared.media.path, media_filename: prepared.media.filename };
      mediaUrl = await deps
        .signUrl("business-assets", prepared.media.path, config.signedUrlSeconds)
        .catch(() => null);
    }
    if (prepared.media) {
      if (!mediaUrl) {
        return await failed(
          500,
          "signed_url_failed",
          "Couldn't create a link for the attachment.",
          media,
        );
      }
      const kind = prepared.media.kind === "invoice_pdf" ? "pdf" : "image";
      if (!(await deps.checkMediaUrl(mediaUrl, kind).catch(() => false))) {
        return await failed(
          502,
          "media_link_unreachable",
          "The attachment link couldn't be opened, so nothing was sent.",
          media,
        );
      }
    }

    const payload = buildCampaignPayload({
      template: input.template,
      destination,
      userName: prepared.customerName,
      mediaUrl,
      mediaFilename: prepared.media?.filename ?? null,
      templateParams: prepared.params,
    });

    // 5b. Dry run: everything above was real; AiSensy is never called.
    if (input.mode === "dry_run") {
      await finish("dry_run", media);
      await activity(
        "whatsapp_dry_run",
        `WhatsApp ${campaign} dry run for ${prepared.entity.label} (nothing sent)`,
        {},
      );
      return reply(200, {
        ok: true,
        status: "dry_run",
        template: input.template,
        message_id: logId,
        note: "Dry run: everything was prepared and checked, nothing was sent.",
        mapping_verified: template.mappingVerified,
        destination_masked: maskPhone(destination),
        attachment_filename: filename,
        ...(mediaUrl ? { pdf_link: mediaUrl } : {}),
        payload: payload.media
          ? { ...payload, media: { ...payload.media, url: redactSignedUrl(payload.media.url) } }
          : payload,
      });
    }

    // 5c. Test or live: call AiSensy.
    const result = await deps.sendCampaign(payload);
    if (result.kind === "accepted") {
      await finish("sent", {
        ...media,
        provider_http_status: result.httpStatus,
        provider_response: result.response,
      });
      await activity(
        "whatsapp_sent",
        `WhatsApp ${campaign} for ${prepared.entity.label} accepted by AiSensy (${input.mode})`,
        { http_status: result.httpStatus },
      );
      return reply(200, {
        ok: true,
        status: "accepted",
        template: input.template,
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
        { ...media, provider_http_status: result.httpStatus, provider_response: result.response },
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
