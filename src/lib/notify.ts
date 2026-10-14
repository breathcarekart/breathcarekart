import { toast } from "sonner";
import { toDataError } from "@/lib/db/errors";

/** Success toast after a database write. */
export function notifySuccess(message: string, description?: string) {
  toast.success(message, description ? { description } : undefined);
}

/** Error toast with a user-safe message (raw database errors are never shown). */
export function notifyError(error: unknown, fallbackTitle = "Couldn't save changes") {
  const dataError = toDataError(error);
  console.error(dataError.cause ?? dataError);
  toast.error(fallbackTitle, { description: dataError.message });
}
