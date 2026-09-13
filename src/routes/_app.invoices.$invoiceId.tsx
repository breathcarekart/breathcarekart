import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Copy, Download, Eye, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";
import { createInvoiceDocumentData } from "@/components/invoices/invoice-document";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { customers, inr, invoices } from "@/lib/data";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";

export const Route = createFileRoute("/_app/invoices/$invoiceId")({
  loader: ({ params }) => {
    const invoice = invoices.find((i) => i.id === params.invoiceId);
    if (!invoice) throw notFound();
    return { invoice };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Invoice unavailable · Breath Care Kart" }, { name: "robots", content: "noindex" }] };
    }
    const t = `Invoice ${loaderData.invoice.number} · Breath Care Kart`;
    const d = `Rental invoice for ${loaderData.invoice.customer} — ${loaderData.invoice.period}.`;
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
      ],
    };
  },
  component: InvoiceDetailsPage,
});

function InvoiceDetailsPage() {
  const { invoice } = Route.useLoaderData();
  const customer = customers.find((c) => c.id === invoice.customerId);
  const balance = invoice.amount - invoice.paid;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-xl text-muted-foreground">
        <Link to="/invoices">
          <ArrowLeft className="size-4" /> Invoices
        </Link>
      </Button>

      <PageHeader
        title={invoice.number}
        description={`${invoice.customer} · ${invoice.period}`}
        actions={
          <>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/invoice-preview/$invoiceId" params={{ invoiceId: invoice.id }}>
                <Eye className="size-4" /> Preview
              </Link>
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => toast.info("Sending to printer…")}>
              <Printer className="size-4" /> Print
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={async () => {
                try {
                  await downloadInvoicePdf(createInvoiceDocumentData(invoice, customer));
                  toast.success("Invoice PDF downloaded");
                } catch {
                  toast.error("The invoice PDF could not be downloaded");
                }
              }}
            >
              <Download className="size-4" /> PDF
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => toast.success("Share link copied")}>
              <Share2 className="size-4" /> Share
            </Button>
            <Button className="rounded-xl" onClick={() => toast.success("Invoice duplicated as draft")}>
              <Copy className="size-4" /> Duplicate
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="gap-1 p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">Status</p>
          <div className="mt-1">
            <StatusBadge tone={invoice.status as Tone} />
          </div>
        </Card>
        <Card className="gap-1 p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">Invoice total</p>
          <p className="text-xl font-semibold">{inr(invoice.amount)}</p>
        </Card>
        <Card className="gap-1 p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">Received</p>
          <p className="text-xl font-semibold text-success">{inr(invoice.paid)}</p>
        </Card>
        <Card className="gap-1 p-5 shadow-xs">
          <p className="text-sm text-muted-foreground">Balance</p>
          <p className="text-xl font-semibold text-danger">{inr(balance)}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="gap-0 p-6 shadow-xs">
            <h2 className="text-base font-semibold">Equipment &amp; charges</h2>
            <Separator className="my-5" />
            <div className="space-y-3">
              {invoice.equipment.map((name: string) => (
                <div key={name} className="flex items-center justify-between gap-3 rounded-xl border p-3.5">
                  <div>
                    <p className="text-sm font-medium">{name}</p>
                    <p className="text-xs text-muted-foreground">{invoice.period}</p>
                  </div>
                  <span className="text-sm font-medium">
                    {inr(Math.round(invoice.amount / invoice.equipment.length))}
                  </span>
                </div>
              ))}
            </div>
            <Separator className="my-5" />
            <dl className="ml-auto max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{inr(invoice.amount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Paid</dt>
                <dd className="text-success">{inr(invoice.paid)}</dd>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-base font-semibold">
                <dt>Balance due</dt>
                <dd>{inr(balance)}</dd>
              </div>
            </dl>
          </Card>

          <Card className="gap-0 p-6 shadow-xs">
            <h2 className="text-base font-semibold">Timeline</h2>
            <Separator className="my-5" />
            <ol className="space-y-5">
              {[
                { t: "Invoice generated", m: invoice.number, d: invoice.date },
                { t: "Equipment dispatched", m: invoice.equipment.join(", "), d: invoice.date },
                { t: "Payment reminder sent", m: `Due ${invoice.dueDate}`, d: invoice.dueDate },
                invoice.paid > 0
                  ? { t: "Payment received", m: inr(invoice.paid), d: invoice.dueDate }
                  : { t: "Awaiting payment", m: `Balance ${inr(balance)}`, d: invoice.dueDate },
              ].map((e, i, arr) => (
                <li key={e.t} className="relative flex gap-3">
                  {i !== arr.length - 1 && <span className="absolute left-[15px] top-9 h-full w-px bg-border" />}
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{e.t}</p>
                    <p className="text-xs text-muted-foreground">{e.m}</p>
                    <p className="text-xs text-muted-foreground/70">{e.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <Card className="h-fit gap-0 p-6 shadow-xs">
          <h2 className="text-base font-semibold">Customer</h2>
          <Separator className="my-4" />
          {customer ? (
            <div className="space-y-1.5 text-sm">
              <p className="font-medium">{customer.name}</p>
              <p className="text-muted-foreground">{customer.address}</p>
              <p className="text-muted-foreground">{customer.phone}</p>
              <p className="text-muted-foreground">
                Attender: {customer.attender} ({customer.attenderRelation})
              </p>
              <Button asChild variant="outline" size="sm" className="mt-4 w-full rounded-xl">
                <Link to="/customers/$customerId" params={{ customerId: customer.id }}>
                  View profile
                </Link>
              </Button>
            </div>
          ) : null}
          <Separator className="my-5" />
          <h3 className="text-sm font-semibold">Rental information</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Issued</dt>
              <dd>{invoice.date}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Due</dt>
              <dd>{invoice.dueDate}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Period</dt>
              <dd className="text-right">{invoice.period}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
