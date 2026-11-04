// Pure helpers for the invoice WhatsApp message: template mapping, phone numbers,
// template parameters and the AiSensy Legacy Campaign payload. No I/O here, so it can be
// unit-tested with plain `node --test`.

// ============================================================
// The invoice_send template mapping: the ONE place to change it
// ============================================================
// PROVISIONAL. The approved template shows these five values in this order, but the
// {{1}}..{{5}} placeholder numbers have not been confirmed in AiSensy's template edit
// view yet. Live sending is refused until `mappingVerified` is set to true after that
// check (dry runs and test sends to the internal number are allowed meanwhile).
export const INVOICE_SEND_TEMPLATE = {
  campaignName: "invoice_send",
  mappingVerified: false,
  /** Position i fills placeholder {{i + 1}}. */
  parameters: [
    "customer_name", // {{1}}  Hello [Ramesh Kumar],
    "invoice_number", // {{2}}  Invoice Number: [INV-1045]
    "invoice_date", // {{3}}  Invoice Date: [03-Nov-2026]
    "item_description", // {{4}}  Description: [Oxygen Concentrator (5L) – 7 day rental]
    "grand_total", // {{5}}  Total Amount: ₹[3500]   (₹ is in the template; send digits only)
  ],
} as const;

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
  | { ok: true; params: string[]; values: Record<TemplateParamKey, string> }
  | { ok: false; message: string };

/** Builds the template parameters in placeholder order from trusted database values. */
export function buildTemplateParams(input: TemplateInput): ParamsResult {
  let values: Record<TemplateParamKey, string>;
  try {
    values = {
      customer_name: sanitizeTemplateValue(input.customerName, 100),
      invoice_number: sanitizeTemplateValue(input.invoiceNumber, 60),
      invoice_date: formatTemplateDate(input.invoiceDate),
      item_description: describeItems(input.items),
      grand_total: formatTemplateAmount(input.grandTotal),
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Invalid invoice data" };
  }
  const params = INVOICE_SEND_TEMPLATE.parameters.map((key) => values[key]);
  const empty = INVOICE_SEND_TEMPLATE.parameters.filter((key) => !values[key]);
  if (empty.length) return { ok: false, message: `Missing template value: ${empty.join(", ")}` };
  if (params.length !== INVOICE_SEND_TEMPLATE.parameters.length) {
    return { ok: false, message: "Template parameter count does not match the template" };
  }
  return { ok: true, params, values };
}

// ============================================================
// AiSensy Legacy Campaign API payload
// ============================================================
/** The request body WITHOUT the API key. The key is added only at the moment of sending. */
export type CampaignPayload = {
  campaignName: string;
  destination: string;
  userName: string;
  source: string;
  media: { url: string; filename: string };
  templateParams: string[];
};

export function buildCampaignPayload(args: {
  destination: string;
  userName: string;
  mediaUrl: string;
  mediaFilename: string;
  templateParams: string[];
}): CampaignPayload {
  return {
    campaignName: INVOICE_SEND_TEMPLATE.campaignName,
    destination: args.destination,
    userName: sanitizeTemplateValue(args.userName, 100),
    source: AISENSY_SOURCE,
    media: { url: args.mediaUrl, filename: args.mediaFilename },
    templateParams: args.templateParams,
  };
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
