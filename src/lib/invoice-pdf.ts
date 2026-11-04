import { breathCareKartLogoUrl } from "@/components/shared/brand-logo";
import type { InvoiceDocumentData } from "@/lib/invoice-document-data";
import {
  invoicePdfFilename,
  renderInvoicePdf,
} from "../../supabase/functions/_shared/invoice-pdf-layout.ts";

async function imageAsDataUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Logo could not be loaded");
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Logo could not be read"));
    reader.onerror = () => reject(new Error("Logo could not be read"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Builds the A4 PDF from the same data as the on-screen invoice and downloads it.
 * The layout itself lives in supabase/functions/_shared/invoice-pdf-layout.ts so the
 * WhatsApp Edge Function renders exactly the same document on the server.
 */
export async function downloadInvoicePdf(data: InvoiceDocumentData) {
  const logo = await imageAsDataUrl(breathCareKartLogoUrl);
  const doc = renderInvoicePdf(data, logo);
  doc.save(invoicePdfFilename(data.number));
}

export { invoicePdfFilename };
