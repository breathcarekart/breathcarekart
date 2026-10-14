import { HandCoins, Repeat, ShieldCheck, Truck, Headset } from "lucide-react";
import type { TransactionType } from "@/lib/db/types";
import { roleLabels, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

const roleStyles: Record<Role, { className: string; icon: typeof ShieldCheck }> = {
  admin: { className: "bg-primary-soft text-primary border-primary/20", icon: ShieldCheck },
  telecaller: { className: "bg-muted text-foreground border-border", icon: Headset },
  supervisor: {
    className: "bg-warning-soft text-warning-foreground border-warning/30",
    icon: Truck,
  },
};

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  const { className: tone, icon: Icon } = roleStyles[role];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tone,
        className,
      )}
    >
      <Icon className="size-3" />
      {roleLabels[role]}
    </span>
  );
}

export function TransactionBadge({
  type,
  className,
}: {
  type: TransactionType;
  className?: string;
}) {
  const Icon = type === "sale" ? HandCoins : Repeat;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3" />
      {type === "sale" ? "Sale" : "Rental"}
    </span>
  );
}
