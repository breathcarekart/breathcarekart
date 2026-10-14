import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, ClipboardList, Plus, Repeat, ScrollText, Truck } from "lucide-react";
import { useState } from "react";
import {
  RenewRentalDialog,
  ReturnRentalDialog,
  type RentalRef,
} from "@/components/rentals/rental-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { CardsSkeleton } from "@/components/shared/loaders";
import { PageHeader } from "@/components/shared/page-header";
import { QueryState } from "@/components/shared/query-state";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { rentalQueries } from "@/lib/db/rentals";
import { formatDate, inr } from "@/lib/format";
import { isOfficeRole, useCurrentUser } from "@/lib/roles";
import { isOpenRental, rentalStage, rentalStageLabels, rentalStageTone } from "@/lib/status";

export const Route = createFileRoute("/_app/rentals")({
  head: () => ({
    meta: [
      { title: "Active rentals · Breath Care Kart" },
      {
        name: "description",
        content: "Open rentals with delivery status, due dates, renewals and returns.",
      },
    ],
  }),
  component: RentalsPage,
});

function RentalsPage() {
  const { role } = useCurrentUser();
  const office = isOfficeRole(role);
  const query = useQuery(rentalQueries.list());
  const [renewing, setRenewing] = useState<RentalRef | null>(null);
  const [returning, setReturning] = useState<RentalRef | null>(null);

  const open = (query.data ?? []).filter(isOpenRental);
  const stages = open.map(rentalStage);
  const awaiting = stages.filter(
    (s) => s === "pending" || s === "assigned" || s === "out_for_delivery",
  ).length;
  const dueSoon = stages.filter((s) => s === "due_soon").length;
  const overdue = stages.filter((s) => s === "overdue").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Active rentals"
        description={query.data ? `${open.length} open rentals` : "Open rentals"}
        actions={
          <>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/inventory/rental-logs">
                <ScrollText className="size-4" /> Rental logs
              </Link>
            </Button>
            {office && (
              <Button asChild className="rounded-xl">
                <Link to="/invoices/new" search={{ type: "rental" }}>
                  <Plus className="size-4" /> New rental
                </Link>
              </Button>
            )}
          </>
        }
      />

      <QueryState query={query} loading={<CardsSkeleton />} errorTitle="Couldn't load rentals">
        {() => (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Open rentals"
                value={String(open.length)}
                icon={Repeat}
                hint="not yet returned"
              />
              <StatCard
                label="Awaiting delivery"
                value={String(awaiting)}
                icon={Truck}
                hint="not delivered yet"
              />
              <StatCard
                label="Due in 7 days"
                value={String(dueSoon)}
                icon={CalendarClock}
                hint="plan pickups"
              />
              <StatCard
                label="Overdue"
                value={String(overdue)}
                icon={ClipboardList}
                hint="past end date"
              />
            </div>

            {open.length === 0 ? (
              <EmptyState
                icon={Repeat}
                title="No open rentals"
                description={
                  office
                    ? "Create a rental invoice to dispatch equipment."
                    : "Rentals assigned to you will appear here."
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {open.map((r) => {
                  const st = rentalStage(r);
                  return (
                    <Card key={r.id} className="card-hover gap-0 p-5 shadow-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-xs text-muted-foreground">
                            {r.rental_number}
                          </p>
                          <p className="truncate text-sm font-semibold">
                            {r.rental_items
                              .map((i) => i.equipment_type?.name ?? i.description)
                              .join(", ")}
                          </p>
                          {office ? (
                            <Link
                              to="/customers/$customerId"
                              params={{ customerId: r.customer_id }}
                              className="text-xs text-muted-foreground hover:text-primary"
                            >
                              {r.customer?.name}
                            </Link>
                          ) : (
                            <p className="text-xs text-muted-foreground">{r.customer?.name}</p>
                          )}
                        </div>
                        <StatusBadge tone={rentalStageTone[st]} label={rentalStageLabels[st]} />
                      </div>
                      <Separator className="my-4" />
                      <dl className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Supervisor</dt>
                          <dd>{r.supervisor?.full_name ?? "Unassigned"}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Started</dt>
                          <dd>{formatDate(r.start_date)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Ends</dt>
                          <dd>{formatDate(r.due_date)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Rate</dt>
                          <dd className="font-medium">
                            {inr(r.rental_items.reduce((s, i) => s + Number(i.rate ?? 0), 0))}/mo
                          </dd>
                        </div>
                      </dl>
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="mt-3 h-8 w-full rounded-xl text-primary"
                      >
                        <Link to="/deliveries/$rentalId" params={{ rentalId: r.id }}>
                          <Truck className="size-4" /> Rental &amp; delivery
                        </Link>
                      </Button>
                      {office && (
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 rounded-xl"
                            onClick={() => setRenewing(r)}
                          >
                            Renew
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 rounded-xl"
                            onClick={() => setReturning(r)}
                          >
                            Return
                          </Button>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </QueryState>

      <RenewRentalDialog rental={renewing} onClose={() => setRenewing(null)} />
      <ReturnRentalDialog rental={returning} onClose={() => setReturning(null)} />
    </div>
  );
}
