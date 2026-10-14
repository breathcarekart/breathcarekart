import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarClock, CheckCircle2, ClipboardList, Truck } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { CardsSkeleton } from "@/components/shared/loaders";
import { PageHeader } from "@/components/shared/page-header";
import { QueryState } from "@/components/shared/query-state";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { rentalQueries } from "@/lib/db/rentals";
import { formatDate, todayISO } from "@/lib/format";
import { useCurrentUser } from "@/lib/roles";
import {
  asDeliveryStatus,
  deliveryStatusLabels,
  deliveryStatusTone,
  isOpenRental,
  rentalStage,
} from "@/lib/status";

/** Focused dashboard for supervisors: only rentals assigned to them (enforced by RLS). */
export function SupervisorDashboard() {
  const { profile, name } = useCurrentUser();
  const query = useQuery(rentalQueries.list());
  const today = todayISO();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello, ${name.split(" ")[0]}`}
        description={`Your deliveries and assigned rentals — ${formatDate(today)}.`}
      />
      <QueryState query={query} loading={<CardsSkeleton />} errorTitle="Couldn't load your rentals">
        {(all) => {
          const mine = all.filter((r) => r.supervisor_id === profile.id);
          const open = mine.filter(isOpenRental);
          const pendingDelivery = open.filter(
            (r) => asDeliveryStatus(r.delivery_status) !== "delivered",
          );
          const deliveredToday = mine.filter((r) => r.delivered_at?.slice(0, 10) === today);
          const pendingReturn = open.filter((r) =>
            ["due_soon", "overdue"].includes(rentalStage(r)),
          );
          const rows = [...open].sort(
            (a, b) =>
              Number(asDeliveryStatus(a.delivery_status) === "delivered") -
                Number(asDeliveryStatus(b.delivery_status) === "delivered") ||
              a.start_date.localeCompare(b.start_date),
          );
          return (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Assigned rentals"
                  value={String(open.length)}
                  icon={ClipboardList}
                  hint="open and assigned to you"
                />
                <StatCard
                  label="Pending delivery"
                  value={String(pendingDelivery.length)}
                  icon={Truck}
                  hint="assigned or out for delivery"
                />
                <StatCard
                  label="Delivered today"
                  value={String(deliveredToday.length)}
                  icon={CheckCircle2}
                  hint="confirmed with photo"
                />
                <StatCard
                  label="Pending return"
                  value={String(pendingReturn.length)}
                  icon={CalendarClock}
                  hint="due soon or overdue"
                />
              </div>

              <Card className="gap-0 overflow-hidden p-0 shadow-xs">
                <div className="px-5 py-4">
                  <h2 className="text-base font-semibold">My Rentals</h2>
                  <p className="text-sm text-muted-foreground">
                    Open rentals assigned to you, deliveries first.
                  </p>
                </div>
                {rows.length === 0 ? (
                  <div className="px-5 pb-5">
                    <EmptyState
                      icon={ClipboardList}
                      title="No rentals assigned"
                      description="Rentals the office assigns to you will appear here."
                    />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Rental ID</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="hidden md:table-cell">Equipment</TableHead>
                        <TableHead className="hidden sm:table-cell">Delivery date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => {
                        const d = asDeliveryStatus(r.delivery_status);
                        const items = r.rental_items
                          .map((i) => i.equipment_type?.name ?? i.description)
                          .join(", ");
                        return (
                          <TableRow key={r.id} className="transition-colors hover:bg-accent/50">
                            <TableCell className="font-mono text-xs font-medium">
                              {r.rental_number}
                            </TableCell>
                            <TableCell>
                              <span className="block text-sm font-medium">{r.customer?.name}</span>
                              <span className="block text-xs text-muted-foreground md:hidden">
                                {items}
                              </span>
                            </TableCell>
                            <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                              {items}
                            </TableCell>
                            <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                              {formatDate(r.delivered_at ?? r.start_date)}
                            </TableCell>
                            <TableCell>
                              <StatusBadge
                                tone={deliveryStatusTone[d]}
                                label={deliveryStatusLabels[d]}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-lg"
                              >
                                <Link to="/deliveries/$rentalId" params={{ rentalId: r.id }}>
                                  <Truck className="size-4" />
                                  <span className="hidden sm:inline">
                                    {d === "delivered" ? "View" : "Delivery details"}
                                  </span>
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
