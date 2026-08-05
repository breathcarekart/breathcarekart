import { createFileRoute } from "@tanstack/react-router";
import { Download, IndianRupee, Percent, Repeat, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { equipment, inr, revenueSeries } from "@/lib/data";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({
    meta: [
      { title: "Reports · Breath Care Kart" },
      {
        name: "description",
        content: "Revenue, utilisation and rental analytics with exportable inventory and billing reports.",
      },
      { property: "og:title", content: "Reports · Breath Care Kart" },
      { property: "og:description", content: "Revenue, utilisation and rental analytics for medical equipment." },
    ],
  }),
  component: ReportsPage,
});

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
};

function ReportsPage() {
  const revenue = revenueSeries.reduce((s, r) => s + r.revenue, 0);
  const top = [...equipment].sort((a, b) => b.monthlyRate - a.monthlyRate).slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Six-month performance across revenue, utilisation and fleet health."
        actions={
          <Button variant="outline" className="rounded-xl" onClick={() => toast.success("Report exported as XLSX")}>
            <Download className="size-4" /> Export report
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue (6 mo)" value={inr(revenue)} delta={15} icon={IndianRupee} hint="billed rentals" />
        <StatCard label="Avg. rental value" value={inr(9200)} delta={5} icon={TrendingUp} hint="per invoice" />
        <StatCard label="Utilisation" value="42%" delta={8} icon={Percent} hint="fleet on rent" />
        <StatCard label="Renewals" value="68%" delta={3} icon={Repeat} hint="cycle over cycle" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-0 p-5 shadow-xs">
          <h2 className="text-base font-semibold">Revenue trend</h2>
          <p className="text-sm text-muted-foreground">Monthly billed value</p>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v / 1000}k`}
                />
                <RTooltip contentStyle={tooltipStyle} formatter={(v: number) => inr(v)} />
                <Area dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="gap-0 p-5 shadow-xs">
          <h2 className="text-base font-semibold">Rental volume</h2>
          <p className="text-sm text-muted-foreground">Units dispatched per month</p>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueSeries}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <RTooltip contentStyle={tooltipStyle} />
                <Line dataKey="rentals" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="gap-0 overflow-hidden p-0 shadow-xs">
        <div className="px-5 py-4">
          <h2 className="text-base font-semibold">Top revenue assets</h2>
          <p className="text-sm text-muted-foreground">Highest earning units in the fleet</p>
        </div>
        <Separator />
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Equipment</TableHead>
              <TableHead className="hidden md:table-cell">Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Monthly rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {top.map((e) => (
              <TableRow key={e.id} className="transition-colors hover:bg-accent/50">
                <TableCell className="text-sm font-medium">{e.name}</TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{e.type}</TableCell>
                <TableCell className="text-sm capitalize text-muted-foreground">{e.status}</TableCell>
                <TableCell className="text-right text-sm font-medium">{inr(e.monthlyRate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
