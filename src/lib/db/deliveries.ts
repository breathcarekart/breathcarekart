import { queryOptions } from "@tanstack/react-query";
import { db, unwrap } from "@/lib/db/client";
import { DataError, toDataError } from "@/lib/db/errors";
import { queryKeys } from "@/lib/db/query-keys";

const BUCKET = "delivery-photos";
const MAX_BYTES = 10 * 1024 * 1024;

export async function fetchDeliveryPhotos(rentalId: string) {
  return unwrap(
    await db()
      .from("delivery_photos")
      .select("*, uploader:profiles(id, full_name, role)")
      .eq("rental_id", rentalId)
      .order("created_at", { ascending: false }),
  );
}

/**
 * Uploads to the private bucket at {rentalId}/{timestamp}-{name}, then records it.
 * Storage and table access are both limited to office staff and the assigned supervisor.
 */
export async function uploadDeliveryPhoto(rentalId: string, file: File) {
  if (!file.type.startsWith("image/"))
    throw new DataError("invalid", "Choose an image file (JPG, PNG or HEIC).");
  if (file.size > MAX_BYTES) throw new DataError("invalid", "Photos must be 10 MB or smaller.");

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60) || "photo.jpg";
  const path = `${rentalId}/${Date.now()}-${safeName}`;
  const client = db();

  const upload = await client.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) throw toDataError(upload.error);

  const { data, error } = await client
    .from("delivery_photos")
    .insert({ rental_id: rentalId, storage_path: path })
    .select()
    .single();
  if (error) {
    // Don't leave an orphaned file if the record couldn't be saved.
    await client.storage.from(BUCKET).remove([path]);
    throw toDataError(error);
  }
  return data;
}

/** Short-lived link for viewing a private photo. */
export async function deliveryPhotoUrl(path: string) {
  const { data, error } = await db()
    .storage.from(BUCKET)
    .createSignedUrl(path, 10 * 60);
  if (error) throw toDataError(error);
  return data.signedUrl;
}

export const deliveryQueries = {
  photos: (rentalId: string) =>
    queryOptions({
      queryKey: queryKeys.deliveryPhotos.byRental(rentalId),
      queryFn: () => fetchDeliveryPhotos(rentalId),
    }),
};
