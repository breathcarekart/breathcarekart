// Server-side twin of src/lib/invoice-document-data.ts (buildInvoiceDocument): shapes stored
// invoice rows + company settings into what the PDF prints. Same rules, same labels, same
// date style. Edge Functions can't import the app's src/ files, so this is a faithful port;
// keep the two in step when either changes.
import type { InvoicePdfData } from "./invoice-pdf-layout.ts";

export type InvoiceStatus = "draft" | "pending" | "paid" | "overdue" | "cancelled";

/** The invoice row as read from the database (only the columns the document needs). */
export type InvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  period_start: string | null;
  period_end: string | null;
  transaction_type: string;
  subtotal: number | string;
  discount: number | string;
  tax_rate: number | string;
  tax_amount: number | string;
  grand_total: number | string;
  amount_paid: number | string;
  status: InvoiceStatus;
  notes: string | null;
};

export type InvoiceCustomer = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  city: string | null;
};

export type InvoiceItemRow = {
  description: string;
  rental_period: string | null;
  quantity: number;
  rate: number | string;
  amount: number | string;
  created_at: string;
};

export type CompanySettingsRow = {
  company_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  invoice_terms: string | null;
  /** Missing before migration 20261104000000; a saved GSTIN then counts as registered. */
  gst_registered?: boolean;
  authorised_signatory?: string | null;
};

// Same formatter as the app's formatDate ("05 Aug 2026"), so the PDF reads the same.
const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const toDate = (value: string) => new Date(value.length === 10 ? `${value}T00:00:00` : value);
export const formatDate = (value: string | null | undefined) =>
  value ? dateFmt.format(toDate(value)) : "—";

/** Today's date (YYYY-MM-DD) in India, where the business runs. The server itself runs in UTC. */
export const todayInIndia = (now: Date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);

const stateLabels = {
  paid: "Paid",
  partial: "Partially paid",
  outstanding: "Outstanding",
  overdue: "Overdue",
  draft: "Draft",
  cancelled: "Cancelled",
} as const;

/** Same rules as the app's paymentState(), with "today" taken in India. */
export function paymentState(i: InvoiceRow, today: string): keyof typeof stateLabels {
  if (i.status === "cancelled") return "cancelled";
  if (i.status === "draft") return "draft";
  const total = Number(i.grand_total);
  const paid = Number(i.amount_paid);
  if (paid >= total) return "paid";
  if (i.due_date < today) return "overdue";
  return paid > 0 ? "partial" : "outstanding";
}

/** Same rule as the app's outstandingOf(). */
export const outstandingOf = (i: InvoiceRow) =>
  i.status === "cancelled" || i.status === "draft"
    ? 0
    : Math.max(0, Number(i.grand_total) - Number(i.amount_paid));

export function buildInvoicePdfData(
  invoice: InvoiceRow,
  customer: InvoiceCustomer | null,
  items: InvoiceItemRow[],
  settings: CompanySettingsRow | null,
  today: string,
): InvoicePdfData {
  const state = paymentState(invoice, today);
  // A GSTIN is printed only for a business marked as GST registered.
  const gstin = (settings?.gst_registered !== false && settings?.gstin?.trim()) || null;
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
      signatory: settings?.authorised_signatory?.trim() || null,
    },
    title: gstin ? "Tax invoice" : "Invoice",
    number: invoice.invoice_number,
    stateLabel: stateLabels[state],
    transactionType: invoice.transaction_type === "sale" ? "sale" : "rental",
    invoiceDate: formatDate(invoice.invoice_date),
    dueDate: formatDate(invoice.due_date),
    period:
      invoice.period_start && invoice.period_end
        ? `${formatDate(invoice.period_start)} – ${formatDate(invoice.period_end)}`
        : null,
    billTo: {
      name: customer?.name ?? "Customer",
      phone: customer?.phone ?? null,
      address: [customer?.address, customer?.city].filter(Boolean).join(", ") || null,
    },
    lines: [...items]
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
