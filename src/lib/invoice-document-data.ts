// Shapes a stored invoice + company settings into what the printable document
// and the PDF render. Every figure comes from the database row; nothing is
// recalculated or invented here.
import type { InvoiceWithRelations } from "@/lib/db/invoices";
import type { CompanySettings } from "@/lib/db/types";
import { formatDate } from "@/lib/format";
import { outstandingOf, paymentState, paymentStateLabels, type PaymentState } from "@/lib/status";

export type InvoiceDocumentData = {
  company: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    gstin: string | null;
  };
  /** "Tax invoice" only when a GSTIN is configured. */
  title: string;
  number: string;
  state: PaymentState;
  stateLabel: string;
  transactionType: "rental" | "sale";
  invoiceDate: string;
  dueDate: string;
  period: string | null;
  billTo: { name: string; phone: string | null; address: string | null };
  lines: {
    description: string;
    detail: string | null;
    quantity: number;
    rate: number;
    amount: number;
  }[];
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  total: number;
  paid: number;
  balance: number;
  notes: string | null;
};

export function buildInvoiceDocument(
  invoice: InvoiceWithRelations,
  settings: CompanySettings | null,
): InvoiceDocumentData {
  const state = paymentState(invoice);
  const c = invoice.customer;
  const gstin = settings?.gstin?.trim() || null;
  const notes = [invoice.notes, settings?.invoice_terms]
    .filter((n): n is string => !!n?.trim())
    .join("\n\n");

  return {
    company: {
      name: settings?.company_name ?? "Breath Care Kart",
      address: settings?.address ?? null,
      phone: settings?.phone ?? null,
      email: settings?.email ?? null,
      gstin,
    },
    title: gstin ? "Tax invoice" : "Invoice",
    number: invoice.invoice_number,
    state,
    stateLabel: paymentStateLabels[state],
    transactionType: invoice.transaction_type === "sale" ? "sale" : "rental",
    invoiceDate: formatDate(invoice.invoice_date),
    dueDate: formatDate(invoice.due_date),
    period:
      invoice.period_start && invoice.period_end
        ? `${formatDate(invoice.period_start)} – ${formatDate(invoice.period_end)}`
        : null,
    billTo: {
      name: c?.name ?? "Customer",
      phone: c?.phone ?? null,
      address: [c?.address, c?.city].filter(Boolean).join(", ") || null,
    },
    lines: [...invoice.invoice_items]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((it) => ({
        description: it.description,
        detail: it.rental_period,
        quantity: it.quantity,
        rate: Number(it.rate),
        amount: Number(it.amount),
      })),
    subtotal: Number(invoice.subtotal),
    discount: Number(invoice.discount),
    taxRate: Number(invoice.tax_rate),
    tax: Number(invoice.tax_amount),
    total: Number(invoice.grand_total),
    paid: Number(invoice.amount_paid),
    balance: outstandingOf(invoice),
    notes: notes || null,
  };
}

/** Company fields a GST invoice needs that aren't filled in yet. */
export function missingCompanyFields(settings: CompanySettings | null) {
  const missing: string[] = [];
  if (!settings?.gstin?.trim()) missing.push("GSTIN");
  if (!settings?.address?.trim()) missing.push("address");
  if (!settings?.phone?.trim()) missing.push("phone");
  return missing;
}
