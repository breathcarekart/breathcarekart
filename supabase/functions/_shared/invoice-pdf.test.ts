/// <reference types="node" />
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { BRAND_LOGO_DATA_URL } from "./brand-logo.ts";
import {
  buildInvoicePdfData,
  paymentState,
  todayInIndia,
  type InvoiceRow,
} from "./invoice-document.ts";
import { invoicePdfFilename, renderInvoicePdf } from "./invoice-pdf-layout.ts";

const row: InvoiceRow = {
  id: "inv-1",
  invoice_number: "BCK/2026/0001",
  invoice_date: "2026-11-03",
  due_date: "2026-11-10",
  period_start: "2026-11-03",
  period_end: "2026-12-02",
  transaction_type: "rental",
  subtotal: "12750.00",
  discount: "250.00",
  tax_rate: "18.00",
  tax_amount: "2250.00",
  grand_total: "14750.00",
  amount_paid: "5000.00",
  status: "pending",
  notes: "Handle with care.",
};
const customer = {
  id: "c1",
  name: "Test Customer",
  phone: "9845011223",
  whatsapp: null,
  address: "Street 1",
  city: "City",
};
const items = [
  {
    description: "Second item",
    rental_period: null,
    quantity: 1,
    rate: "250",
    amount: "250",
    created_at: "2026-11-03T10:05:00Z",
  },
  {
    description: "First item",
    rental_period: "03 Nov – 02 Dec",
    quantity: 1,
    rate: "12500",
    amount: "12500",
    created_at: "2026-11-03T10:00:00Z",
  },
];
const settings = {
  company_name: "Breath Care Kart",
  address: "Addr",
  phone: "0000000000",
  email: null,
  gstin: "29AAAAA0000A1Z5",
  invoice_terms: "Terms text.",
};

test("the embedded server logo is exactly the app's logo file", () => {
  const file = readFileSync(
    new URL("../../../src/assets/breath-care-kart-logo.jpeg", import.meta.url),
  );
  assert.equal(BRAND_LOGO_DATA_URL, `data:image/jpeg;base64,${file.toString("base64")}`);
});

test("invoice rows map to the same document fields the browser uses", () => {
  const d = buildInvoicePdfData(row, customer, items, settings, "2026-11-03");
  assert.equal(d.title, "Tax invoice");
  assert.equal(d.number, "BCK/2026/0001");
  assert.equal(d.stateLabel, "Partially paid");
  assert.equal(d.transactionType, "rental");
  assert.equal(d.billTo.address, "Street 1, City");
  assert.deepEqual(
    d.lines.map((l) => l.description),
    ["First item", "Second item"],
  );
  assert.equal(d.total, 14750);
  assert.equal(d.discount, 250);
  assert.equal(d.balance, 9750);
  assert.equal(d.notes, "Handle with care.\n\nTerms text.");
  assert.match(d.invoiceDate, /^03 Nov 2026$/);
});

test("without a GSTIN it is a plain invoice; missing settings fall back to the company name", () => {
  const d = buildInvoicePdfData(row, customer, items, null, "2026-11-03");
  assert.equal(d.title, "Invoice");
  assert.equal(d.company.name, "Breath Care Kart");
});

test("overdue is judged on India's date, not the server's UTC date", () => {
  // 10 Nov 2026 00:30 in India is still 9 Nov in UTC.
  const lateEvening = new Date("2026-11-09T19:00:00Z");
  assert.equal(todayInIndia(lateEvening), "2026-11-10");
  assert.equal(
    paymentState({ ...row, due_date: "2026-11-09" }, todayInIndia(lateEvening)),
    "overdue",
  );
  assert.equal(
    paymentState({ ...row, due_date: "2026-11-10" }, todayInIndia(lateEvening)),
    "partial",
  );
  assert.equal(paymentState({ ...row, amount_paid: "14750" }, "2026-12-31"), "paid");
  assert.equal(paymentState({ ...row, status: "draft" }, "2026-11-03"), "draft");
});

test("server-side PDF: valid, one page, logo embedded, key figures present", () => {
  const data = buildInvoicePdfData(row, customer, items, settings, "2026-11-03");
  const bytes = new Uint8Array(renderInvoicePdf(data, BRAND_LOGO_DATA_URL).output("arraybuffer"));
  const text = new TextDecoder("latin1").decode(bytes);
  assert.equal(text.slice(0, 5), "%PDF-");
  assert.match(text, /%%EOF\s*$/);
  assert.equal((text.match(/\/Type \/Page[^s]/g) ?? []).length, 1);
  assert.match(text, /\/Subtype \/Image/);
  for (const s of ["BCK/2026/0001", "Rs. 14,750", "Rs. 9,750", "Test Customer", "TAX INVOICE"]) {
    assert.ok(text.includes(s), s);
  }
  assert.ok(bytes.length > 100_000 && bytes.length < 5 * 1024 * 1024, `size ${bytes.length}`);
});

test("PDF file name matches the browser download name", () => {
  assert.equal(invoicePdfFilename("BCK/2026/0001"), "BCK-2026-0001.pdf");
});

// ── Business & GST settings (migration 20261104000000) ─────────────────────
test("registered business: Tax invoice with the GSTIN; not registered: plain invoice, no GSTIN", () => {
  const reg = buildInvoicePdfData(
    row,
    customer,
    items,
    { ...settings, gst_registered: true },
    "2026-11-03",
  );
  assert.equal(reg.title, "Tax invoice");
  assert.equal(reg.company.gstin, "29AAAAA0000A1Z5");
  // A GSTIN left in the row while marked Not registered is never printed.
  const unreg = buildInvoicePdfData(
    row,
    customer,
    items,
    { ...settings, gst_registered: false },
    "2026-11-03",
  );
  assert.equal(unreg.title, "Invoice");
  assert.equal(unreg.company.gstin, null);
  const text = new TextDecoder("latin1").decode(
    new Uint8Array(renderInvoicePdf(unreg, BRAND_LOGO_DATA_URL).output("arraybuffer")),
  );
  assert.ok(!text.includes("GSTIN") && !text.includes("TAX INVOICE"));
});

test("stored tax figures are printed as saved, whatever the current settings say", () => {
  // Same invoice, settings changed afterwards: subtotal, GST and total still come from the row.
  for (const s of [settings, { ...settings, gst_registered: false, gstin: null }, null]) {
    const d = buildInvoicePdfData(row, customer, items, s, "2026-11-03");
    assert.deepEqual(
      [d.subtotal, d.discount, d.taxRate, d.tax, d.total],
      [12750, 250, 18, 2250, 14750],
    );
    // Taxable value (subtotal − discount) + GST = grand total.
    assert.equal(d.subtotal - d.discount + d.tax, d.total);
  }
});

test("the authorised signatory is printed only when set, without changing other PDFs", () => {
  const plain = buildInvoicePdfData(row, customer, items, settings, "2026-11-03");
  const signed = buildInvoicePdfData(
    row,
    customer,
    items,
    { ...settings, authorised_signatory: "  Signatory Name  " },
    "2026-11-03",
  );
  assert.equal(plain.company.signatory, null);
  assert.equal(signed.company.signatory, "Signatory Name");
  const pdf = (d: typeof plain) =>
    new TextDecoder("latin1").decode(
      new Uint8Array(renderInvoicePdf(d, BRAND_LOGO_DATA_URL).output("arraybuffer")),
    );
  assert.ok(pdf(signed).includes("Signatory Name"));
  assert.ok(!pdf(plain).includes("Signatory Name"));
});
