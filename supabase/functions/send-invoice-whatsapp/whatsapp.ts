// Pure helpers for the WhatsApp messages: template mappings, phone numbers,
// template parameters and the AiSensy Legacy Campaign payload. No I/O here, so it can be
// unit-tested with plain `node --test`.

// ============================================================
// The approved AiSensy templates: the ONE place to change a mapping
// ============================================================
// Position i of `parameters` fills placeholder {{i + 1}}. Verified on 04 Nov 2026 against
// the approved templates in AiSensy (campaign previews). A "₹" shown before a placeholder
// is part of the template, so amounts are sent as digits only.
export const TEMPLATES = {
  invoice_send: {
    campaignName: "invoice_send",
    mappingVerified: true,
    subject: "invoice",
    media: "invoice_pdf",
    parameters: [
      "customer_name",
      "invoice_number",
      "invoice_date",
      "item_description",
      "grand_total",
    ],
    labels: ["Customer name", "Invoice number", "Invoice date", "Description", "Total amount (₹)"],
  },
  payment_request: {
    campaignName: "payment_request",
    mappingVerified: true,
    subject: "invoice",
    media: "payment_qr",
    parameters: ["customer_name", "invoice_number", "pending_amount", "due_date", "upi_id"],
    labels: ["Customer name", "Invoice number", "Pending amount (₹)", "Payment due date", "UPI ID"],
  },
  rental_booking_confirmation: {
    campaignName: "rental_booking_confirmation",
    mappingVerified: true,
    subject: "rental",
    media: null,
    parameters: [
      "customer_name",
      "equipment",
      "booking_date",
      "start_date",
      "due_date",
      "rental_amount",
    ],
    labels: [
      "Customer name",
      "Equipment",
      "Booking date",
      "Rental start date",
      "Rental due date",
      "Rental amount (₹)",
    ],
  },
  return_or_renew_reminder: {
    campaignName: "return_or_renew_reminder",
    mappingVerified: true,
    subject: "rental",
    media: null,
    parameters: ["customer_name", "equipment", "due_date"],
    labels: ["Customer name", "Equipment", "Rental due date"],
  },
} as const;

export type TemplateName = keyof typeof TEMPLATES;
export const TEMPLATE_NAMES = Object.keys(TEMPLATES) as TemplateName[];
export const isTemplateName = (v: unknown): v is TemplateName =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(TEMPLATES, v);

/** Kept for existing callers: the invoice template. */
export const INVOICE_SEND_TEMPLATE = TEMPLATES.invoice_send;

export type TemplateParamKey = (typeof INVOICE_SEND_TEMPLATE.parameters)[number];

export const AISENSY_ENDPOINT = "https://backend.aisensy.com/campaign/t1/api/v2";
export const AISENSY_SOURCE = "breathcarekart-app";

// ============================================================
// Phone numbers
// ============================================================
export type PhoneResult = { ok: true; e164: string } | { ok: false; reason: "missing" | "invalid" };

/**
 * Normalises an Indian mobile number to E.164 (+91XXXXXXXXXX).
 * Accepts "98450 11223", "098450 11223", "919845011223", "+91 98450-11223".
 * Anything else (landlines, other countries, wrong length) is refused.
 */
export function normalizeIndianMobile(raw: string | null | undefined): PhoneResult {
  const text = (raw ?? "").trim();
  if (!text) return { ok: false, reason: "missing" };
  let digits = text.replace(/\D/g, "");
  if (text.startsWith("+")) {
    if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) {
      return { ok: true, e164: `+${digits}` };
    }
    return { ok: false, reason: "invalid" };
  }
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 10 && /^[6-9]/.test(digits)) return { ok: true, e164: `+91${digits}` };
  return { ok: false, reason: "invalid" };
}

/**
 * The number as AiSensy's `destination` expects it: country code + number, digits only
 * ("919845011223"). The number is validated again here, so nothing that isn't a valid
 * Indian mobile can ever reach AiSensy.
 */
export function toAiSensyDestination(raw: string): string {
  const phone = normalizeIndianMobile(raw);
  if (!phone.ok) throw new Error("Refusing to send to an invalid WhatsApp number.");
  return phone.e164.slice(1);
}

/** "+919845011223" -> "+91 ******1223" for screens and logs shown to users. */
export const maskPhone = (e164: string) =>
  e164.length > 7 ? `${e164.slice(0, 3)} ${"*".repeat(e164.length - 7)}${e164.slice(-4)}` : "****";

// ============================================================
// Template parameter values
// ============================================================
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-03" -> "03 Nov 2026" (fixed English month names, never locale-dependent). */
export function formatTemplateDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) throw new Error(`Invalid date: ${isoDate}`);
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) throw new Error(`Invalid date: ${isoDate}`);
  return `${m[3]} ${month} ${m[1]}`;
}

/** 14750 -> "14,750.00" (Indian digit grouping, 2 decimals, no currency symbol). */
export function formatTemplateAmount(value: number | string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Invalid amount: ${value}`);
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * WhatsApp template values can't contain new lines or tabs, or runs of 4+ spaces.
 * Collapse whitespace, trim, and cap the length.
 */
export function sanitizeTemplateValue(value: string, maxLength = 500): string {
  const clean = value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1).trimEnd()}…` : clean;
}

/** Item names joined with commas: the first few, then "+N more". */
export function describeItems(
  items: { description: string; created_at: string }[],
  maxNames = 3,
  maxLength = 200,
): string {
  const names = [...items]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((it) => sanitizeTemplateValue(it.description))
    .filter(Boolean);
  if (names.length === 0) return "";
  const rest = names.length - maxNames;
  const suffix = rest > 0 ? ` +${rest} more` : "";
  let shown = names.slice(0, maxNames).join(", ");
  if (shown.length + suffix.length > maxLength) {
    shown = `${shown.slice(0, Math.max(0, maxLength - suffix.length - 1)).trimEnd()}…`;
  }
  return `${shown}${suffix}`;
}

export type TemplateInput = {
  customerName: string;
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  items: { description: string; created_at: string }[];
  grandTotal: number | string;
};

export type ParamsResult =
  { ok: true; params: string[]; values: Record<string, string> } | { ok: false; message: string };

/**
 * Puts named values into the template's placeholder order. Every placeholder must get a
 * non-empty value: a blank is refused instead of sent.
 */
export function orderTemplateParams(
  template: TemplateName,
  build: () => Record<string, string>,
): ParamsResult {
  let values: Record<string, string>;
  try {
    values = build();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Invalid data" };
  }
  const keys = TEMPLATES[template].parameters as readonly string[];
  const empty = keys.filter((key) => !values[key]);
  if (empty.length) return { ok: false, message: `Missing template value: ${empty.join(", ")}` };
  return { ok: true, params: keys.map((key) => values[key]!), values };
}

/** invoice_send parameters from trusted database values. */
export const buildTemplateParams = (input: TemplateInput): ParamsResult =>
  orderTemplateParams("invoice_send", () => ({
    customer_name: sanitizeTemplateValue(input.customerName, 100),
    invoice_number: sanitizeTemplateValue(input.invoiceNumber, 60),
    invoice_date: formatTemplateDate(input.invoiceDate),
    item_description: describeItems(input.items),
    grand_total: formatTemplateAmount(input.grandTotal),
  }));

// ============================================================
// UPI
// ============================================================
/** "name@bank": the format UPI apps accept for a virtual payment address. */
export const isValidUpiId = (value: string | null | undefined) =>
  /^[A-Za-z0-9._-]{2,200}@[A-Za-z][A-Za-z0-9.-]{1,63}$/.test((value ?? "").trim());

// ============================================================
// AiSensy Legacy Campaign API payload
// ============================================================
/** The request body WITHOUT the API key. The key is added only at the moment of sending. */
export type CampaignPayload = {
  campaignName: string;
  destination: string;
  userName: string;
  source: string;
  /** Only for templates with a document or image header. */
  media?: { url: string; filename: string };
  templateParams: string[];
};

export function buildCampaignPayload(args: {
  template?: TemplateName;
  destination: string;
  userName: string;
  mediaUrl?: string | null;
  mediaFilename?: string | null;
  templateParams: string[];
}): CampaignPayload {
  const payload: CampaignPayload = {
    campaignName: TEMPLATES[args.template ?? "invoice_send"].campaignName,
    destination: toAiSensyDestination(args.destination),
    userName: sanitizeTemplateValue(args.userName, 100),
    source: AISENSY_SOURCE,
    templateParams: args.templateParams,
  };
  if (args.mediaUrl && args.mediaFilename) {
    payload.media = { url: args.mediaUrl, filename: args.mediaFilename };
  }
  return payload;
}

// ============================================================
// Keeping secrets out of logs
// ============================================================
const SECRET_KEY = /api.?key|token|secret|authorization|password|signature/i;

/**
 * Makes a provider reply safe to store: drops secret-looking fields, removes the API key
 * wherever it appears, and caps the size. Returns JSON-compatible data.
 */
export function sanitizeProviderResponse(
  raw: string,
  apiKey: string | null,
  maxLength = 2000,
): unknown {
  const scrub = (s: string) => (apiKey ? s.split(apiKey).join("[redacted]") : s);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { text: scrub(raw).slice(0, maxLength) };
  }
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return scrub(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .filter(([k]) => !SECRET_KEY.test(k))
          .map(([k, val]) => [k, walk(val)]),
      );
    }
    return v;
  };
  const clean = walk(parsed);
  const text = JSON.stringify(clean);
  return text.length > maxLength ? { truncated: text.slice(0, maxLength) } : clean;
}

/** Removes the token from a signed URL before it is ever written to a log or response. */
export const redactSignedUrl = (url: string) => url.replace(/([?&]token=)[^&]+/i, "$1[redacted]");
