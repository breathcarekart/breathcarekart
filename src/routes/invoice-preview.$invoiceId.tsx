import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, Loader2, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { ErrorState } from "@/components/shared/error-state";
import { FullPageLoader } from "@/components/shared/loaders";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { requireSession } from "@/lib/auth";
import { invoiceQueries } from "@/lib/db/invoices";
import { settingsQueries } from "@/lib/db/settings";
import { buildInvoiceDocument } from "@/lib/invoice-document-data";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";
import { notifyError, notifySuccess } from "@/lib/notify";

export const Route = createFileRoute("/invoice-preview/$invoiceId")({
  // Lives outside the _app layout (no sidebar for print), so it needs its own guard.
  ssr: false,
  beforeLoad: ({ location }) => requireSession(location),
  pendingComponent: FullPageLoader,
  // `?print=true` (from the invoice's Print button) opens the print dialog once loaded.
  validateSearch: (search: Record<string, unknown>): { print?: boolean | undefined } => ({
    print: search["print"] === true || search["print"] === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [{ title: "Invoice · Breath Care Kart" }, { name: "robots", content: "noindex" }],
  }),
  component: InvoicePreviewPage,
});

function InvoicePreviewPage() {
  const { invoiceId } = Route.useParams();
  const { print } = Route.useSearch();
  const invoice = useQuery(invoiceQueries.detail(invoiceId));
  const settings = useQuery(settingsQueries.company());
  const [downloading, setDownloading] = useState(false);
  const ready = invoice.isSuccess && !settings.isPending;
  const data = invoice.data ? buildInvoiceDocument(invoice.data, settings.data ?? null) : null;

  useEffect(() => {
    if (!print || !ready) return;
    // Let the logo and fonts paint before the print dialog snapshots the page.
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [print, ready]);

  if (invoice.isPending || settings.isPending) return <FullPageLoader />;
  if (invoice.isError || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <div className="w-full max-w-md">
          <ErrorState
            error={invoice.error}
            title="Couldn't load this invoice"
            onRetry={() => void invoice.refetch()}
          />
        </div>
      </main>
    );
  }

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadInvoicePdf(data);
      notifySuccess("Invoice PDF downloaded");
    } catch (error) {
      notifyError(error, "The invoice PDF could not be downloaded");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main className="min-h-screen bg-muted/40 py-6 sm:py-8">
      <div className="no-print mx-auto mb-5 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 sm:px-0">
        <Button asChild variant="ghost" className="rounded-xl">
          <Link to="/invoices/$invoiceId" params={{ invoiceId }}>
            <ArrowLeft className="size-4" /> Back to invoice
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {downloading ? "Preparing…" : "Download PDF"}
          </Button>
          <Button className="rounded-xl" onClick={() => window.print()}>
            <Printer className="size-4" /> Print Invoice
          </Button>
        </div>
      </div>
      <InvoiceDocument data={data} />
      <Toaster position="top-right" richColors />
    </main>
  );
}
