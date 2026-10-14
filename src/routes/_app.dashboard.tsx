import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Boxes,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  HandCoins,
  History,
  Plus,
  Repeat,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ActivityList } from "@/components/activity/activity-list";
import { SupervisorDashboard } from "@/components/dashboard/supervisor-dashboard";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { QueryState } from "@/components/shared/query-state";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { activityQueries } from "@/lib/db/activity";
import { customerQueries } from "@/lib/db/customers";
import { equipmentQueries } from "@/lib/db/equipment";
import { invoiceQueries } from "@/lib/db/invoices";
import { paymentQueries } from "@/lib/db/payments";
import { rentalQueries } from "@/lib/db/rentals";
import { formatDate, inr, lastMonthKeys, monthKey, monthLabel, todayISO } from "@/lib/format";
import { totalPaid } from "@/lib/payments";
import { canAccess, useCurrentUser } from "@/lib/roles";
import {
  equipmentStatusLabels,
  isOpenRental,
  outstandingOf,
  paymentState,
  paymentStateLabels,
  paymentStateTone,
  rentalStage,
  rentalStageLabels,
  rentalStageTone,
} from "@/lib/status";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Breath Care Kart" },
      {
        name: "description",
        content: "Equipment, rentals, sales, invoices and revenue at a glance.",
      },
    ],
  }),
  component: DashboardPage,
});

const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
};

function DashboardPage() {
  const { role } = useCurrentUser();
  return role === "supervisor" ? <SupervisorDashboard /> : <OperationsDashboard />;
}

function OperationsDashboard() {
  const { role, name } = useCurrentUser();
  const units = useQuery(equipmentQueries.units());
  const customers = useQuery(customerQueries.list());
  const invoices = useQuery(invoiceQueries.list());
  const payments = useQuery(paymentQueries.list());
  const rentals = useQuery(rentalQueries.list());
  const activity = useQuery(activityQueries.recent(6));

  const u = units.data ?? [];
  const count = (s: string) => u.filter((x) => x.status === s).length;
  const live = (invoices.data ?? []).filter(
    (i) => i.status !== "cancelled" && i.status !== "draft",
  );
  const outstanding = live.reduce((s, i) => s + outstandingOf(i), 0);
  const unpaid = live.filter((i) => outstandingOf(i) > 0).length;
  const openRentals = (rentals.data ?? []).filter(isOpenRental);
  const show = (ready: boolean, value: string) => (ready ? value : "—");

  // Two separate measures per month, last 6 months:
  //  - Invoiced: value of issued invoices (incl. GST) by invoice date, split by type.
  //  - Collected: money actually received, by payment date. Includes register
  //    payments that have no invoice, so it is not "Invoiced minus outstanding".
  const months = lastMonthKeys(6);
  const allPayments = payments.data ?? [];
  const series = months.map((key) => {
    const inMonth = live.filter((i) => monthKey(i.invoice_date) === key);
    const collected = totalPaid(allPayments.filter((p) => monthKey(p.payment_date) === key));
    const sum = (type: string) =>
      inMonth
        .filter((i) => i.transaction_type === type)
        .reduce((s, i) => s + Number(i.grand_total), 0);
    return {
      month: monthLabel(key),
      rental: sum("rental"),
      sales: sum("sale"),
      invoiced: sum("rental") + sum("sale"),
      collected,
    };
  });
  const sixMonthInvoiced = series.reduce((s, m) => s + m.invoiced, 0);
  const sixMonthCollected = series.reduce((s, m) => s + m.collected, 0);

  const byCategory = [
    ...u.reduce(
      (m, x) =>
        m.set(
          x.equipment_type?.name ?? "Other",
          (m.get(x.equipment_type?.name ?? "Other") ?? 0) + 1,
        ),
      new Map<string, number>(),
    ),
  ]
    .map(([n, value]) => ({ name: n, value }))
    .sort((a, b) => b.value - a.value);
  const pie =
    byCategory.length > 5
      ? [
          ...byCategory.slice(0, 4),
          { name: "Others", value: byCategory.slice(4).reduce((s, x) => s + x.value, 0) },
        ]
      : byCategory;
  const upcoming = [...openRentals]
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello, ${name.split(" ")[0]}`}
        description={`Here's how Breath Care Kart is running today — ${formatDate(todayISO())}.`}
        actions={
          <>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/customers/new">
                <UserPlus className="size-4" /> Add customer
              </Link>
            </Button>
            <Button asChild className="rounded-xl">
              <Link to="/invoices/new">
                <Plus className="size-4" /> Create invoice
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total equipment"
          value={show(units.isSuccess, String(u.length))}
          icon={Boxes}
          hint="units in the fleet"
        />
        <StatCard
          label="Available"
          value={show(units.isSuccess, String(count("available")))}
          icon={CheckCircle2}
          hint="ready to dispatch"
        />
        <StatCard
          label="On rent"
          value={show(units.isSuccess, String(count("on_rent")))}
          icon={Repeat}
          hint={
            u.length
              ? `${Math.round((count("on_rent") / Math.max(1, u.length - count("sold"))) * 100)}% of fleet`
              : "of fleet"
          }
        />
        <StatCard
          label="Sold"
          value={show(units.isSuccess, String(count("sold")))}
          icon={HandCoins}
          hint="units sold"
        />
        <StatCard
          label="Active rentals"
          value={show(rentals.isSuccess, String(openRentals.length))}
          icon={ClipboardList}
          hint="not yet returned"
        />
        <StatCard
          label="Customers"
          value={show(customers.isSuccess, String(customers.data?.length ?? 0))}
          icon={Users}
          hint="on record"
        />
        <StatCard
          label="Invoices"
          value={show(invoices.isSuccess, String(invoices.data?.length ?? 0))}
          icon={FileText}
          hint={`${inr(sixMonthInvoiced)} invoiced in 6 months`}
        />
        <StatCard
          label="Outstanding"
          value={show(invoices.isSuccess, inr(outstanding))}
          icon={Wallet}
          hint={`across ${unpaid} invoices`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="gap-0 p-5 shadow-xs lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">Invoiced vs collected</h2>
              <p className="text-sm text-muted-foreground">
                Last six months · invoiced by invoice date, collected by payment date
              </p>
            </div>
            <dl className="flex gap-5 text-right">
              <div>
                <dt className="text-xs text-muted-foreground">Invoiced (incl. GST)</dt>
                <dd className="text-lg font-semibold">{inr(sixMonthInvoiced)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Collected (payments received)</dt>
                <dd className="text-lg font-semibold text-success">
                  {show(payments.isSuccess, inr(sixMonthCollected))}
                </dd>
              </div>
            </dl>
          </div>
          <div className="mt-6 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                />
                <RTooltip contentStyle={tooltipStyle} formatter={(v: number) => inr(v)} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="invoiced"
                  name="Invoiced (incl. GST)"
                  fill="var(--chart-1)"
                  radius={[8, 8, 4, 4]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="collected"
                  name="Collected (payments received)"
                  fill="var(--success)"
                  radius={[8, 8, 4, 4]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="gap-0 p-5 shadow-xs">
          <h2 className="text-base font-semibold">Rental vs Sales</h2>
          <p className="text-sm text-muted-foreground">Invoiced value by transaction type</p>
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                />
                <RTooltip contentStyle={tooltipStyle} formatter={(v: number) => inr(v)} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="rental"
                  name="Rental"
                  stackId="v"
                  fill="var(--chart-1)"
                  maxBarSize={36}
                />
                <Bar
                  dataKey="sales"
                  name="Sales"
                  stackId="v"
                  fill="var(--chart-2)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="gap-0 overflow-hidden p-0 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-base font-semibold">Recent invoices</h2>
            <Button asChild variant="ghost" size="sm" className="rounded-lg">
              <Link to="/invoices">View all</Link>
            </Button>
          </div>
          <QueryState
            query={invoices}
            empty={<p className="px-5 pb-6 text-sm text-muted-foreground">No invoices yet.</p>}
          >
            {(list) => (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden sm:table-cell">Created by</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.slice(0, 5).map((inv) => {
                    const st = paymentState(inv);
                    return (
                      <TableRow key={inv.id} className="transition-colors hover:bg-accent/50">
                        <TableCell className="font-medium">
                          <Link
                            to="/invoices/$invoiceId"
                            params={{ invoiceId: inv.id }}
                            className="hover:text-primary"
                          >
                            {inv.invoice_number}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {inv.customer?.name}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">
                          {inv.creator?.full_name ?? "—"}
                        </TableCell>
                        <TableCell className="font-medium">{inr(inv.grand_total)}</TableCell>
                        <TableCell>
                          <StatusBadge tone={paymentStateTone[st]} label={paymentStateLabels[st]} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </QueryState>
        </Card>

        <Card className="gap-0 p-5 shadow-xs">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">Recent activity</h2>
              <p className="text-sm text-muted-foreground">Who did what, most recent first</p>
            </div>
            {canAccess(role, "/activity") && (
              <Button asChild variant="ghost" size="sm" className="rounded-lg">
                <Link to="/activity">
                  <History className="size-4" /> Log
                </Link>
              </Button>
            )}
          </div>
          <div className="mt-5">
            <QueryState
              query={activity}
              empty={<p className="text-sm text-muted-foreground">No activity yet.</p>}
            >
              {(entries) => <ActivityList entries={entries} compact />}
            </QueryState>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="gap-0 p-5 shadow-xs">
          <h2 className="text-base font-semibold">Equipment utilization</h2>
          <p className="text-sm text-muted-foreground">Fleet mix by category and current status</p>
          {u.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              {units.isPending ? "Loading…" : "No equipment yet."}
            </p>
          ) : (
            <>
              <div className="mt-2 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pie}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={46}
                      outerRadius={68}
                      paddingAngle={3}
                    >
                      {pie.map((_, i) => (
                        <Cell
                          key={i}
                          fill={chartColors[i % chartColors.length]}
                          stroke="var(--card)"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <RTooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <Separator className="my-4" />
              <div className="space-y-3">
                {(
                  [
                    ["available", "bg-success"],
                    ["on_rent", "bg-primary"],
                    ["maintenance", "bg-warning"],
                    ["repair", "bg-danger"],
                    ["sold", "bg-muted-foreground"],
                  ] as const
                ).map(([s, bar]) => (
                  <div key={s} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{equipmentStatusLabels[s]}</span>
                      <span className="font-medium">{count(s)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${bar}`}
                        style={{ width: `${(count(s) / u.length) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card className="gap-0 p-5 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Upcoming returns</h2>
              <p className="text-sm text-muted-foreground">Open rentals by end date</p>
            </div>
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link to="/rentals">
                <CalendarClock className="size-4" /> Rentals
              </Link>
            </Button>
          </div>
          {upcoming.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                icon={Repeat}
                title="No open rentals"
                description="Rentals you create will show their return dates here."
              />
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {upcoming.map((r) => {
                const st = rentalStage(r);
                return (
                  <Link
                    key={r.id}
                    to="/deliveries/$rentalId"
                    params={{ rentalId: r.id }}
                    className="card-hover rounded-2xl border p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">
                        {r.rental_items
                          .map((i) => i.equipment_type?.name ?? i.description)
                          .join(", ")}
                      </p>
                      <StatusBadge tone={rentalStageTone[st]} label={rentalStageLabels[st]} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{r.customer?.name}</p>
                    <Separator className="my-3" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Ends {formatDate(r.due_date)}</span>
                      <span className="font-mono">{r.rental_number}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
