import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CircleDollarSign, Download, FileText, Repeat, Wallet } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SalesTable } from "@/components/sales/sales-table";
import { saleAmount, saleStatus } from "@/lib/sales";
import { RoleBadge } from "@/components/shared/badges";
import { DateRangeFilter, FilterBar, SelectFilter } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadCsv } from "@/lib/csv";
import { activityQueries } from "@/lib/db/activity";
import { customerQueries } from "@/lib/db/customers";
import { equipmentQueries } from "@/lib/db/equipment";
import { invoiceQueries, type InvoiceListItem } from "@/lib/db/invoices";
import { paymentQueries, type PaymentListItem } from "@/lib/db/payments";
import { profileQueries } from "@/lib/db/profiles";
import { rentalQueries, type RentalListItem } from "@/lib/db/rentals";
import { saleQueries } from "@/lib/db/sales";
import type { PaymentMethod } from "@/lib/db/types";
import { formatDate, inDateRange, inr, monthKey, monthLabel } from "@/lib/format";
import { paymentCustomer, paymentTransactionType, totalPaid } from "@/lib/payments";
import { toRole, useCurrentUser } from "@/lib/roles";
import {
  asDeliveryStatus,
  equipmentStatusLabels,
  equipmentStatusTone,
  outstandingOf,
  paymentMethodLabels,
  paymentState,
  paymentStateLabels,
  paymentStateTone,
  rentalStage,
  rentalStageLabels,
  rentalStageTone,
  type PaymentState,
  type RentalStage,
} from "@/lib/status";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({
    meta: [
      { title: "Reports · Breath Care Kart" },
      {
        name: "description",
        content: "Rental, sales, invoice, payment, equipment, staff and delivery reports.",
      },
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
type Csv = { name: string; header: string[]; rows: (string | number | null | undefined)[][] };

function ReportsPage() {
  const { role } = useCurrentUser();
  const units = useQuery(equipmentQueries.units());
  const types = useQuery(equipmentQueries.types());
  const customers = useQuery(customerQueries.list());
  const rentals = useQuery(rentalQueries.list());
  const sales = useQuery(saleQueries.list());
  const invoices = useQuery(invoiceQueries.list());
  const payments = useQuery(paymentQueries.list());
  const staff = useQuery(profileQueries.list());
  const activity = useQuery({ ...activityQueries.recent(1000), enabled: role === "admin" });

  const [tab, setTab] = useState("rental");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customer, setCustomer] = useState("all");
  const [equipmentType, setEquipmentType] = useState("all");
  const [staffId, setStaffId] = useState("all");
  const [txType, setTxType] = useState("all");
  const [status, setStatus] = useState("all");

  const loading = [units, customers, rentals, sales, invoices, payments, staff].some(
    (q) => q.isPending,
  );
  const failed = [units, customers, rentals, sales, invoices, payments, staff].find(
    (q) => q.isError,
  );

  // ── Filtered datasets ──────────────────────────────────────────────────
  const fRentals = useMemo(
    () =>
      (rentals.data ?? []).filter(
        (r) =>
          inDateRange(r.start_date, from, to) &&
          (customer === "all" || r.customer_id === customer) &&
          (equipmentType === "all" ||
            r.rental_items.some((i) => i.equipment_type?.id === equipmentType)) &&
          (staffId === "all" || r.created_by === staffId || r.supervisor_id === staffId) &&
          (txType === "all" || txType === "rental") &&
          (tab !== "rental" || status === "all" || rentalStage(r) === status),
      ),
    [rentals.data, from, to, customer, equipmentType, staffId, txType, status, tab],
  );
  const fSales = useMemo(
    () =>
      (sales.data ?? []).filter(
        (s) =>
          inDateRange(s.sale_date, from, to) &&
          (customer === "all" || s.customer_id === customer) &&
          (equipmentType === "all" ||
            s.sale_items.some((i) => i.equipment_type_id === equipmentType)) &&
          (staffId === "all" || s.created_by === staffId) &&
          (txType === "all" || txType === "sale"),
      ),
    [sales.data, from, to, customer, equipmentType, staffId, txType],
  );
  const unitType = useMemo(
    () => new Map((units.data ?? []).map((u) => [u.id, u.equipment_type_id])),
    [units.data],
  );
  const fInvoices = useMemo(
    () =>
      (invoices.data ?? []).filter(
        (i) =>
          inDateRange(i.invoice_date, from, to) &&
          (customer === "all" || i.customer_id === customer) &&
          (equipmentType === "all" ||
            i.invoice_items.some(
              (it) => it.equipment_unit_id && unitType.get(it.equipment_unit_id) === equipmentType,
            )) &&
          (staffId === "all" || i.created_by === staffId) &&
          (txType === "all" || i.transaction_type === txType) &&
          (tab !== "invoices" || status === "all" || paymentState(i) === status),
      ),
    [invoices.data, from, to, customer, equipmentType, staffId, txType, status, tab, unitType],
  );
  const invoiceById = useMemo(
    () => new Map((invoices.data ?? []).map((i) => [i.id, i])),
    [invoices.data],
  );
  const fPayments = useMemo(
    () =>
      (payments.data ?? []).filter((p) => {
        // Register payments have no invoice: take customer, equipment and type from the rental.
        const inv = p.invoice_id ? invoiceById.get(p.invoice_id) : undefined;
        const customerId = inv?.customer_id ?? p.invoice?.customer_id ?? p.rental?.customer_id;
        return (
          inDateRange(p.payment_date, from, to) &&
          (customer === "all" || customerId === customer) &&
          (equipmentType === "all" ||
            !!inv?.invoice_items.some(
              (it) => it.equipment_unit_id && unitType.get(it.equipment_unit_id) === equipmentType,
            ) ||
            !!p.rental?.rental_items.some((it) => it.equipment_type_id === equipmentType)) &&
          (staffId === "all" || p.recorded_by === staffId) &&
          (txType === "all" || paymentTransactionType(p) === txType) &&
          (tab !== "payments" || status === "all" || p.method === status)
        );
      }),
    [
      payments.data,
      invoiceById,
      from,
      to,
      customer,
      equipmentType,
      staffId,
      txType,
      status,
      tab,
      unitType,
    ],
  );

  const liveInvoices = fInvoices.filter((i) => i.status !== "cancelled" && i.status !== "draft");
  const billed = liveInvoices.reduce((s, i) => s + Number(i.grand_total), 0);
  const received = totalPaid(fPayments);
  const outstanding = liveInvoices.reduce((s, i) => s + outstandingOf(i), 0);

  // ── Reports ────────────────────────────────────────────────────────────
  const reports: {
    value: string;
    label: string;
    adminOnly?: boolean;
    statusOptions?: { value: string; label: string }[];
    csv: () => Csv;
    body: ReactNode;
  }[] = [
    {
      value: "rental",
      label: "Rental Reports",
      statusOptions: (Object.keys(rentalStageLabels) as RentalStage[]).map((s) => ({
        value: s,
        label: rentalStageLabels[s],
      })),
      csv: () => ({
        name: "rental-report",
        header: [
          "Rental",
          "Customer",
          "Equipment",
          "Start",
          "End",
          "Returned",
          "Status",
          "Supervisor",
        ],
        rows: fRentals.map((r) => [
          r.rental_number,
          r.customer?.name,
          r.rental_items.map((i) => i.description).join("; "),
          r.start_date,
          r.due_date,
          r.returned_date,
          rentalStageLabels[rentalStage(r)],
          r.supervisor?.full_name,
        ]),
      }),
      body: <RentalReport rentals={fRentals} />,
    },
    {
      value: "sales",
      label: "Sales Reports",
      csv: () => ({
        name: "sales-report",
        header: ["Sale", "Date", "Customer", "Items", "Amount", "Created by", "Status"],
        rows: fSales.map((s) => [
          s.sale_number,
          s.sale_date,
          s.customer?.name,
          s.sale_items.map((i) => i.description).join("; "),
          saleAmount(s),
          s.creator?.full_name,
          saleStatus(s).label,
        ]),
      }),
      body: fSales.length ? <SalesTable rows={fSales} /> : <Empty />,
    },
    {
      value: "invoices",
      label: "Invoice Reports",
      statusOptions: (Object.keys(paymentStateLabels) as PaymentState[]).map((s) => ({
        value: s,
        label: paymentStateLabels[s],
      })),
      csv: () => ({
        name: "invoice-report",
        header: [
          "Invoice",
          "Date",
          "Customer",
          "Type",
          "Subtotal",
          "GST %",
          "GST",
          "Total",
          "Paid",
          "Outstanding",
          "Status",
          "Created by",
        ],
        rows: fInvoices.map((i) => [
          i.invoice_number,
          i.invoice_date,
          i.customer?.name,
          i.transaction_type,
          i.subtotal,
          i.tax_rate,
          i.tax_amount,
          i.grand_total,
          i.amount_paid,
          outstandingOf(i),
          paymentStateLabels[paymentState(i)],
          i.creator?.full_name,
        ]),
      }),
      body: <InvoiceReport invoices={fInvoices} />,
    },
    {
      value: "payments",
      label: "Payment Reports",
      statusOptions: (Object.keys(paymentMethodLabels) as PaymentMethod[]).map((m) => ({
        value: m,
        label: paymentMethodLabels[m],
      })),
      csv: () => ({
        name: "payment-report",
        header: [
          "Date",
          "Invoice",
          "Rental",
          "Type",
          "Customer",
          "Method",
          "Reference",
          "Amount",
          "Recorded by",
        ],
        rows: fPayments.map((p) => [
          p.payment_date,
          p.invoice?.invoice_number,
          p.rental?.rental_number,
          paymentTransactionType(p),
          paymentCustomer(p)?.name,
          paymentMethodLabels[p.method],
          p.reference_no,
          p.amount,
          p.recorder?.full_name,
        ]),
      }),
      body: <PaymentReport payments={fPayments} />,
    },
    {
      value: "equipment",
      label: "Equipment Reports",
      csv: () => ({
        name: "equipment-report",
        header: ["Equipment", "Code", "Status", "Rentals", "Invoiced"],
        rows: equipmentRows().map((r) => [
          r.name,
          r.code,
          equipmentStatusLabels[r.status],
          r.rentals,
          r.revenue,
        ]),
      }),
      body: <EquipmentReport rows={equipmentRows()} />,
    },
    {
      value: "staff",
      label: "Staff Activity",
      adminOnly: true,
      csv: () => ({
        name: "staff-activity",
        header: [
          "Staff",
          "Role",
          "Invoices",
          "Invoiced",
          "Sales",
          "Payments recorded",
          "Deliveries",
          "Actions logged",
        ],
        rows: staffRows().map((r) => [
          r.name,
          r.role,
          r.invoices,
          r.invoiced,
          r.sales,
          r.payments,
          r.deliveries,
          r.actions,
        ]),
      }),
      body: <StaffReport rows={staffRows()} />,
    },
    {
      value: "delivery",
      label: "Delivery Reports",
      csv: () => ({
        name: "delivery-report",
        header: ["Supervisor", "Awaiting assignment", "Assigned", "Out for delivery", "Delivered"],
        rows: deliveryRows().map((r) => [r.name, r.pending, r.assigned, r.out, r.delivered]),
      }),
      body: <DeliveryReport rows={deliveryRows()} />,
    },
  ];
  const visible = reports.filter((r) => !r.adminOnly || role === "admin");
  const active = visible.find((r) => r.value === tab) ?? visible[0]!;

  function equipmentRows() {
    return (units.data ?? [])
      .filter((u) => equipmentType === "all" || u.equipment_type_id === equipmentType)
      .map((u) => {
        const unitRentals = fRentals.filter((r) =>
          r.rental_items.some((i) => i.equipment_unit?.id === u.id),
        );
        const revenue = liveInvoices
          .flatMap((i) => i.invoice_items)
          .filter((it) => it.equipment_unit_id === u.id)
          .reduce((s, it) => s + Number(it.amount), 0);
        return {
          id: u.id,
          name: u.equipment_type?.name ?? "Equipment",
          code: u.unit_code ?? u.serial_number ?? "",
          status: u.status,
          rentals: unitRentals.length,
          revenue,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }
  function staffRows() {
    return (staff.data ?? [])
      .filter((p) => staffId === "all" || p.id === staffId)
      .map((p) => ({
        id: p.id,
        name: p.full_name ?? p.email ?? "Staff",
        role: toRole(p.role),
        invoices: fInvoices.filter((i) => i.created_by === p.id).length,
        invoiced: fInvoices
          .filter((i) => i.created_by === p.id && i.status !== "cancelled")
          .reduce((s, i) => s + Number(i.grand_total), 0),
        sales: fSales.filter((s) => s.created_by === p.id).length,
        payments: fPayments.filter((x) => x.recorded_by === p.id).length,
        deliveries: fRentals.filter(
          (r) => r.supervisor_id === p.id && asDeliveryStatus(r.delivery_status) === "delivered",
        ).length,
        actions: (activity.data ?? []).filter(
          (a) => a.actor_id === p.id && inDateRange(a.created_at, from, to),
        ).length,
      }));
  }
  function deliveryRows() {
    const groups = new Map<
      string,
      { name: string; pending: number; assigned: number; out: number; delivered: number }
    >();
    for (const r of fRentals) {
      const key = r.supervisor_id ?? "unassigned";
      const g = groups.get(key) ?? {
        name: r.supervisor?.full_name ?? (r.supervisor_id ? "Supervisor" : "Unassigned"),
        pending: 0,
        assigned: 0,
        out: 0,
        delivered: 0,
      };
      const d = asDeliveryStatus(r.delivery_status);
      if (d === "pending") g.pending++;
      else if (d === "assigned") g.assigned++;
      else if (d === "out_for_delivery") g.out++;
      else g.delivered++;
      groups.set(key, g);
    }
    return [...groups.entries()].map(([id, g]) => ({ id, ...g }));
  }

  const exportCsv = () => {
    const csv = active.csv();
    downloadCsv(
      `${csv.name}${from || to ? `-${from || "start"}-to-${to || "today"}` : ""}`,
      csv.header,
      csv.rows,
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Rentals, sales, billing, collections, fleet, staff and deliveries — from live records."
        actions={
          <Button variant="outline" className="rounded-xl" onClick={exportCsv} disabled={loading}>
            <Download className="size-4" /> Export
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Invoiced"
          value={loading ? "—" : inr(billed)}
          icon={FileText}
          hint={`${liveInvoices.length} invoices in range`}
        />
        <StatCard
          label="Received"
          value={loading ? "—" : inr(received)}
          icon={Wallet}
          hint={`${fPayments.length} payments`}
        />
        <StatCard
          label="Outstanding"
          value={loading ? "—" : inr(outstanding)}
          icon={CircleDollarSign}
          hint="on invoices in range"
        />
        <StatCard
          label="Rentals started"
          value={loading ? "—" : String(fRentals.length)}
          icon={Repeat}
          hint={`${fSales.length} sales`}
        />
      </div>

      <Card className="gap-0 p-0 shadow-xs">
        <FilterBar>
          <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
          <SelectFilter
            value={customer}
            onChange={setCustomer}
            allLabel="All customers"
            options={(customers.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />
          <SelectFilter
            value={equipmentType}
            onChange={setEquipmentType}
            allLabel="All equipment"
            options={(types.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
          />
          <SelectFilter
            value={staffId}
            onChange={setStaffId}
            allLabel="All staff"
            options={(staff.data ?? []).map((s) => ({
              value: s.id,
              label: s.full_name ?? s.email ?? "Staff",
            }))}
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
          {active.statusOptions ? (
            <SelectFilter
              value={status}
              onChange={setStatus}
              allLabel={active.value === "payments" ? "All methods" : "All statuses"}
              options={active.statusOptions}
              className="sm:w-40"
            />
          ) : null}
        </FilterBar>
      </Card>

      {failed ? (
        <Card className="p-6 text-sm text-muted-foreground shadow-xs">
          Some report data couldn&apos;t be loaded. Refresh to try again.
        </Card>
      ) : (
        <Tabs
          value={active.value}
          onValueChange={(v) => {
            setTab(v);
            setStatus("all");
          }}
        >
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <TabsList className="rounded-xl">
              {visible.map((r) => (
                <TabsTrigger key={r.value} value={r.value} className="rounded-lg">
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {visible.map((r) => (
            <TabsContent key={r.value} value={r.value} className="mt-4">
              <Card className="gap-0 overflow-hidden p-0 shadow-xs">
                <div className="px-5 py-4">
                  <h2 className="text-base font-semibold">{r.label}</h2>
                </div>
                <Separator />
                {loading ? (
                  <p className="px-5 py-8 text-sm text-muted-foreground">Loading…</p>
                ) : (
                  r.body
                )}
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

function Empty() {
  return (
    <p className="px-5 py-8 text-center text-sm text-muted-foreground">
      Nothing in this range. Adjust the filters.
    </p>
  );
}

function RentalReport({ rentals }: { rentals: RentalListItem[] }) {
  if (rentals.length === 0) return <Empty />;
  const byMonth = [
    ...rentals.reduce(
      (m, r) => m.set(monthKey(r.start_date), (m.get(monthKey(r.start_date)) ?? 0) + 1),
      new Map<string, number>(),
    ),
  ]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([k, n]) => ({ month: monthLabel(k), rentals: n }));
  return (
    <div className="space-y-4 p-4">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byMonth}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="month"
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <RTooltip contentStyle={tooltipStyle} />
            <Bar
              dataKey="rentals"
              name="Rentals started"
              fill="var(--chart-1)"
              radius={[6, 6, 2, 2]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Rental</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead className="hidden md:table-cell">Equipment</TableHead>
            <TableHead className="hidden sm:table-cell">Period</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rentals.map((r) => {
            const st = rentalStage(r);
            return (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.rental_number}</TableCell>
                <TableCell className="text-sm">{r.customer?.name}</TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {r.rental_items.map((i) => i.equipment_type?.name ?? i.description).join(", ")}
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                  {formatDate(r.start_date)} → {formatDate(r.returned_date ?? r.due_date)}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={rentalStageTone[st]} label={rentalStageLabels[st]} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function InvoiceReport({ invoices }: { invoices: InvoiceListItem[] }) {
  if (invoices.length === 0) return <Empty />;
  const states = Object.keys(paymentStateLabels) as PaymentState[];
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50">
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Rental</TableHead>
          <TableHead className="text-right">Sale</TableHead>
          <TableHead className="text-right">Invoiced</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Outstanding</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {states.map((s) => {
          const rows = invoices.filter((i) => paymentState(i) === s);
          if (rows.length === 0) return null;
          return (
            <TableRow key={s}>
              <TableCell>
                <StatusBadge tone={paymentStateTone[s]} label={paymentStateLabels[s]} />
              </TableCell>
              <TableCell className="text-right text-sm">
                {rows.filter((i) => i.transaction_type === "rental").length}
              </TableCell>
              <TableCell className="text-right text-sm">
                {rows.filter((i) => i.transaction_type === "sale").length}
              </TableCell>
              <TableCell className="text-right text-sm font-medium">
                {inr(rows.reduce((t, i) => t + Number(i.grand_total), 0))}
              </TableCell>
              <TableCell className="hidden text-right text-sm sm:table-cell">
                {inr(rows.reduce((t, i) => t + outstandingOf(i), 0))}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function PaymentReport({ payments }: { payments: PaymentListItem[] }) {
  if (payments.length === 0) return <Empty />;
  const methods = [...new Set(payments.map((p) => p.method))];
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50">
          <TableHead>Method</TableHead>
          <TableHead className="text-right">Payments</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {methods.map((m) => {
          const rows = payments.filter((p) => p.method === m);
          return (
            <TableRow key={m}>
              <TableCell className="text-sm font-medium">{paymentMethodLabels[m]}</TableCell>
              <TableCell className="text-right text-sm">{rows.length}</TableCell>
              <TableCell className="text-right text-sm font-medium">
                {inr(totalPaid(rows))}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function EquipmentReport({
  rows,
}: {
  rows: {
    id: string;
    name: string;
    code: string;
    status: keyof typeof equipmentStatusLabels;
    rentals: number;
    revenue: number;
  }[];
}) {
  if (rows.length === 0) return <Empty />;
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50">
          <TableHead>Equipment</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Rentals</TableHead>
          <TableHead className="text-right">Invoiced</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="text-sm font-medium">
              {r.name} <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
            </TableCell>
            <TableCell>
              <StatusBadge
                tone={equipmentStatusTone[r.status]}
                label={equipmentStatusLabels[r.status]}
              />
            </TableCell>
            <TableCell className="hidden text-right text-sm sm:table-cell">{r.rentals}</TableCell>
            <TableCell className="text-right text-sm font-medium">{inr(r.revenue)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function StaffReport({
  rows,
}: {
  rows: {
    id: string;
    name: string;
    role: ReturnType<typeof toRole>;
    invoices: number;
    invoiced: number;
    sales: number;
    payments: number;
    deliveries: number;
    actions: number;
  }[];
}) {
  if (rows.length === 0) return <Empty />;
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50">
          <TableHead>Staff</TableHead>
          <TableHead className="hidden sm:table-cell">Role</TableHead>
          <TableHead className="text-right">Invoices</TableHead>
          <TableHead className="hidden text-right md:table-cell">Invoiced</TableHead>
          <TableHead className="hidden text-right md:table-cell">Sales</TableHead>
          <TableHead className="hidden text-right lg:table-cell">Payments</TableHead>
          <TableHead className="hidden text-right lg:table-cell">Deliveries</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="text-sm font-medium">{r.name}</TableCell>
            <TableCell className="hidden sm:table-cell">
              <RoleBadge role={r.role} />
            </TableCell>
            <TableCell className="text-right text-sm">{r.invoices}</TableCell>
            <TableCell className="hidden text-right text-sm md:table-cell">
              {inr(r.invoiced)}
            </TableCell>
            <TableCell className="hidden text-right text-sm md:table-cell">{r.sales}</TableCell>
            <TableCell className="hidden text-right text-sm lg:table-cell">{r.payments}</TableCell>
            <TableCell className="hidden text-right text-sm lg:table-cell">
              {r.deliveries}
            </TableCell>
            <TableCell className="text-right text-sm">{r.actions}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DeliveryReport({
  rows,
}: {
  rows: {
    id: string;
    name: string;
    pending: number;
    assigned: number;
    out: number;
    delivered: number;
  }[];
}) {
  if (rows.length === 0) return <Empty />;
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50">
          <TableHead>Supervisor</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Awaiting assignment</TableHead>
          <TableHead className="text-right">Assigned</TableHead>
          <TableHead className="text-right">Out for delivery</TableHead>
          <TableHead className="text-right">Delivered</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="text-sm font-medium">{r.name}</TableCell>
            <TableCell className="hidden text-right text-sm sm:table-cell">{r.pending}</TableCell>
            <TableCell className="text-right text-sm">{r.assigned}</TableCell>
            <TableCell className="text-right text-sm">{r.out}</TableCell>
            <TableCell className="text-right text-sm font-medium">{r.delivered}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
