import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Printer, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { customers, inr, invoices } from "@/lib/data";

export const Route = createFileRoute("/invoice-preview/$invoiceId")({
  loader: ({ params }) => {
    const invoice = invoices.find((i) => i.id === params.invoiceId);
    if (!invoice) throw notFound();
    return { invoice };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Invoice unavailable · Breath Care Kart" }, { name: "robots", content: "noindex" }] };
    }
    const t = `Printable invoice ${loaderData.invoice.number} · Breath Care Kart`;
    const d = `Print-ready rental invoice for ${loaderData.invoice.customer}, ${loaderData.invoice.period}.`;
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
      ],
    };
  },
  component: InvoicePreviewPage,
});

function InvoicePreviewPage() {
  const { invoice } = Route.useLoaderData();
  const customer = customers.find((c) => c.id === invoice.customerId);
  const lineTotal = Math.round(invoice.amount / invoice.equipment.length);
  const tax = Math.round(invoice.amount * 0.12);

  return (
    <div className="min-h-screen bg-muted/40 py-8">
      <div className="no-print mx-auto mb-6 flex max-w-3xl items-center justify-between px-4">
        <Button asChild variant="ghost" className="rounded-xl">
          <Link to="/invoices/$invoiceId" params={{ invoiceId: invoice.id }}>
            <ArrowLeft className="size-4" /> Back to invoice
          </Link>
        </Button>
        <Button className="rounded-xl" onClick={() => window.print()}>
          <Printer className="size-4" /> Print
        </Button>
      </div>

      <article className="mx-auto max-w-3xl bg-card p-10 shadow-soft print:shadow-none">
        <header className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xl font-semibold tracking-tight">Breath Care Kart</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              No. 18, HSR Layout Sector 2
              <br />
              Bengaluru, Karnataka 560102
              <br />
              GSTIN 29ABCDE1234F1Z5 · +91 80 4711 2200
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Tax invoice</p>
            <p className="mt-1 text-lg font-semibold">{invoice.number}</p>
            <p className="text-xs text-muted-foreground">Issued {invoice.date}</p>
            <p className="text-xs text-muted-foreground">Due {invoice.dueDate}</p>
          </div>
        </header>

        <Separator className="my-8" />

        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Billed to</p>
            <p className="mt-2 text-sm font-semibold">{customer?.name}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {customer?.address}
              <br />
              {customer?.phone}
              <br />
              Attender: {customer?.attender} ({customer?.attenderRelation})
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Rental period</p>
            <p className="mt-2 text-sm font-semibold">{invoice.period}</p>
            <p className="text-xs text-muted-foreground">Billing cycle: monthly · Home delivery</p>
          </div>
        </div>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-y text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2.5">Equipment</th>
              <th className="py-2.5">Period</th>
              <th className="py-2.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.equipment.map((name: string) => (
              <tr key={name} className="border-b">
                <td className="py-3 font-medium">{name}</td>
                <td className="py-3 text-muted-foreground">{invoice.period}</td>
                <td className="py-3 text-right">{inr(lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end">
          <dl className="w-64 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{inr(invoice.amount - tax)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">GST (12%)</dt>
              <dd>{inr(tax)}</dd>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-semibold">
              <dt>Total</dt>
              <dd>{inr(invoice.amount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Received</dt>
              <dd>{inr(invoice.paid)}</dd>
            </div>
            <div className="flex justify-between font-medium">
              <dt>Balance due</dt>
              <dd>{inr(invoice.amount - invoice.paid)}</dd>
            </div>
          </dl>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Terms</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Equipment remains the property of Breath Care Kart. Deposit is refundable on undamaged return. Payment due
              within 7 days of invoice date. Late renewals attract pro-rata daily charges.
            </p>
          </div>
          <div className="flex items-end gap-8">
            <div className="flex size-24 items-center justify-center rounded-xl border border-dashed text-muted-foreground">
              <QrCode className="size-8" />
            </div>
            <div className="text-center">
              <div className="h-12 w-40 border-b" />
              <p className="mt-2 text-xs text-muted-foreground">Authorised signatory</p>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Thank you for trusting Breath Care Kart with your care at home.
        </p>
      </article>
    </div>
  );
}
