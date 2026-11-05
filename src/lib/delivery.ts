// Who may record a delivery, and which photos are accepted. The database enforces the
// same rules (set_delivery_status, delivery_photos and storage policies); this decides
// what the delivery page shows.
//
// Kept free of app imports so the unit tests can run with plain `node --test`.

export const MAX_DELIVERY_PHOTO_BYTES = 10 * 1024 * 1024;

/** Matches the delivery-photos bucket's allowed types. */
export const DELIVERY_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

type RentalForDelivery = {
  status: string;
  delivery_status: string;
  supervisor_id: string | null;
};

const CLOSED_RENTAL = new Set(["completed", "cancelled"]);

/**
 * Delivery confirmation (photos, notes, out for delivery, confirm) is the assigned
 * supervisor's job, while the delivery is in progress and the rental is open. Admins and
 * telecallers manage deliveries (assign, view status and photos) but don't record them.
 */
export function canRecordDelivery(
  user: { role: string; profileId: string },
  rental: RentalForDelivery,
): boolean {
  return (
    user.role === "supervisor" &&
    rental.supervisor_id === user.profileId &&
    !CLOSED_RENTAL.has(rental.status) &&
    (rental.delivery_status === "assigned" || rental.delivery_status === "out_for_delivery")
  );
}

/** A supervisor may remove a photo they uploaded, until delivery is confirmed. */
export const canRemoveDeliveryPhoto = (
  user: { role: string; profileId: string },
  rental: RentalForDelivery,
  photo: { uploaded_by: string | null },
) => canRecordDelivery(user, rental) && photo.uploaded_by === user.profileId;

/** Why a chosen file can't be uploaded, or null when it's fine. */
export function deliveryPhotoProblem(file: { name: string; type: string; size: number }) {
  if (!(DELIVERY_PHOTO_TYPES as readonly string[]).includes(file.type.toLowerCase())) {
    return `${file.name}: choose a JPG, PNG, WebP or HEIC photo.`;
  }
  if (file.size === 0) return `${file.name}: the file is empty.`;
  if (file.size > MAX_DELIVERY_PHOTO_BYTES) {
    return `${file.name}: photos must be 10 MB or smaller.`;
  }
  return null;
}
