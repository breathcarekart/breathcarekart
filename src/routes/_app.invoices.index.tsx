import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, FileText, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { inr, invoices } from "@/lib/data";

export const Route = createFileRoute("/_app/invoices/")({
  head: () => ({
    meta: [
      { title: "Invoices · Breath Care Kart" },
      {
        name: "description",
        content: "All rental invoices with payment status, billing period, customer and amount due.",
      },
      { property: "og:title", content: "Invoices · Breath Care Kart" },
      { property: "og:description", content: "Rental invoices with payment status and amounts due." },
    ],
  }),
  component: InvoiceListPage,
});

function InvoiceListPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(
    () =>
      invoices.filter((i) => {
        const q = query.toLowerCase();
        const matchQ = !q || [i.number, i.customer, i.id].some((v) => v.toLowerCase().includes(q));
        return matchQ && (status === "all" || i.status === status);
      }),
    [query, status],
  );

  const billed = invoices.reduce((s, i) => s + i.amount, 0);
  const collected = invoices.reduce((s, i) => s + i.paid, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description={`${invoices.length} invoices this cycle · ${inr(billed - collected)} outstanding`}
        actions={
          <>
            <Button variant="outline" className="rounded-xl" onClick={() => toast.success("Invoices exported")}>
              <Download className="size-4" /> Export
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
        <StatCard label="Total billed" value={inr(billed)} delta={11} icon={FileText} hint="this cycle" />
        <StatCard label="Collected" value={inr(collected)} delta={8} icon={FileText} hint="received" />
        <StatCard label="Outstanding" value={inr(billed - collected)} delta={-4} icon={FileText} hint="pending + overdue" />
        <StatCard
          label="Overdue"
          value={String(invoices.filter((i) => i.status === "overdue").length)}
          icon={FileText}
          hint="needs follow-up"
        />
      </div>

      <Card className="gap-0 overflow-hidden p-0 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search invoice number or customer"
              className="h-10 rounded-xl pl-9"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-10 w-40 rounded-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Separator />

        {filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No invoices found"
            description="Nothing matches this search. Adjust the filters or create a new invoice."
            action={
              <Button asChild className="mt-2 rounded-xl">
                <Link to="/invoices/new">Create invoice</Link>
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden lg:table-cell">Equipment</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inv) => (
                <TableRow key={inv.id} className="transition-colors hover:bg-accent/50">
                  <TableCell>
                    <Link to="/invoices/$invoiceId" params={{ invoiceId: inv.id }} className="group block">
                      <span className="block text-sm font-medium group-hover:text-primary">{inv.number}</span>
                      <span className="block text-xs text-muted-foreground">{inv.period}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{inv.customer}</TableCell>
                  <TableCell className="hidden max-w-56 truncate text-sm text-muted-foreground lg:table-cell">
                    {inv.equipment.join(", ")}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{inv.date}</TableCell>
                  <TableCell>
                    <StatusBadge tone={inv.status as Tone} />
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">{inr(inv.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
