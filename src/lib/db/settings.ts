import { queryOptions } from "@tanstack/react-query";
import { db, unwrap, unwrapMaybe } from "@/lib/db/client";
import { DataError, toDataError } from "@/lib/db/errors";
import { queryKeys } from "@/lib/db/query-keys";
import type { UpdateRow } from "@/lib/db/types";

/** The single company settings row (name seeded; GSTIN, address etc. entered by an admin). */
export async function fetchCompanySettings() {
  return unwrapMaybe(await db().from("company_settings").select("*").eq("id", true).maybeSingle());
}

export async function updateCompanySettings(
  patch: Pick<
    UpdateRow<"company_settings">,
    | "company_name"
    | "address"
    | "phone"
    | "email"
    | "gst_registered"
    | "gstin"
    | "default_gst_rate"
    | "authorised_signatory"
    | "invoice_prefix"
    | "invoice_terms"
    | "upi_id"
    | "payment_qr_path"
  >,
) {
  return unwrap(await db().from("company_settings").update(patch).eq("id", true).select().single());
}

export const settingsQueries = {
  company: () =>
    queryOptions({
      queryKey: queryKeys.settings.company(),
      queryFn: fetchCompanySettings,
      staleTime: 5 * 60_000,
    }),
};

// ── Payment QR image (private business-assets bucket; admins upload, office staff read) ──
const ASSETS_BUCKET = "business-assets";
const QR_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const QR_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Uploads a new payment QR image and returns its storage path. The settings row is only
 * pointed at it when the admin saves Settings, so an abandoned upload changes nothing.
 */
export async function uploadPaymentQr(file: File) {
  const ext = QR_TYPES[file.type];
  if (!ext) throw new DataError("invalid", "Choose a PNG, JPG or WebP image.");
  if (file.size > QR_MAX_BYTES)
    throw new DataError("invalid", "The QR image must be 2 MB or smaller.");
  const path = `payment-qr/${crypto.randomUUID()}.${ext}`;
  const { error } = await db()
    .storage.from(ASSETS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw toDataError(error);
  return path;
}

/** Short-lived link to show the stored QR image in Settings. */
export async function paymentQrUrl(path: string) {
  const { data, error } = await db()
    .storage.from(ASSETS_BUCKET)
    .createSignedUrl(path, 10 * 60);
  if (error) throw toDataError(error);
  return data.signedUrl;
}
