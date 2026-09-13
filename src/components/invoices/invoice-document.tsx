import { BrandLogo } from "@/components/shared/brand-logo";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { inr, type Customer, type Invoice } from "@/lib/data";

export type InvoiceLine = {
  name: string;
  quantity: number;
  period: string;
  rate: number;
};

export type InvoiceDocumentData = {
  invoice: Invoice;
  customer: Customer | undefined;
  lines: InvoiceLine[];
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  total: number;
  notes: string;
};

export const companyDetails = {
  name: "Breath Care Kart",
  address: "No. 18, HSR Layout Sector 2, Bengaluru, Karnataka 560102",
  phone: "+91 80 4711 2200",
  gstin: "29ABCDE1234F1Z5",
  email: "care@breathcarekart.com",
};

export function createInvoiceDocumentData(invoice: Invoice, customer?: Customer): InvoiceDocumentData {
  const taxRate = invoice.taxRate ?? 12;
  const discount = invoice.discount ?? 0;
  const taxable = taxRate > 0 ? Math.round(invoice.amount / (1 + taxRate / 100)) : invoice.amount;
  const tax = invoice.tax ?? invoice.amount - taxable;
  const subtotal = invoice.subtotal ?? taxable + discount;
  const lineTotal = invoice.equipment.length > 0 ? subtotal / invoice.equipment.length : 0;

  return {
    invoice,
    customer,
    lines: invoice.equipment.map((name) => ({
      name,
      quantity: 1,
      period: invoice.period,
      rate: lineTotal,
    })),
    subtotal,
    discount,
    taxRate,
    tax,
    total: invoice.amount,
    notes:
      invoice.notes ??
      "Equipment remains the property of Breath Care Kart. Deposit is refundable on undamaged return. Payment is due within 7 days of the invoice date. Late renewals attract pro-rata daily charges.",
  };
}

function InvoiceMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-5 border-b border-invoice-line py-2 last:border-0">
      <dt className="text-invoice-muted">{label}</dt>
      <dd className="text-right font-medium text-invoice-ink">{value}</dd>
    </div>
  );
}

export function InvoiceDocument({ data }: { data: InvoiceDocumentData }) {
  const { invoice, customer, lines, subtotal, discount, taxRate, tax, total, notes } = data;

  return (
    <article className="invoice-page mx-auto min-h-[297mm] w-full max-w-[210mm] bg-invoice-paper p-5 text-invoice-ink shadow-soft sm:p-10 print:p-[14mm] print:shadow-none">
      <header className="flex flex-col justify-between gap-7 border-b-2 border-invoice-brand pb-7 sm:flex-row sm:items-start">
        <div className="flex items-start gap-4">
          <BrandLogo className="size-20 shrink-0" />
          <div>
            <h1 className="text-2xl font-bold text-invoice-brand">{companyDetails.name}</h1>
            <p className="mt-1 max-w-xs text-xs leading-5 text-invoice-muted">{companyDetails.address}</p>
            <p className="text-xs leading-5 text-invoice-muted">
              {companyDetails.phone} · {companyDetails.email}
            </p>
            <p className="text-xs leading-5 text-invoice-muted">GSTIN: {companyDetails.gstin}</p>
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-normal text-invoice-brand">Tax invoice</p>
          <p className="mt-1 text-xl font-bold">{invoice.number}</p>
          <div className="mt-3 inline-flex">
            <StatusBadge tone={invoice.status as Tone} />
          </div>
        </div>
      </header>

      <section className="grid gap-7 border-b border-invoice-line py-7 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-invoice-brand">Bill to</p>
          <p className="mt-3 text-sm font-semibold">{customer?.name ?? invoice.customer}</p>
          <p className="mt-1 text-xs leading-5 text-invoice-muted">{customer?.phone ?? "Phone not available"}</p>
          <p className="max-w-xs text-xs leading-5 text-invoice-muted">
            {customer?.address ?? "Address not available"}
          </p>
        </div>
        <dl className="text-xs">
          <InvoiceMeta label="Invoice date" value={invoice.date} />
          <InvoiceMeta label="Due date" value={invoice.dueDate} />
          <InvoiceMeta label="Rental period" value={invoice.period} />
          <InvoiceMeta label="Payment status" value={invoice.status.toUpperCase()} />
        </dl>
      </section>

      <section className="py-7">
        <h2 className="mb-4 text-sm font-semibold text-invoice-brand">Rental &amp; equipment details</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-xs">
            <thead>
              <tr className="bg-invoice-soft text-left text-invoice-brand">
                <th className="px-3 py-3 font-semibold">Equipment</th>
                <th className="px-3 py-3 text-center font-semibold">Qty</th>
                <th className="px-3 py-3 font-semibold">Rental period</th>
                <th className="px-3 py-3 text-right font-semibold">Rate</th>
                <th className="px-3 py-3 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={`${line.name}-${index}`} className="border-b border-invoice-line">
                  <td className="px-3 py-4 font-medium">{line.name}</td>
                  <td className="px-3 py-4 text-center">{line.quantity}</td>
                  <td className="px-3 py-4 text-invoice-muted">{line.period}</td>
                  <td className="px-3 py-4 text-right">{inr(line.rate)}</td>
                  <td className="px-3 py-4 text-right font-medium">{inr(line.rate * line.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex justify-end border-b border-invoice-line pb-7">
        <dl className="w-full max-w-xs space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-invoice-muted">Subtotal</dt><dd>{inr(subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-invoice-muted">Discount</dt><dd>−{inr(discount)}</dd></div>
          <div className="flex justify-between"><dt className="text-invoice-muted">GST / Tax ({taxRate}%)</dt><dd>{inr(tax)}</dd></div>
          <div className="mt-3 flex justify-between border-t-2 border-invoice-brand pt-3 text-base font-bold text-invoice-brand">
            <dt>Grand total</dt><dd>{inr(total)}</dd>
          </div>
          <div className="flex justify-between text-xs"><dt className="text-invoice-muted">Amount received</dt><dd>{inr(invoice.paid)}</dd></div>
          <div className="flex justify-between text-xs font-semibold"><dt>Balance due</dt><dd>{inr(total - invoice.paid)}</dd></div>
        </dl>
      </section>

      <section className="grid gap-10 py-7 sm:grid-cols-[1fr_190px]">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-normal text-invoice-brand">Notes / Terms &amp; Conditions</h2>
          <p className="mt-2 text-xs leading-5 text-invoice-muted">{notes}</p>
        </div>
        <div className="flex min-h-24 flex-col justify-end text-center">
          <div className="border-b border-invoice-ink" />
          <p className="mt-2 text-xs font-medium">Authorized Signature</p>
          <p className="text-[10px] text-invoice-muted">For {companyDetails.name}</p>
        </div>
      </section>

      <footer className="mt-auto border-t border-invoice-line pt-4 text-center text-[10px] text-invoice-muted">
        Thank you for trusting Breath Care Kart with your care at home.
      </footer>
    </article>
  );
}