import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, CircleDollarSign, Download, FileText, Plus, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { TransactionBadge } from "@/components/shared/badges";
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
import { downloadCsv } from "@/lib/csv";
import { invoiceQueries } from "@/lib/db/invoices";
import { formatDate, inDateRange, inr } from "@/lib/format";
import {
  outstandingOf,
  paymentState,
  paymentStateLabels,
  paymentStateTone,
  type PaymentState,
} from "@/lib/status";

export const Route = createFileRoute("/_app/invoices/")({
  head: () => ({
    meta: [
      { title: "Invoices · Breath Care Kart" },
      {
        name: "description",
        content: "Rental and sale invoices with payment status and balances.",
      },
    ],
  }),
  component: InvoiceListPage,
});

const stateOptions = (Object.keys(paymentStateLabels) as PaymentState[]).map((s) => ({
  value: s,
  label: paymentStateLabels[s],
}));

function InvoiceListPage() {
  const query = useQuery(invoiceQueries.list());
  const [search, setSearch] = useState("");
  const [state, setState] = useState("all");
  const [txType, setTxType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const invoices = useMemo(() => query.data ?? [], [query.data]);
  const filtered = invoices.filter((i) => {
    const q = search.trim().toLowerCase();
    return (
      (!q ||
        [i.invoice_number, i.customer?.name, i.creator?.full_name].some((v) =>
          v?.toLowerCase().includes(q),
        )) &&
      (state === "all" || paymentState(i) === state) &&
      (txType === "all" || i.transaction_type === txType) &&
      inDateRange(i.invoice_date, from, to)
    );
  });

  const live = invoices.filter((i) => i.status !== "cancelled" && i.status !== "draft");
  const billed = live.reduce((s, i) => s + Number(i.grand_total), 0);
  const collected = live.reduce((s, i) => s + Number(i.amount_paid), 0);
  const outstanding = live.reduce((s, i) => s + outstandingOf(i), 0);
  const overdue = invoices.filter((i) => paymentState(i) === "overdue").length;

  const exportCsv = () =>
    downloadCsv(
      "invoices",
      [
        "Invoice",
        "Date",
        "Due",
        "Customer",
        "Type",
        "Subtotal",
        "Discount",
        "GST %",
        "GST",
        "Total",
        "Paid",
        "Outstanding",
        "Status",
        "Created by",
      ],
      filtered.map((i) => [
        i.invoice_number,
        i.invoice_date,
        i.due_date,
        i.customer?.name,
        i.transaction_type,
        i.subtotal,
        i.discount,
        i.tax_rate,
        i.tax_amount,
        i.grand_total,
        i.amount_paid,
        outstandingOf(i),
        paymentStateLabels[paymentState(i)],
        i.creator?.full_name,
      ]),
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description={
          query.data
            ? `${invoices.length} invoices · ${inr(outstanding)} outstanding`
            : "Rental and sale invoices"
        }
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
          label="Total billed"
          value={inr(billed)}
          icon={FileText}
          hint={`${live.length} issued invoices`}
        />
        <StatCard label="Collected" value={inr(collected)} icon={Wallet} hint="payments received" />
        <StatCard
          label="Outstanding"
          value={inr(outstanding)}
          icon={CircleDollarSign}
          hint="not yet paid"
        />
        <StatCard label="Overdue" value={String(overdue)} icon={AlertCircle} hint="past due date" />
      </div>

      <Card className="gap-0 overflow-hidden p-0 shadow-xs">
        <FilterBar>
          <SearchFilter
            value={search}
            onChange={setSearch}
            placeholder="Search invoice number, customer or creator"
          />
          <SelectFilter
            value={state}
            onChange={setState}
            allLabel="All statuses"
            options={stateOptions}
            className="sm:w-40"
          />
          <SelectFilter
            value={txType}
            onChange={setTxType}
            allLabel="Rental & sale"
            options={[
              { value: "rental", label: "Rental" },
              { value: "sale", label: "Sale" },
            ]}
            className="sm:w-36"
          />
          <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        </FilterBar>
        <Separator />
        <QueryState query={query} errorTitle="Couldn't load invoices">
          {() =>
            filtered.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={FileText}
                  title={invoices.length === 0 ? "No invoices yet" : "No invoices match"}
                  description={
                    invoices.length === 0
                      ? "Create a rental or sale invoice to get started."
                      : "Adjust the filters to see more invoices."
                  }
                  action={
                    <Button asChild className="mt-2 rounded-xl">
                      <Link to="/invoices/new">Create invoice</Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead className="hidden lg:table-cell">Date</TableHead>
                    <TableHead className="hidden xl:table-cell">Created by</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((i) => {
                    const st = paymentState(i);
                    return (
                      <TableRow key={i.id} className="transition-colors hover:bg-accent/50">
                        <TableCell className="font-medium">
                          <Link
                            to="/invoices/$invoiceId"
                            params={{ invoiceId: i.id }}
                            className="hover:text-primary"
                          >
                            {i.invoice_number}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">{i.customer?.name}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <TransactionBadge
                            type={i.transaction_type === "sale" ? "sale" : "rental"}
                          />
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                          {formatDate(i.invoice_date)}
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">
                          {i.creator?.full_name ?? "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={paymentStateTone[st]} label={paymentStateLabels[st]} />
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {inr(i.grand_total)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )
          }
        </QueryState>
      </Card>
    </div>
  );
}
