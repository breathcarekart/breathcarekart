import {
  Boxes,
  Camera,
  FileText,
  HandCoins,
  History,
  Repeat,
  Truck,
  UserCog,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { RoleBadge } from "@/components/shared/badges";
import type { ActivityItem } from "@/lib/db/activity";
import { formatDateTime } from "@/lib/format";
import { toRole } from "@/lib/roles";

const icons: Record<string, LucideIcon> = {
  customer: UserPlus,
  equipment: Boxes,
  rental: Repeat,
  sale: HandCoins,
  invoice: FileText,
  payment: Wallet,
  profile: UserCog,
};

function activityIcon(entry: Pick<ActivityItem, "entity_type" | "action">): LucideIcon {
  if (entry.action === "delivery_photo_uploaded") return Camera;
  if (
    entry.action.startsWith("delivery") ||
    entry.action === "out_for_delivery" ||
    entry.action === "delivered"
  )
    return Truck;
  return icons[entry.entity_type] ?? History;
}

/** Audit entries with who did each action — "By Anitha — Telecaller". */
export function ActivityList({
  entries,
  compact = false,
}: {
  entries: ActivityItem[];
  compact?: boolean;
}) {
  return (
    <ol className={compact ? "space-y-5" : "divide-y"}>
      {entries.map((e) => {
        const Icon = activityIcon(e);
        return (
          <li key={e.id} className={compact ? "flex gap-3" : "flex gap-3 px-1 py-4"}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <p className="text-sm font-medium leading-snug">
                  {e.description ?? e.action.replace(/_/g, " ")}
                </p>
                {!compact && (
                  <time className="text-xs text-muted-foreground" dateTime={e.created_at}>
                    {formatDateTime(e.created_at)}
                  </time>
                )}
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                By {e.actor?.full_name ?? (e.actor_id ? "Staff member" : "System")}
                {e.actor ? (
                  <RoleBadge role={toRole(e.actor.role)} className="px-1.5 py-0 text-[11px]" />
                ) : null}
              </p>
              {compact && (
                <p className="mt-0.5 text-xs text-muted-foreground/70">
                  {formatDateTime(e.created_at)}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
