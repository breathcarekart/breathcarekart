import { BrandLogo } from "@/components/shared/brand-logo";
import { StatusBadge } from "@/components/shared/status-badge";
import { inr } from "@/lib/format";
import type { InvoiceDocumentData } from "@/lib/invoice-document-data";
import { paymentStateTone } from "@/lib/status";

function InvoiceMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-5 border-b border-invoice-line py-2 last:border-0">
      <dt className="text-invoice-muted">{label}</dt>
      <dd className="text-right font-medium text-invoice-ink">{value}</dd>
    </div>
  );
}

/** Printable A4 invoice built from a stored invoice (see buildInvoiceDocument). */
export function InvoiceDocument({ data }: { data: InvoiceDocumentData }) {
  const { company, lines } = data;
  const contact = [company.phone, company.email].filter(Boolean).join(" · ");

  return (
    <article className="invoice-page mx-auto min-h-[297mm] w-full max-w-[210mm] bg-invoice-paper p-5 text-invoice-ink shadow-soft sm:p-10 print:p-[14mm] print:shadow-none">
      <header className="flex flex-col justify-between gap-7 border-b-2 border-invoice-brand pb-7 sm:flex-row sm:items-start">
        <div className="flex items-start gap-4">
          <BrandLogo className="size-20 shrink-0" />
          <div>
            <h1 className="text-2xl font-bold text-invoice-brand">{company.name}</h1>
            {company.address ? (
              <p className="mt-1 max-w-xs whitespace-pre-line text-xs leading-5 text-invoice-muted">
                {company.address}
              </p>
            ) : null}
            {contact ? <p className="text-xs leading-5 text-invoice-muted">{contact}</p> : null}
            {company.gstin ? (
              <p className="text-xs leading-5 text-invoice-muted">GSTIN: {company.gstin}</p>
            ) : null}
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-normal text-invoice-brand">
            {data.title}
          </p>
          <p className="mt-1 text-xl font-bold">{data.number}</p>
          <div className="mt-3 inline-flex">
            <StatusBadge tone={paymentStateTone[data.state]} label={data.stateLabel} />
          </div>
        </div>
      </header>

      <section className="grid gap-7 border-b border-invoice-line py-7 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-invoice-brand">
            Bill to
          </p>
          <p className="mt-3 text-sm font-semibold">{data.billTo.name}</p>
          {data.billTo.phone ? (
            <p className="mt-1 text-xs leading-5 text-invoice-muted">{data.billTo.phone}</p>
          ) : null}
          {data.billTo.address ? (
            <p className="max-w-xs text-xs leading-5 text-invoice-muted">{data.billTo.address}</p>
          ) : null}
        </div>
        <dl className="text-xs">
          <InvoiceMeta label="Invoice date" value={data.invoiceDate} />
          <InvoiceMeta label="Due date" value={data.dueDate} />
          <InvoiceMeta label="Type" value={data.transactionType === "sale" ? "Sale" : "Rental"} />
          {data.period ? <InvoiceMeta label="Rental period" value={data.period} /> : null}
          <InvoiceMeta label="Payment status" value={data.stateLabel} />
        </dl>
      </section>

      <section className="py-7">
        <h2 className="mb-4 text-sm font-semibold text-invoice-brand">
          {data.transactionType === "sale" ? "Items sold" : "Rental & equipment details"}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-xs">
            <thead>
              <tr className="bg-invoice-soft text-left text-invoice-brand">
                <th className="px-3 py-3 font-semibold">Description</th>
                <th className="px-3 py-3 text-center font-semibold">Qty</th>
                <th className="px-3 py-3 font-semibold">
                  {data.transactionType === "sale" ? "" : "Period"}
                </th>
                <th className="px-3 py-3 text-right font-semibold">Rate</th>
                <th className="px-3 py-3 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={`${line.description}-${index}`} className="border-b border-invoice-line">
                  <td className="px-3 py-4 font-medium">{line.description}</td>
                  <td className="px-3 py-4 text-center">{line.quantity}</td>
                  <td className="px-3 py-4 text-invoice-muted">{line.detail ?? ""}</td>
                  <td className="px-3 py-4 text-right">{inr(line.rate)}</td>
                  <td className="px-3 py-4 text-right font-medium">{inr(line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex justify-end border-b border-invoice-line pb-7">
        <dl className="w-full max-w-xs space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-invoice-muted">Subtotal</dt>
            <dd>{inr(data.subtotal)}</dd>
          </div>
          {data.discount > 0 ? (
            <div className="flex justify-between">
              <dt className="text-invoice-muted">Discount</dt>
              <dd>−{inr(data.discount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-invoice-muted">GST ({data.taxRate}%)</dt>
            <dd>{inr(data.tax)}</dd>
          </div>
          <div className="mt-3 flex justify-between border-t-2 border-invoice-brand pt-3 text-base font-bold text-invoice-brand">
            <dt>Grand total</dt>
            <dd>{inr(data.total)}</dd>
          </div>
          <div className="flex justify-between text-xs">
            <dt className="text-invoice-muted">Amount received</dt>
            <dd>{inr(data.paid)}</dd>
          </div>
          <div className="flex justify-between text-xs font-semibold">
            <dt>Balance due</dt>
            <dd>{inr(data.balance)}</dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-10 py-7 sm:grid-cols-[1fr_190px]">
        <div>
          {data.notes ? (
            <>
              <h2 className="text-xs font-semibold uppercase tracking-normal text-invoice-brand">
                Notes / Terms
              </h2>
              <p className="mt-2 whitespace-pre-line text-xs leading-5 text-invoice-muted">
                {data.notes}
              </p>
            </>
          ) : null}
        </div>
        <div className="flex min-h-24 flex-col justify-end text-center">
          <div className="border-b border-invoice-ink" />
          <p className="mt-2 text-xs font-medium">Authorized Signature</p>
          <p className="text-[10px] text-invoice-muted">For {company.name}</p>
        </div>
      </section>

      <footer className="mt-auto border-t border-invoice-line pt-4 text-center text-[10px] text-invoice-muted">
        Thank you for choosing {company.name}.
      </footer>
    </article>
  );
}
