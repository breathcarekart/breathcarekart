import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, PackageCheck, Repeat } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inr, rentals } from "@/lib/data";

export const Route = createFileRoute("/_app/rentals")({
  head: () => ({
    meta: [
      { title: "Active rentals · Breath Care Kart" },
      {
        name: "description",
        content: "Track live rentals, due dates and returns. Renew or close a rental in a single click.",
      },
      { property: "og:title", content: "Active rentals · Breath Care Kart" },
      { property: "og:description", content: "Live rentals with due dates, renewals and returns." },
    ],
  }),
  component: RentalsPage,
});

function RentalsPage() {
  const overdue = rentals.filter((r) => r.status === "overdue").length;
  const dueSoon = rentals.filter((r) => r.status === "due-soon").length;
  const monthly = rentals.reduce((s, r) => s + r.rate, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Active rentals"
        description={`${rentals.length} units in the field · ${inr(monthly)} recurring per month`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active rentals" value={String(rentals.length)} delta={7} icon={Repeat} hint="in the field" />
        <StatCard label="Due in 7 days" value={String(dueSoon)} icon={CalendarClock} hint="plan pickups" />
        <StatCard label="Overdue" value={String(overdue)} delta={-2} icon={CalendarClock} hint="needs follow-up" />
        <StatCard label="Recurring value" value={inr(monthly)} delta={12} icon={PackageCheck} hint="per month" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rentals.map((r) => (
          <Card key={r.id} className="card-hover gap-0 p-5 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{r.equipment}</p>
                <Link
                  to="/customers/$customerId"
                  params={{ customerId: r.customerId }}
                  className="text-xs text-muted-foreground hover:text-primary"
                >
                  {r.customer}
                </Link>
              </div>
              <StatusBadge tone={r.status as Tone} />
            </div>
            <Separator className="my-4" />
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Started</dt>
                <dd>{r.startDate}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Due</dt>
                <dd>{r.dueDate}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Rate</dt>
                <dd className="font-medium">{inr(r.rate)}/mo</dd>
              </div>
            </dl>
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                className="flex-1 rounded-xl"
                onClick={() => toast.success(`${r.equipment} renewed for 30 days`)}
              >
                Renew
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => toast.success(`${r.equipment} marked returned`)}
              >
                Return
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="gap-0 overflow-hidden p-0 shadow-xs">
        <div className="px-5 py-4">
          <h2 className="text-base font-semibold">Rental ledger</h2>
          <p className="text-sm text-muted-foreground">Every open rental with its billing schedule</p>
        </div>
        <Separator />
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Equipment</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="hidden md:table-cell">Start</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rentals.map((r) => (
              <TableRow key={r.id} className="transition-colors hover:bg-accent/50">
                <TableCell className="text-sm font-medium">{r.equipment}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.customer}</TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{r.startDate}</TableCell>
                <TableCell className="text-sm">{r.dueDate}</TableCell>
                <TableCell>
                  <StatusBadge tone={r.status as Tone} />
                </TableCell>
                <TableCell className="text-right text-sm font-medium">{inr(r.rate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
