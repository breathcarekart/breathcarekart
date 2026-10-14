import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { invoiceQueries } from "@/lib/db/invoices";
import { rentalQueries } from "@/lib/db/rentals";
import { formatDate, inr } from "@/lib/format";
import { isOfficeRole, useCurrentUser } from "@/lib/roles";
import { outstandingOf, paymentState, rentalStage } from "@/lib/status";

type Notice = { key: string; title: string; detail: string; to: () => void };

/** Things needing attention, derived from live data for the signed-in role. */
export function NotificationsMenu() {
  const navigate = useNavigate();
  const { role, profile } = useCurrentUser();
  const office = isOfficeRole(role);
  const rentals = useQuery(rentalQueries.list());
  const invoices = useQuery({ ...invoiceQueries.list(), enabled: office });

  const notices: Notice[] = [];
  for (const r of rentals.data ?? []) {
    const stage = rentalStage(r);
    if (
      role === "supervisor"
        ? r.supervisor_id === profile.id && (stage === "assigned" || stage === "out_for_delivery")
        : stage === "pending"
    ) {
      notices.push({
        key: `d-${r.id}`,
        title:
          stage === "pending"
            ? `${r.rental_number} needs a supervisor`
            : `${r.rental_number} awaiting delivery`,
        detail: `${r.customer?.name ?? "Customer"} · from ${formatDate(r.start_date)}`,
        to: () => navigate({ to: "/deliveries/$rentalId", params: { rentalId: r.id } }),
      });
    } else if (office && (stage === "overdue" || stage === "due_soon")) {
      notices.push({
        key: `r-${r.id}`,
        title: `${r.rental_number} ${stage === "overdue" ? "is overdue for return" : "is due soon"}`,
        detail: `${r.customer?.name ?? "Customer"} · due ${formatDate(r.due_date)}`,
        to: () => navigate({ to: "/inventory/rental-logs" }),
      });
    }
  }
  for (const inv of invoices.data ?? []) {
    if (paymentState(inv) === "overdue") {
      notices.push({
        key: `i-${inv.id}`,
        title: `Invoice ${inv.invoice_number} overdue`,
        detail: `${inv.customer?.name ?? "Customer"} · ${inr(outstandingOf(inv))} outstanding`,
        to: () => navigate({ to: "/invoices/$invoiceId", params: { invoiceId: inv.id } }),
      });
    }
  }
  const shown = notices.slice(0, 6);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-xl"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          {notices.length > 0 && (
            <span className="absolute right-2 top-2 size-1.5 rounded-full bg-danger" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {shown.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            You&apos;re all caught up.
          </p>
        ) : (
          shown.map((n) => (
            <DropdownMenuItem key={n.key} className="flex-col items-start gap-0.5" onClick={n.to}>
              <span className="text-sm font-medium">{n.title}</span>
              <span className="text-xs text-muted-foreground">{n.detail}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
