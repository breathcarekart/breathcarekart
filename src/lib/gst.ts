// GST rules shared by Settings and the invoice form: the offered rates and GSTIN checks.
//
// A GSTIN that passes these checks is *well-formed* (right length, state code, PAN
// pattern and check character). That is not proof the business is registered: only the
// GST portal can confirm that.
//
// Kept free of app imports so the unit tests can run with plain `node --test`.

/** GST options offered on invoices. The right rate depends on each item's HSN code. */
export const GST_RATES = ["0", "5", "12", "18", "28"] as const;
export type GstRate = (typeof GST_RATES)[number];

export const isGstRate = (value: unknown): value is GstRate =>
  typeof value === "string" && (GST_RATES as readonly string[]).includes(value);

/** "29 abcde 1234 f1z5 " -> "29ABCDE1234F1Z5". */
export const normalizeGstin = (value: string) => value.replace(/\s+/g, "").toUpperCase();

// 2-digit state/UT code, 10-character PAN, entity number, "Z", check character.
// The database enforces this same pattern.
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// State and union territory codes 01–38, plus 97 (other territory) and 99 (centre jurisdiction).
const isStateCode = (code: number) => (code >= 1 && code <= 38) || code === 97 || code === 99;

const BASE36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** The 15th character, computed from the first 14 (GSTN's published method). */
export function gstinCheckCharacter(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = BASE36.indexOf(first14[i] ?? "") * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return BASE36[(36 - (sum % 36)) % 36]!;
}

export type GstinCheck =
  | { ok: true; gstin: string }
  | { ok: false; reason: "empty" | "length" | "format" | "state" | "checksum"; message: string };

/** Checks a GSTIN's format and check character. Normalises spaces and case first. */
export function checkGstin(raw: string): GstinCheck {
  const gstin = normalizeGstin(raw);
  if (!gstin) return { ok: false, reason: "empty", message: "Enter the GSTIN." };
  if (gstin.length !== 15) {
    return {
      ok: false,
      reason: "length",
      message: `A GSTIN has 15 characters (this has ${gstin.length}).`,
    };
  }
  if (!GSTIN_PATTERN.test(gstin)) {
    return {
      ok: false,
      reason: "format",
      message:
        "This doesn't look like a GSTIN: state code, PAN, entity number, Z, check character.",
    };
  }
  if (!isStateCode(Number(gstin.slice(0, 2)))) {
    return {
      ok: false,
      reason: "state",
      message: "The first two digits aren't a valid state code.",
    };
  }
  if (gstinCheckCharacter(gstin.slice(0, 14)) !== gstin[14]) {
    return {
      ok: false,
      reason: "checksum",
      message: "The last character doesn't match. Check the GSTIN for a typing mistake.",
    };
  }
  return { ok: true, gstin };
}
