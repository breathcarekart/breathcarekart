import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  ClipboardList,
  FileText,
  HandCoins,
  History,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Repeat,
  ShieldAlert,
  Truck,
  Wallet,
} from "lucide-react";
import { ActivityList } from "@/components/activity/activity-list";
import { EmptyState } from "@/components/shared/empty-state";
import { CardsSkeleton } from "@/components/shared/loaders";
import { QueryState } from "@/components/shared/query-state";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { activityQueries } from "@/lib/db/activity";
import { customerQueries, type fetchCustomer } from "@/lib/db/customers";
import { formatDate, inr, initials, phoneDigits } from "@/lib/format";
import { totalPaid, uniqueById } from "@/lib/payments";
import {
  isOpenRental,
  outstandingOf,
  paymentMethodLabels,
  paymentState,
  paymentStateLabels,
  paymentStateTone,
  rentalStage,
  rentalStageLabels,
  rentalStageTone,
} from "@/lib/status";

export const Route = createFileRoute("/_app/customers/$customerId")({
  head: () => ({
    meta: [{ title: "Customer · Breath Care Kart" }, { name: "robots", content: "noindex" }],
  }),
  component: CustomerProfilePage,
});

type CustomerDetail = Awaited<ReturnType<typeof fetchCustomer>>;

function CustomerProfilePage() {
  const { customerId } = Route.useParams();
  const query = useQuery(customerQueries.detail(customerId));

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-xl text-muted-foreground">
        <Link to="/customers">
          <ArrowLeft className="size-4" /> Customers
        </Link>
      </Button>
      <QueryState
        query={query}
        loading={<CardsSkeleton />}
        errorTitle="Couldn't load this customer"
      >
        {(customer) => <CustomerProfile customer={customer} />}
      </QueryState>
    </div>
  );
}

function CustomerProfile({ customer }: { customer: CustomerDetail }) {
  const rentals = customer.rentals;
  const openRentals = rentals.filter(isOpenRental);
  const invoices = customer.invoices;
  // Payments arrive via invoices and straight via rentals (imported registers have
  // no invoices). App-recorded payments carry both links, so keep each id once.
  const rentalNumber = new Map(rentals.map((r) => [r.id, r.rental_number]));
  const payments = uniqueById([
    ...invoices.flatMap((inv) =>
      inv.payments.map((p) => ({
        ...p,
        invoice_number: inv.invoice_number as string | null,
        rental_number: (p.rental_id && rentalNumber.get(p.rental_id)) || null,
      })),
    ),
    ...rentals.flatMap((r) =>
      r.payments.map((p) => ({
        ...p,
        invoice_number: null as string | null,
        rental_number: r.rental_number as string | null,
      })),
    ),
  ]).sort((a, b) => b.payment_date.localeCompare(a.payment_date));
  const paidTotal = totalPaid(payments);
  const outstanding = invoices.reduce((sum, i) => sum + outstandingOf(i), 0);
  const salesTotal = invoices
    .filter((i) => i.transaction_type === "sale" && i.status !== "cancelled")
    .reduce((sum, i) => sum + Number(i.grand_total), 0);
  const activityIds = [
    customer.id,
    ...rentals.map((r) => r.id),
    ...customer.sales.map((s) => s.id),
    ...invoices.map((i) => i.id),
    ...payments.map((p) => p.id),
  ];
  const activity = useQuery(activityQueries.forEntities(activityIds));
  const whatsapp = customer.whatsapp || customer.phone;

  return (
    <div className="space-y-6">
      <Card className="gap-0 p-6 shadow-xs">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarFallback className="bg-primary-soft text-lg text-primary">
                {initials(customer.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
              <p className="text-sm text-muted-foreground">
                {[
                  customer.gender,
                  customer.age != null ? `${customer.age} yrs` : null,
                  `customer since ${formatDate(customer.customer_since)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {whatsapp && phoneDigits(whatsapp).length === 10 && (
              <Button asChild variant="outline" className="rounded-xl">
                <a
                  href={`https://wa.me/91${phoneDigits(whatsapp)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              </Button>
            )}
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/customers/edit/$customerId" params={{ customerId: customer.id }}>
                <Pencil className="size-4" /> Edit
              </Link>
            </Button>
            <Button asChild className="rounded-xl">
              <Link to="/invoices/new" search={{ customer: customer.id }}>
                <Plus className="size-4" /> New invoice
              </Link>
            </Button>
          </div>
        </div>

        <Separator className="my-6" />

        <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Phone, label: "Phone", value: customer.phone },
            { icon: MessageCircle, label: "WhatsApp", value: customer.whatsapp },
            { icon: ShieldAlert, label: "Emergency", value: customer.emergency_contact },
            {
              icon: MapPin,
              label: "Address",
              value: [customer.address, customer.city].filter(Boolean).join(", "),
            },
          ].map((f) => (
            <div key={f.label} className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <f.icon className="size-4" />
              </span>
              <div className="min-w-0">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{f.label}</dt>
                <dd className="text-sm font-medium leading-snug">{f.value || "—"}</dd>
              </div>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Active rentals"
          value={String(openRentals.length)}
          icon={Repeat}
          hint={`${rentals.length} on record`}
        />
        <StatCard
          label="Total invoices"
          value={String(invoices.length)}
          icon={FileText}
          hint={`${inr(invoices.reduce((s, i) => s + Number(i.grand_total), 0))} billed`}
        />
        <StatCard
          label="Total paid"
          value={inr(paidTotal)}
          icon={Wallet}
          hint={`${payments.length} payments · invoices and rentals`}
        />
        <StatCard
          label="Outstanding"
          value={inr(outstanding)}
          icon={AlertCircle}
          hint={outstanding > 0 ? "on invoices, awaiting payment" : "nothing due on invoices"}
        />
        <StatCard
          label="Total sales"
          value={inr(salesTotal)}
          icon={HandCoins}
          hint={`${customer.sales.length} sales`}
        />
      </div>

      <Card className="gap-0 p-6 shadow-xs">
        <Tabs defaultValue="overview">
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <TabsList className="rounded-xl">
              {[
                ["overview", "Overview"],
                ["rentals", "Rentals"],
                ["sales", "Sales"],
                ["invoices", "Invoices"],
                ["payments", "Payments"],
                ["activity", "Activity"],
              ].map(([value, label]) => (
                <TabsTrigger key={value} value={value!} className="rounded-lg">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-5 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Attender</p>
                <p className="mt-1 text-sm font-semibold">{customer.attender_name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{customer.attender_relation ?? ""}</p>
              </div>
              <div className="rounded-2xl border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
                <p className="mt-1 whitespace-pre-line text-sm">{customer.notes || "—"}</p>
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold">Current equipment</h3>
              {openRentals.length === 0 ? (
                <EmptyState
                  icon={Repeat}
                  title="No equipment on rent"
                  description="Create a rental invoice to dispatch equipment to this customer."
                  action={
                    <Button asChild className="mt-2 rounded-xl">
                      <Link to="/invoices/new" search={{ customer: customer.id, type: "rental" }}>
                        New rental
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {openRentals.map((r) => (
                    <div key={r.id} className="card-hover rounded-2xl border p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-xs text-muted-foreground">
                            {r.rental_number}
                          </p>
                          {r.rental_items.map((it) => (
                            <p key={it.id} className="truncate text-sm font-medium">
                              {it.description ?? it.equipment_type?.name}
                            </p>
                          ))}
                        </div>
                        <StatusBadge
                          tone={rentalStageTone[rentalStage(r)]}
                          label={rentalStageLabels[rentalStage(r)]}
                        />
                      </div>
                      <Separator className="my-3" />
                      <p className="text-xs text-muted-foreground">
                        {formatDate(r.start_date)} → {formatDate(r.due_date)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="rentals" className="mt-5">
            {rentals.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No rentals"
                description="Rentals for this customer will be listed here."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Rental</TableHead>
                    <TableHead>Equipment</TableHead>
                    <TableHead className="hidden sm:table-cell">Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Delivery</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rentals.map((r) => (
                    <TableRow key={r.id} className="hover:bg-accent/50">
                      <TableCell className="font-mono text-xs font-medium">
                        {r.rental_number}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.rental_items
                          .map((it) => it.description ?? it.equipment_type?.name)
                          .join(", ")}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                        {formatDate(r.start_date)} → {formatDate(r.returned_date ?? r.due_date)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          tone={rentalStageTone[rentalStage(r)]}
                          label={rentalStageLabels[rentalStage(r)]}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm" className="h-8 rounded-lg">
                          <Link
                            to="/deliveries/$rentalId"
                            params={{ rentalId: r.id }}
                            aria-label={`Open ${r.rental_number}`}
                          >
                            <Truck className="size-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="sales" className="mt-5">
            {customer.sales.length === 0 ? (
              <EmptyState
                icon={HandCoins}
                title="No purchases"
                description="Equipment this customer buys outright will be listed here."
                action={
                  <Button asChild variant="outline" className="mt-2 rounded-xl">
                    <Link to="/invoices/new" search={{ type: "sale", customer: customer.id }}>
                      Record a sale
                    </Link>
                  </Button>
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Sale</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.sales.map((sale) => (
                    <TableRow key={sale.id} className="hover:bg-accent/50">
                      <TableCell className="font-mono text-xs font-medium">
                        {sale.sale_number}
                      </TableCell>
                      <TableCell className="text-sm">
                        {sale.sale_items.map((i) => i.description).join(", ")}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                        {formatDate(sale.sale_date)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          tone={sale.status === "cancelled" ? "cancelled" : "completed"}
                          label={sale.status === "cancelled" ? "Cancelled" : "Completed"}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="invoices" className="mt-5">
            {invoices.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No invoices yet"
                description="Invoices for this customer will be listed here with payment status."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Invoice / rental</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead className="hidden lg:table-cell">Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => {
                    const state = paymentState(inv);
                    return (
                      <TableRow key={inv.id} className="hover:bg-accent/50">
                        <TableCell className="font-medium">
                          <Link
                            to="/invoices/$invoiceId"
                            params={{ invoiceId: inv.id }}
                            className="hover:text-primary"
                          >
                            {inv.invoice_number}
                          </Link>
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                          {formatDate(inv.invoice_date)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            tone={paymentStateTone[state]}
                            label={paymentStateLabels[state]}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {inr(inv.grand_total)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="payments" className="mt-5">
            {payments.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No payments yet"
                description="Payments against this customer's invoices and rentals will appear here."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Invoice</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead className="hidden md:table-cell">Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id} className="hover:bg-accent/50">
                      <TableCell>
                        {p.invoice_id ? (
                          <Link
                            to="/invoices/$invoiceId"
                            params={{ invoiceId: p.invoice_id }}
                            className="text-sm font-medium hover:text-primary"
                          >
                            {p.invoice_number}
                          </Link>
                        ) : p.rental_id ? (
                          <Link
                            to="/deliveries/$rentalId"
                            params={{ rentalId: p.rental_id }}
                            className="text-sm font-medium hover:text-primary"
                          >
                            Rental {p.rental_number}
                          </Link>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                        <span className="block text-xs text-muted-foreground sm:hidden">
                          {formatDate(p.payment_date)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                        {formatDate(p.payment_date)}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                        {p.period_start && p.period_end
                          ? `${formatDate(p.period_start)} → ${formatDate(p.period_end)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="hidden text-sm md:table-cell">
                        {paymentMethodLabels[p.method]}
                      </TableCell>
                      <TableCell className="text-right font-medium text-success">
                        {inr(p.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-5">
            <QueryState
              query={activity}
              empty={
                <EmptyState
                  icon={History}
                  title="No activity yet"
                  description="Actions on this customer and their records will be logged here."
                />
              }
            >
              {(entries) => <ActivityList entries={entries} />}
            </QueryState>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
