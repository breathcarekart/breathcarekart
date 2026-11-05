import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ImageIcon, ImagePlus, Loader2, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { queryKeys } from "@/lib/db/query-keys";
import { deliveryPhotoUrl, removeDeliveryPhoto, uploadDeliveryPhoto } from "@/lib/db/deliveries";
import { DataError } from "@/lib/db/errors";
import { DELIVERY_PHOTO_TYPES, deliveryPhotoProblem } from "@/lib/delivery";
import { formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

export type DeliveryPhoto = {
  id: string;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
  uploader: { full_name: string | null } | null;
};

type Pending = { key: string; file: File; preview: string; error: string | null };

/**
 * Delivery photos for one rental. Everyone who can see the rental sees the uploaded photos.
 * The assigned supervisor (`canUpload`) can also pick several photos, preview and remove
 * them before uploading, add more at any time, and remove photos they uploaded until the
 * delivery is confirmed (`canRemove`). The database enforces the same rules.
 */
export function DeliveryPhotos({
  rentalId,
  photos,
  canUpload,
  canRemove,
  onView,
}: {
  rentalId: string;
  photos: DeliveryPhoto[];
  canUpload: boolean;
  canRemove: (photo: DeliveryPhoto) => boolean;
  onView: (path: string) => void;
}) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);

  // Release preview URLs when photos leave the tray or the page closes.
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);
  const drop = (key: string) =>
    setPending((list) => {
      const gone = list.find((p) => p.key === key);
      if (gone) {
        URL.revokeObjectURL(gone.preview);
        previews.current.delete(gone.preview);
      }
      return list.filter((p) => p.key !== key);
    });

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const added = Array.from(files).map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      return {
        key: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        preview,
        error: deliveryPhotoProblem(file),
      };
    });
    setPending((list) => [...list, ...added]);
  };

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.rentals.all });
    await queryClient.invalidateQueries({ queryKey: queryKeys.activity.all });
  };

  // Uploads one at a time; a failed photo stays in the tray with its reason.
  const upload = useMutation({
    mutationFn: async (items: Pending[]) => {
      let done = 0;
      for (const item of items) {
        try {
          await uploadDeliveryPhoto(rentalId, item.file);
          done++;
          drop(item.key);
        } catch (error) {
          const message =
            error instanceof DataError ? error.message : "Couldn't upload this photo. Try again.";
          setPending((list) =>
            list.map((p) => (p.key === item.key ? { ...p, error: message } : p)),
          );
        }
      }
      return { done, failed: items.length - done };
    },
    onSuccess: async ({ done, failed }) => {
      await refresh();
      if (done) notifySuccess(`${done} delivery photo${done === 1 ? "" : "s"} uploaded`);
      if (failed)
        notifyError(new Error(), `${failed} photo${failed === 1 ? "" : "s"} not uploaded`);
    },
  });

  const remove = useMutation({
    mutationFn: removeDeliveryPhoto,
    onSuccess: async () => {
      await refresh();
      notifySuccess("Photo removed");
    },
    onError: (error) => notifyError(error, "Photo not removed"),
  });

  const ready = pending.filter((p) => !p.error);
  const busy = upload.isPending;

  return (
    <div className="space-y-4">
      {photos.length > 0 ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-success">
            <CheckCircle2 className="size-4" />
            {photos.length} delivery photo{photos.length === 1 ? "" : "s"} uploaded
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <li key={p.id} className="overflow-hidden rounded-xl border">
                <button
                  type="button"
                  onClick={() => onView(p.storage_path)}
                  className="block aspect-square w-full bg-muted/40"
                  aria-label="View delivery photo"
                >
                  <PhotoThumb path={p.storage_path} />
                </button>
                <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {p.uploader?.full_name ?? "Staff"} · {formatDateTime(p.created_at)}
                  </span>
                  {canRemove(p) && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7 shrink-0 rounded-lg text-danger"
                      aria-label="Remove this photo"
                      disabled={remove.isPending || busy}
                      onClick={() => remove.mutate(p)}
                    >
                      {remove.isPending && remove.variables?.id === p.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : !canUpload ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No delivery photo yet.
        </p>
      ) : null}

      {canUpload && (
        <>
          <input
            ref={input}
            type="file"
            accept={DELIVERY_PHOTO_TYPES.join(",")}
            multiple
            className="sr-only"
            aria-label="Choose delivery photos"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {pending.length === 0 ? (
            // The large picker only for the first photos; afterwards "Add More Images" below.
            photos.length === 0 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => input.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-7 text-center transition-colors hover:border-primary/50 hover:bg-primary-soft/40 disabled:opacity-60"
              >
                <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <ImagePlus className="size-5" />
                </span>
                <span className="text-sm font-medium">Choose delivery photos</span>
                <span className="text-xs text-muted-foreground">
                  Take photos or choose several · JPG, PNG, WebP or HEIC · up to 10 MB each
                </span>
              </button>
            ) : null
          ) : (
            <div className="space-y-3 rounded-2xl border p-3">
              <p className="text-sm font-medium">
                Selected photos ({pending.length}) — not uploaded yet
              </p>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {pending.map((p) => (
                  <li
                    key={p.key}
                    className={cn(
                      "relative overflow-hidden rounded-xl border",
                      p.error && "border-danger/40",
                    )}
                  >
                    <img
                      src={p.preview}
                      alt={p.file.name}
                      className={cn("aspect-square w-full object-cover", p.error && "opacity-40")}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="absolute right-1.5 top-1.5 size-7 rounded-full shadow"
                      aria-label={`Remove ${p.file.name}`}
                      disabled={busy}
                      onClick={() => drop(p.key)}
                    >
                      <X className="size-3.5" />
                    </Button>
                    <p
                      className={cn(
                        "truncate px-2 py-1 text-xs",
                        p.error ? "whitespace-normal text-danger" : "text-muted-foreground",
                      )}
                    >
                      {p.error ?? p.file.name}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  disabled={busy}
                  onClick={() => input.current?.click()}
                >
                  <ImagePlus className="size-4" /> Add More Images
                </Button>
                <Button
                  type="button"
                  className="rounded-xl"
                  disabled={busy || ready.length === 0}
                  onClick={() => upload.mutate(ready)}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}{" "}
                  {busy
                    ? "Uploading…"
                    : `Upload ${ready.length} photo${ready.length === 1 ? "" : "s"}`}
                </Button>
              </div>
            </div>
          )}

          {pending.length === 0 && photos.length > 0 && (
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <ImagePlus className="size-4" /> Add More Images
            </Button>
          )}
        </>
      )}
    </div>
  );
}

/** Thumbnail of a private photo through a short-lived signed link. */
function PhotoThumb({ path }: { path: string }) {
  const url = useQuery({
    queryKey: ["delivery-photo-url", path],
    queryFn: () => deliveryPhotoUrl(path),
    staleTime: 8 * 60_000,
  });
  if (url.data) {
    return <img src={url.data} alt="Delivery photo" className="size-full object-cover" />;
  }
  return (
    <span className="flex size-full items-center justify-center text-muted-foreground">
      {url.isError ? <ImageIcon className="size-6" /> : <Loader2 className="size-5 animate-spin" />}
    </span>
  );
}
