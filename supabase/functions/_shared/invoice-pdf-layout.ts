// The A4 invoice PDF layout, shared by the browser download (src/lib/invoice-pdf.ts)
// and the send-invoice-whatsapp Edge Function, so both produce the same document.
//
// Runtime-neutral: no window, DOM, FileReader or downloads here. The caller passes the
// logo as a data URL and decides what to do with the finished document.
import { jsPDF } from "jspdf";
// Named export: typed correctly for both the browser build (TypeScript) and Deno's checker.
import { autoTable } from "jspdf-autotable";

/** Everything the layout prints. Built from stored invoice rows; nothing is recalculated here. */
export type InvoicePdfData = {
  company: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    gstin: string | null;
    /** Printed under "Authorized Signature" when set. */
    signatory?: string | null;
  };
  title: string;
  number: string;
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

// jsPDF's built-in fonts have no ₹ glyph, so amounts use "Rs.".
const money = (value: number) =>
  `Rs. ${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)}`;

/** Lays out the invoice and returns the jsPDF document (not saved or downloaded). */
export function renderInvoicePdf(data: InvoicePdfData, logoDataUrl: string): jsPDF {
  const { company, lines } = data;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const brand: [number, number, number] = [28, 96, 154];
  const muted: [number, number, number] = [88, 101, 114];
  const ink: [number, number, number] = [30, 41, 59];

  doc.addImage(logoDataUrl, "JPEG", 16, 14, 24, 24);
  doc.setTextColor(...brand);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(company.name, 44, 20);
  doc.setTextColor(...muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let headerY = 25;
  if (company.address) {
    const addr = doc.splitTextToSize(company.address, 82) as string[];
    doc.text(addr, 44, headerY);
    headerY += addr.length * 3.6;
  }
  const contact = [company.phone, company.email].filter(Boolean).join(" | ");
  if (contact) {
    doc.text(contact, 44, headerY + 1);
    headerY += 4;
  }
  if (company.gstin) doc.text(`GSTIN: ${company.gstin}`, 44, headerY + 1);

  doc.setTextColor(...brand);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(data.title.toUpperCase(), 194, 18, { align: "right" });
  doc.setTextColor(...ink);
  doc.setFontSize(13);
  doc.text(data.number, 194, 24, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Status: ${data.stateLabel}`, 194, 30, { align: "right" });
  doc.setDrawColor(...brand);
  doc.setLineWidth(0.7);
  doc.line(16, 43, 194, 43);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...brand);
  doc.text("BILL TO", 16, 52);
  doc.setTextColor(...ink);
  doc.setFontSize(10);
  doc.text(data.billTo.name, 16, 58);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  if (data.billTo.phone) doc.text(data.billTo.phone, 16, 63);
  if (data.billTo.address) doc.text(data.billTo.address, 16, 68, { maxWidth: 80 });

  doc.setTextColor(...ink);
  doc.text(`Invoice date: ${data.invoiceDate}`, 125, 52);
  doc.text(`Due date: ${data.dueDate}`, 125, 58);
  doc.text(`Type: ${data.transactionType === "sale" ? "Sale" : "Rental"}`, 125, 64);
  if (data.period) doc.text(`Rental period: ${data.period}`, 125, 70, { maxWidth: 69 });

  autoTable(doc, {
    startY: 80,
    margin: { left: 16, right: 16 },
    head: [
      ["Description", "Qty", data.transactionType === "sale" ? "" : "Period", "Rate", "Amount"],
    ],
    body: lines.map((line) => [
      line.description,
      String(line.quantity),
      line.detail ?? "",
      money(line.rate),
      money(line.amount),
    ]),
    theme: "plain",
    headStyles: { fillColor: [235, 244, 250], textColor: brand, fontStyle: "bold", cellPadding: 3 },
    bodyStyles: {
      textColor: ink,
      cellPadding: 3.5,
      lineColor: [220, 228, 235],
      lineWidth: { bottom: 0.2 },
    },
    columnStyles: {
      1: { halign: "center", cellWidth: 12 },
      3: { halign: "right", cellWidth: 27 },
      4: { halign: "right", cellWidth: 29 },
    },
    styles: { font: "helvetica", fontSize: 8 },
  });

  const tableEnd =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 110;
  let y = tableEnd + 9;
  const summaryX = 132;
  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...(bold ? brand : muted));
    doc.text(label, summaryX, y);
    doc.setTextColor(...(bold ? brand : ink));
    doc.text(value, 194, y, { align: "right" });
    y += 6;
  };
  row("Subtotal", money(data.subtotal));
  if (data.discount > 0) row("Discount", `- ${money(data.discount)}`);
  row(`GST (${data.taxRate}%)`, money(data.tax));
  doc.setDrawColor(...brand);
  doc.line(summaryX, y - 4, 194, y - 4);
  row("Grand total", money(data.total), true);
  row("Amount received", money(data.paid));
  row("Balance due", money(data.balance), true);

  const notesY = Math.max(y + 9, 180);
  if (data.notes) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...brand);
    doc.setFontSize(8);
    doc.text("NOTES / TERMS", 16, notesY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...muted);
    doc.text(doc.splitTextToSize(data.notes, 110), 16, notesY + 6);
  }

  doc.setDrawColor(...ink);
  doc.line(145, 253, 194, 253);
  doc.setTextColor(...ink);
  doc.text("Authorized Signature", 169.5, 258, { align: "center" });
  let forY = 263;
  if (company.signatory) {
    doc.text(company.signatory, 169.5, 263, { align: "center", maxWidth: 49 });
    forY = 268;
  }
  doc.setTextColor(...muted);
  doc.text(`For ${company.name}`, 169.5, forY, { align: "center" });
  doc.setDrawColor(220, 228, 235);
  doc.line(16, 274, 194, 274);
  doc.text(`Thank you for choosing ${company.name}.`, 105, 280, { align: "center" });

  return doc;
}

/** File name used for downloads and the WhatsApp attachment, e.g. "BCK-2026-0001.pdf". */
export const invoicePdfFilename = (invoiceNumber: string) =>
  `${invoiceNumber.replaceAll("/", "-")}.pdf`;
