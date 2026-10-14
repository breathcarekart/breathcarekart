import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toDataError } from "@/lib/db/errors";

/** Inline error panel for a failed data load, styled to match EmptyState. */
export function ErrorState({
  error,
  title = "Couldn't load this data",
  onRetry,
}: {
  error: unknown;
  title?: string | undefined;
  onRetry?: (() => void) | undefined;
}) {
  const { message } = toDataError(error);
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-destructive/30 px-6 py-16 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button variant="outline" className="rounded-xl" onClick={onRetry}>
          <RotateCw className="size-4" /> Try again
        </Button>
      ) : null}
    </div>
  );
}
