import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Small inline note marking a UI-only feature (nothing is saved or sent). */
export function PreviewNotice({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-1.5 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <Info className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
