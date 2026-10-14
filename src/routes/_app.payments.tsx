import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, CircleDollarSign, Download, Percent, Plus, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { RecordPaymentDialog } from "@/components/payments/record-payment-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  DateRangeFilter,
  FilterBar,
  SearchFilter,
  SelectFilter,
} from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { QueryState } from "@/components/shared/query-state";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadCsv } from "@/lib/csv";
import { invoiceQueries } from "@/lib/db/invoices";
import { paymentQueries } from "@/lib/db/payments";
import type { PaymentMethod } from "@/lib/db/types";
import { formatDate, inDateRange, inr } from "@/lib/format";
import { paymentCustomer, totalPaid } from "@/lib/payments";
import { outstandingOf, paymentMethodLabels } from "@/lib/status";

export const Route = createFileRoute("/_app/payments")({
  head: () => ({
    meta: [
      { title: "Payments · Breath Care Kart" },
      {
        name: "description",
        content: "Payments received against invoices, and outstanding balances.",
      },
    ],
  }),
  component: PaymentsPage,
});

const methodOptions = (Object.keys(paymentMethodLabels) as PaymentMethod[]).map((m) => ({
  value: m,
  label: paymentMethodLabels[m],
}));

function PaymentsPage() {
  const query = useQuery(paymentQueries.list());
  const invoices = useQuery(invoiceQueries.list());
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [paying, setPaying] = useState<{ id: string; number: string; outstanding: number } | null>(
    null,
  );

  const payments = useMemo(() => query.data ?? [], [query.data]);
  const filtered = payments.filter((p) => {
    const q = search.trim().toLowerCase();
    return (
      (!q ||
        [
          p.invoice?.invoice_number,
          p.rental?.rental_number,
          paymentCustomer(p)?.name,
          p.reference_no,
        ].some((v) => v?.toLowerCase().includes(q))) &&
      (method === "all" || p.method === method) &&
      inDateRange(p.payment_date, from, to)
    );
  });

  const live = (invoices.data ?? []).filter(
    (i) => i.status !== "cancelled" && i.status !== "draft",
  );
  const billed = live.reduce((s, i) => s + Number(i.grand_total), 0);
  const received = totalPaid(payments);
  // Collection rate compares invoice payments with invoices only; register payments
  // have no invoice, so including them would overstate it.
  const receivedOnInvoices = totalPaid(payments.filter((p) => p.invoice_id));
  const unpaid = live.filter((i) => outstandingOf(i) > 0);
  const outstanding = unpaid.reduce((s, i) => s + outstandingOf(i), 0);

  const exportCsv = () =>
    downloadCsv(
      "payments",
      [
        "Date",
        "Invoice",
        "Rental",
        "Period start",
        "Period end",
        "Customer",
        "Method",
        "Reference",
        "Amount",
        "Recorded by",
      ],
      filtered.map((p) => [
        p.payment_date,
        p.invoice?.invoice_number,
        p.rental?.rental_number,
        p.period_start,
        p.period_end,
        paymentCustomer(p)?.name,
        paymentMethodLabels[p.method],
        p.reference_no,
        p.amount,
        p.recorder?.full_name,
      ]),
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Money received against invoices and rentals, and what invoices still owe."
        actions={
          <>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={exportCsv}
              disabled={filtered.length === 0}
            >
              <Download className="size-4" /> Export
            </Button>
            {/* Not modal: the payment dialog opens as this menu closes, and two modal
                layers at once can leave the page unclickable. */}
            <DropdownMenu modal={false}>
              {/* Always clickable: a disabled button swallows the click silently, so with
                  no invoices due it looked broken. The menu explains instead. */}
              <DropdownMenuTrigger asChild>
                <Button className="rounded-xl">
                  <Plus className="size-4" /> Record payment
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-80 w-72 overflow-y-auto">
                <DropdownMenuLabel>Invoices with a balance</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {unpaid.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    {invoices.isPending
                      ? "Loading invoices…"
                      : "No invoices have a balance. Payments are recorded against an invoice — create one from Invoices first."}
                  </div>
                )}
                {unpaid.map((i) => (
                  <DropdownMenuItem
                    key={i.id}
                    className="flex-col items-start gap-0.5"
                    onClick={() =>
                      setPaying({
                        id: i.id,
                        number: i.invoice_number,
                        outstanding: outstandingOf(i),
                      })
                    }
                  >
                    <span className="text-sm font-medium">{i.invoice_number}</span>
                    <span className="text-xs text-muted-foreground">
                      {i.customer?.name} · {inr(outstandingOf(i))} due
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Received"
          value={inr(received)}
          icon={Wallet}
          hint={`${payments.length} payments`}
        />
        <StatCard
          label="Outstanding"
          value={inr(outstanding)}
          icon={AlertCircle}
          hint={`${unpaid.length} invoices with a balance`}
        />
        <StatCard
          label="Collection rate"
          value={`${billed ? Math.round((receivedOnInvoices / billed) * 100) : 0}%`}
          icon={Percent}
          hint="invoice payments vs billed"
        />
        <StatCard
          label="Billed"
          value={inr(billed)}
          icon={CircleDollarSign}
          hint="issued invoices"
        />
      </div>

      <Card className="gap-0 overflow-hidden p-0 shadow-xs">
        <FilterBar>
          <SearchFilter
            value={search}
            onChange={setSearch}
            placeholder="Search invoice, customer or reference"
          />
          <SelectFilter
            value={method}
            onChange={setMethod}
            allLabel="All methods"
            options={methodOptions}
            className="sm:w-40"
          />
          <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        </FilterBar>
        <Separator />
        <QueryState query={query} errorTitle="Couldn't load payments">
          {() =>
            filtered.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={Wallet}
                  title={
                    payments.length === 0
                      ? "No payments recorded"
                      : "No payments match these filters"
                  }
                  description="Record payments from an invoice; they'll be listed here with method and reference."
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Date</TableHead>
                    <TableHead>Invoice / rental</TableHead>
                    <TableHead className="hidden md:table-cell">Customer</TableHead>
                    <TableHead className="hidden lg:table-cell">Method</TableHead>
                    <TableHead className="hidden xl:table-cell">Recorded by</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id} className="transition-colors hover:bg-accent/50">
                      <TableCell className="text-sm">
                        {formatDate(p.payment_date)}
                        {p.reference_no ? (
                          <span className="block text-xs text-muted-foreground">
                            {p.reference_no}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {p.invoice ? (
                          <Link
                            to="/invoices/$invoiceId"
                            params={{ invoiceId: p.invoice.id }}
                            className="text-sm font-medium hover:text-primary"
                          >
                            {p.invoice.invoice_number}
                          </Link>
                        ) : p.rental ? (
                          <Link
                            to="/deliveries/$rentalId"
                            params={{ rentalId: p.rental.id }}
                            className="text-sm font-medium hover:text-primary"
                          >
                            Rental {p.rental.rental_number}
                          </Link>
                        ) : (
                          <span className="text-sm text-muted-foreground">Rental payment</span>
                        )}
                        {p.period_start && p.period_end ? (
                          <span className="block text-xs text-muted-foreground">
                            {formatDate(p.period_start)} → {formatDate(p.period_end)}
                          </span>
                        ) : null}
                        <span className="block text-xs text-muted-foreground md:hidden">
                          {paymentCustomer(p)?.name}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {paymentCustomer(p)?.name ?? "—"}
                      </TableCell>
                      <TableCell className="hidden text-sm lg:table-cell">
                        {paymentMethodLabels[p.method]}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">
                        {p.recorder?.full_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-success">
                        {inr(p.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          }
        </QueryState>
      </Card>

      {paying && (
        <RecordPaymentDialog
          open
          onOpenChange={(open) => !open && setPaying(null)}
          invoiceId={paying.id}
          invoiceNumber={paying.number}
          outstanding={paying.outstanding}
        />
      )}
    </div>
  );
}
