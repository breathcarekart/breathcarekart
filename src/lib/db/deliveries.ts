import { queryOptions } from "@tanstack/react-query";
import { db, unwrap } from "@/lib/db/client";
import { DataError, toDataError } from "@/lib/db/errors";
import { queryKeys } from "@/lib/db/query-keys";
import { deliveryPhotoProblem } from "@/lib/delivery";

const BUCKET = "delivery-photos";

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
 * Uploads to the private bucket at {rentalId}/{timestamp}-{random}-{name}, then records it.
 * Only the supervisor assigned to the rental may upload, while the delivery is in progress
 * (storage and table policies). Existing photos are never replaced.
 */
export async function uploadDeliveryPhoto(rentalId: string, file: File) {
  const problem = deliveryPhotoProblem(file);
  if (problem) throw new DataError("invalid", problem);

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60) || "photo.jpg";
  // The random part keeps photos picked together (often all named image.jpg) apart.
  const path = `${rentalId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;
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

/**
 * Removes a photo the supervisor uploaded, before the delivery is confirmed: the file
 * first (its policy checks the record), then the record.
 */
export async function removeDeliveryPhoto(photo: { id: string; storage_path: string }) {
  const client = db();
  const removed = await client.storage.from(BUCKET).remove([photo.storage_path]);
  if (removed.error) throw toDataError(removed.error);
  const { data, error } = await client
    .from("delivery_photos")
    .delete()
    .eq("id", photo.id)
    .select("id");
  if (error) throw toDataError(error);
  if (!data?.length) {
    throw new DataError("forbidden", "This photo can't be removed any more.");
  }
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
