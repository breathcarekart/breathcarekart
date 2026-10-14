import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  Eye,
  Loader2,
  MessageCircle,
  Printer,
  UserRound,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { WhatsAppSendDialog } from "@/components/invoices/whatsapp-send-dialog";
import { RecordPaymentDialog } from "@/components/payments/record-payment-dialog";
import { RoleBadge, TransactionBadge } from "@/components/shared/badges";
import { CardsSkeleton } from "@/components/shared/loaders";
import { PageHeader } from "@/components/shared/page-header";
import { QueryState } from "@/components/shared/query-state";
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
import { invoiceQueries, type InvoiceWithRelations } from "@/lib/db/invoices";
import { settingsQueries } from "@/lib/db/settings";
import type { CompanySettings } from "@/lib/db/types";
import { formatDate, formatDateTime, inr } from "@/lib/format";
import { buildInvoiceDocument, missingCompanyFields } from "@/lib/invoice-document-data";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";
import { notifyError, notifySuccess } from "@/lib/notify";
import { roleLabel, toRole, useCurrentUser } from "@/lib/roles";
import {
  outstandingOf,
  paymentMethodLabels,
  paymentState,
  paymentStateLabels,
  paymentStateTone,
} from "@/lib/status";

export const Route = createFileRoute("/_app/invoices/$invoiceId")({
  head: () => ({
    meta: [{ title: "Invoice · Breath Care Kart" }, { name: "robots", content: "noindex" }],
  }),
  component: InvoiceDetailsPage,
});

function InvoiceDetailsPage() {
  const { invoiceId } = Route.useParams();
  const invoice = useQuery(invoiceQueries.detail(invoiceId));
  const settings = useQuery(settingsQueries.company());

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-xl text-muted-foreground">
        <Link to="/invoices">
          <ArrowLeft className="size-4" /> Invoices
        </Link>
      </Button>
      <QueryState
        query={invoice}
        loading={<CardsSkeleton />}
        errorTitle="Couldn't load this invoice"
      >
        {(inv) => <InvoiceDetails invoice={inv} settings={settings.data ?? null} />}
      </QueryState>
    </div>
  );
}

function InvoiceDetails({
  invoice,
  settings,
}: {
  invoice: InvoiceWithRelations;
  settings: CompanySettings | null;
}) {
  const { role } = useCurrentUser();
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const state = paymentState(invoice);
  const outstanding = outstandingOf(invoice);
  const doc = buildInvoiceDocument(invoice, settings);
  const missing = missingCompanyFields(settings);
  const creator = invoice.creator;
  const customer = invoice.customer;
  const canTakePayment =
    outstanding > 0 && invoice.status !== "cancelled" && invoice.status !== "draft";

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      await downloadInvoicePdf(doc);
      notifySuccess("Invoice PDF downloaded");
    } catch (error) {
      notifyError(error, "The invoice PDF could not be downloaded");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={invoice.invoice_number}
        description={`${customer?.name ?? "Customer"} · ${formatDate(invoice.invoice_date)}`}
        actions={
          <>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={downloadPdf}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}{" "}
              Download PDF
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link
                to="/invoice-preview/$invoiceId"
                params={{ invoiceId: invoice.id }}
                search={{ print: true }}
              >
                <Printer className="size-4" /> Print
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="icon"
              className="rounded-xl"
              aria-label="Preview"
            >
              <Link to="/invoice-preview/$invoiceId" params={{ invoiceId: invoice.id }}>
                <Eye className="size-4" />
              </Link>
            </Button>
            <Button className="rounded-xl" onClick={() => setWhatsAppOpen(true)}>
              <MessageCircle className="size-4" /> Send via WhatsApp
            </Button>
          </>
        }
      />

      {missing.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm">
          <AlertTriangle className="size-4 shrink-0 text-warning-foreground" />
          <span className="flex-1">
            Company {missing.join(", ")} not set — the PDF shows “Invoice” instead of “Tax invoice”
            until a GSTIN is added.
          </span>
          {role === "admin" && (
            <Button asChild size="sm" variant="outline" className="rounded-lg bg-background">
              <Link to="/settings">Open settings</Link>
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Card className="gap-1 p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">Payment status</p>
          <div className="mt-1">
            <StatusBadge tone={paymentStateTone[state]} label={paymentStateLabels[state]} />
          </div>
        </Card>
        <Card className="gap-1 p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">Invoice total</p>
          <p className="text-xl font-semibold">{inr(invoice.grand_total)}</p>
        </Card>
        <Card className="gap-1 p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">Received</p>
          <p className="text-xl font-semibold text-success">{inr(invoice.amount_paid)}</p>
        </Card>
        <Card className="gap-1 p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">Outstanding</p>
          <p
            className={
              outstanding > 0 ? "text-xl font-semibold text-danger" : "text-xl font-semibold"
            }
          >
            {inr(outstanding)}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card className="gap-0 p-6 shadow-xs">
            <h2 className="text-base font-semibold">Invoice details</h2>
            <Separator className="my-5" />
            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Invoice number" value={invoice.invoice_number} />
              <Detail label="Invoice date" value={formatDate(invoice.invoice_date)} />
              <Detail label="Customer" value={customer?.name ?? "—"} />
              <Detail
                label="Transaction type"
                value={
                  <TransactionBadge
                    type={invoice.transaction_type === "sale" ? "sale" : "rental"}
                  />
                }
              />
              <Detail label="Payment due" value={formatDate(invoice.due_date)} />
              <Detail label="Created" value={formatDateTime(invoice.created_at)} />
              {invoice.rental ? (
                <Detail label="Rental" value={invoice.rental.rental_number} />
              ) : null}
              {invoice.sale ? <Detail label="Sale" value={invoice.sale.sale_number} /> : null}
              {invoice.period_start && invoice.period_end ? (
                <Detail
                  label="Rental period"
                  value={`${formatDate(invoice.period_start)} – ${formatDate(invoice.period_end)}`}
                />
              ) : null}
            </dl>

            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border bg-muted/30 p-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <UserRound className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Created by</p>
                <p className="text-sm font-semibold">
                  {creator
                    ? `${creator.full_name ?? creator.email ?? "Staff member"} — ${roleLabel(toRole(creator.role))}`
                    : "Not recorded"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(invoice.created_at)}
                </p>
              </div>
              {creator ? <RoleBadge role={toRole(creator.role)} /> : null}
            </div>
          </Card>

          <Card className="gap-0 p-6 shadow-xs">
            <h2 className="text-base font-semibold">Equipment / items</h2>
            <Separator className="my-5" />
            <div className="space-y-3">
              {doc.lines.map((line, i) => (
                <div
                  key={`${line.description}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-xl border p-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{line.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {line.quantity} × {inr(line.rate)}
                      {line.detail ? ` · ${line.detail}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-medium">{inr(line.amount)}</span>
                </div>
              ))}
            </div>
            <Separator className="my-5" />
            <dl className="ml-auto max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{inr(doc.subtotal)}</dd>
              </div>
              {doc.discount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Discount</dt>
                  <dd className="text-danger">−{inr(doc.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">GST ({doc.taxRate}%)</dt>
                <dd>{inr(doc.tax)}</dd>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-base font-semibold">
                <dt>Total</dt>
                <dd>{inr(doc.total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Paid</dt>
                <dd className="text-success">{inr(doc.paid)}</dd>
              </div>
              <div className="flex justify-between font-medium">
                <dt>Outstanding</dt>
                <dd>{inr(outstanding)}</dd>
              </div>
            </dl>
          </Card>

          <Card className="gap-0 overflow-hidden p-0 shadow-xs">
            <div className="flex items-center justify-between px-6 py-4">
              <h2 className="text-base font-semibold">Payments</h2>
              {canTakePayment && (
                <Button size="sm" className="rounded-xl" onClick={() => setPaymentOpen(true)}>
                  <Wallet className="size-4" /> Record payment
                </Button>
              )}
            </div>
            <Separator />
            {invoice.payments.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                No payments recorded yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Date</TableHead>
                    <TableHead className="hidden sm:table-cell">Method</TableHead>
                    <TableHead className="hidden md:table-cell">Recorded by</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...invoice.payments]
                    .sort((a, b) => b.payment_date.localeCompare(a.payment_date))
                    .map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">
                          {formatDate(p.payment_date)}
                          {p.reference_no ? (
                            <span className="block text-xs text-muted-foreground">
                              {p.reference_no}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="hidden text-sm sm:table-cell">
                          {paymentMethodLabels[p.method]}
                        </TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                          {p.recorder?.full_name ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium text-success">
                          {inr(p.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>

        <Card className="h-fit gap-0 p-6 shadow-xs">
          <h2 className="text-base font-semibold">Customer</h2>
          <Separator className="my-4" />
          {customer ? (
            <div className="space-y-1.5 text-sm">
              <p className="font-medium">{customer.name}</p>
              <p className="text-muted-foreground">
                {[customer.address, customer.city].filter(Boolean).join(", ")}
              </p>
              <p className="text-muted-foreground">{customer.phone}</p>
              {customer.attender_name ? (
                <p className="text-muted-foreground">
                  Attender: {customer.attender_name}
                  {customer.attender_relation ? ` (${customer.attender_relation})` : ""}
                </p>
              ) : null}
              <Button asChild variant="outline" size="sm" className="mt-4 w-full rounded-xl">
                <Link to="/customers/$customerId" params={{ customerId: customer.id }}>
                  View profile
                </Link>
              </Button>
            </div>
          ) : null}
          {invoice.rental ? (
            <>
              <Separator className="my-5" />
              <h3 className="text-sm font-semibold">Rental {invoice.rental.rental_number}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatDate(invoice.rental.start_date)} → {formatDate(invoice.rental.due_date)}
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3 w-full rounded-xl">
                <Link to="/deliveries/$rentalId" params={{ rentalId: invoice.rental.id }}>
                  Rental &amp; delivery
                </Link>
              </Button>
            </>
          ) : null}
        </Card>
      </div>

      <WhatsAppSendDialog
        open={whatsAppOpen}
        onOpenChange={setWhatsAppOpen}
        invoiceId={invoice.id}
        recipient={customer?.name ?? "Customer"}
        phone={customer?.whatsapp || customer?.phone || null}
        invoiceNumber={invoice.invoice_number}
        companyName={doc.company.name}
      />
      <RecordPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoice_number}
        outstanding={outstanding}
      />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}
