import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowUpRight,
  Boxes,
  CalendarClock,
  CheckCircle2,
  FileText,
  PackageCheck,
  Plus,
  Repeat,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
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
import { activity, categoryMix, customers, equipment, inr, invoices, rentals, revenueSeries, statusCount } from "@/lib/data";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Breath Care Kart" },
      {
        name: "description",
        content:
          "Live overview of equipment utilisation, active rentals, invoices and revenue for Breath Care Kart medical rentals.",
      },
      { property: "og:title", content: "Dashboard · Breath Care Kart" },
      { property: "og:description", content: "Equipment utilisation, rentals, invoices and revenue at a glance." },
    ],
  }),
  component: DashboardPage,
});

const chartColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const activityIcon = {
  invoice: FileText,
  return: PackageCheck,
  customer: UserPlus,
  service: Wrench,
  rental: Repeat,
};

function DashboardPage() {
  const available = statusCount("available");
  const rented = statusCount("rented");
  const utilisation = Math.round((rented / equipment.length) * 100);
  const outstanding = invoices.reduce((s, i) => s + (i.amount - i.paid), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Good morning, Arjun"
        description="Here's how Breath Care Kart is running today — Wednesday, 05 August 2026."
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total equipment" value={String(equipment.length)} delta={6} icon={Boxes} hint="vs last month" />
        <StatCard label="Available" value={String(available)} delta={4} icon={CheckCircle2} hint="ready to dispatch" />
        <StatCard label="On rent" value={String(rented)} delta={12} icon={Repeat} hint={`${utilisation}% utilisation`} />
        <StatCard label="Customers" value={String(customers.length)} delta={9} icon={Users} hint="active accounts" />
        <StatCard label="Outstanding" value={inr(outstanding)} delta={-3} icon={FileText} hint="across 3 invoices" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="gap-0 p-5 shadow-xs lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">Revenue &amp; rentals</h2>
              <p className="text-sm text-muted-foreground">Last six months of billed rentals</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
              <ArrowUpRight className="size-3" /> 15.1% MoM
            </span>
          </div>
          <div className="mt-6 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueSeries}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v / 1000}k`}
                />
                <RTooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => inr(v)}
                />
                <Bar dataKey="revenue" fill="var(--chart-1)" radius={[8, 8, 4, 4]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="gap-0 p-5 shadow-xs">
          <h2 className="text-base font-semibold">Equipment status</h2>
          <p className="text-sm text-muted-foreground">Fleet distribution by category</p>
          <div className="mt-2 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryMix} dataKey="value" nameKey="name" innerRadius={46} outerRadius={68} paddingAngle={3}>
                  {categoryMix.map((_, i) => (
                    <Cell key={i} fill={chartColors[i % chartColors.length]} stroke="var(--card)" strokeWidth={2} />
                  ))}
                </Pie>
                <RTooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <Separator className="my-4" />
          <div className="space-y-3">
            {(
              [
                ["Available", available, "bg-success"],
                ["On rent", rented, "bg-primary"],
                ["In service", statusCount("service"), "bg-warning"],
                ["Damaged", statusCount("damaged"), "bg-danger"],
              ] as const
            ).map(([label, count, barClass]) => (
              <div key={label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{count}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${barClass}`}
                    style={{ width: `${(count / equipment.length) * 100}%` }}
                  />
                </div>
              </div>
            ))}

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
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.slice(0, 5).map((inv) => (
                <TableRow key={inv.id} className="transition-colors hover:bg-accent/50">
                  <TableCell className="font-medium">
                    <Link to="/invoices/$invoiceId" params={{ invoiceId: inv.id }} className="hover:text-primary">
                      {inv.number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{inv.customer}</TableCell>
                  <TableCell className="font-medium">{inr(inv.amount)}</TableCell>
                  <TableCell>
                    <StatusBadge tone={inv.status as Tone} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="gap-0 p-5 shadow-xs">
          <h2 className="text-base font-semibold">Activity</h2>
          <p className="text-sm text-muted-foreground">Latest operational events</p>
          <ol className="mt-5 space-y-5">
            {activity.map((item, i) => {
              const Icon = activityIcon[item.kind] ?? Activity;
              return (
                <li key={item.id} className="relative flex gap-3 pl-1">
                  {i !== activity.length - 1 && (
                    <span className="absolute left-[19px] top-9 h-[calc(100%-8px)] w-px bg-border" />
                  )}
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.meta}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground/70">{item.time}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>

      <Card className="gap-0 p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Upcoming returns</h2>
            <p className="text-sm text-muted-foreground">Rentals reaching their due date this cycle</p>
          </div>
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link to="/rentals">
              <CalendarClock className="size-4" /> Rental board
            </Link>
          </Button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rentals.slice(0, 3).map((r) => (
            <div key={r.id} className="card-hover rounded-2xl border p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-snug">{r.equipment}</p>
                <StatusBadge tone={r.status as Tone} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{r.customer}</p>
              <Separator className="my-3" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Due {r.dueDate}</span>
                <span className="font-medium">{inr(r.rate)}/mo</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
