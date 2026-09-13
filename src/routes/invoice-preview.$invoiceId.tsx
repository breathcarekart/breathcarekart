import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { InvoiceDocument, createInvoiceDocumentData } from "@/components/invoices/invoice-document";
import { Button } from "@/components/ui/button";
import { customers, invoices } from "@/lib/data";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";

export const Route = createFileRoute("/invoice-preview/$invoiceId")({
  loader: ({ params }) => {
    const invoice = invoices.find((item) => item.id === params.invoiceId);
    if (!invoice) throw notFound();
    return { invoice };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Invoice unavailable · Breath Care Kart" }, { name: "robots", content: "noindex" }] };
    }
    const title = `Invoice ${loaderData.invoice.number} · Breath Care Kart`;
    const description = `Print-ready rental invoice for ${loaderData.invoice.customer}, ${loaderData.invoice.period}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: InvoicePreviewPage,
});

function InvoicePreviewPage() {
  const { invoice } = Route.useLoaderData();
  const [downloading, setDownloading] = useState(false);
  const customer = customers.find((item) => item.id === invoice.customerId);
  const data = createInvoiceDocumentData(invoice, customer);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadInvoicePdf(data);
      toast.success("Invoice PDF downloaded");
    } catch {
      toast.error("The invoice PDF could not be downloaded");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main className="min-h-screen bg-muted/40 py-6 sm:py-8">
      <div className="no-print mx-auto mb-5 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 sm:px-0">
        <Button asChild variant="ghost" className="rounded-xl">
          <Link to="/invoices/$invoiceId" params={{ invoiceId: invoice.id }}>
            <ArrowLeft className="size-4" /> Back to invoice
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl" onClick={handleDownload} disabled={downloading}>
            <Download className="size-4" /> {downloading ? "Preparing…" : "Download PDF"}
          </Button>
          <Button className="rounded-xl" onClick={() => window.print()}>
            <Printer className="size-4" /> Print Invoice
          </Button>
        </div>
      </div>
      <InvoiceDocument data={data} />
    </main>
  );
}