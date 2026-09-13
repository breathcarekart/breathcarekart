import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { breathCareKartLogoUrl } from "@/components/shared/brand-logo";
import { companyDetails, type InvoiceDocumentData } from "@/components/invoices/invoice-document";

async function imageAsDataUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Logo could not be loaded");
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Logo could not be read"));
    reader.onerror = () => reject(new Error("Logo could not be read"));
    reader.readAsDataURL(blob);
  });
}

const money = (value: number) => `Rs. ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)}`;

export async function downloadInvoicePdf(data: InvoiceDocumentData) {
  const { invoice, customer, lines, subtotal, discount, taxRate, tax, total, notes } = data;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const brand: [number, number, number] = [28, 96, 154];
  const muted: [number, number, number] = [88, 101, 114];
  const logo = await imageAsDataUrl(breathCareKartLogoUrl);

  doc.addImage(logo, "JPEG", 16, 14, 24, 24);
  doc.setTextColor(...brand);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(companyDetails.name, 44, 20);
  doc.setTextColor(...muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(companyDetails.address, 44, 25, { maxWidth: 82 });
  doc.text(`${companyDetails.phone} | ${companyDetails.email}`, 44, 32);
  doc.text(`GSTIN: ${companyDetails.gstin}`, 44, 36);

  doc.setTextColor(...brand);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("TAX INVOICE", 194, 18, { align: "right" });
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(13);
  doc.text(invoice.number, 194, 24, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Status: ${invoice.status.toUpperCase()}`, 194, 30, { align: "right" });
  doc.setDrawColor(...brand);
  doc.setLineWidth(0.7);
  doc.line(16, 43, 194, 43);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...brand);
  doc.text("BILL TO", 16, 52);
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.text(customer?.name ?? invoice.customer, 16, 58);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text(customer?.phone ?? "Phone not available", 16, 63);
  doc.text(customer?.address ?? "Address not available", 16, 68, { maxWidth: 80 });

  doc.setTextColor(30, 41, 59);
  doc.text(`Invoice date: ${invoice.date}`, 125, 52);
  doc.text(`Due date: ${invoice.dueDate}`, 125, 58);
  doc.text(`Rental period: ${invoice.period}`, 125, 64, { maxWidth: 69 });

  autoTable(doc, {
    startY: 80,
    margin: { left: 16, right: 16 },
    head: [["Equipment", "Qty", "Rental period", "Rate", "Amount"]],
    body: lines.map((line) => [line.name, String(line.quantity), line.period, money(line.rate), money(line.rate * line.quantity)]),
    theme: "plain",
    headStyles: { fillColor: [235, 244, 250], textColor: brand, fontStyle: "bold", cellPadding: 3 },
    bodyStyles: { textColor: [30, 41, 59], cellPadding: 3.5, lineColor: [220, 228, 235], lineWidth: { bottom: 0.2 } },
    columnStyles: { 1: { halign: "center", cellWidth: 12 }, 3: { halign: "right", cellWidth: 27 }, 4: { halign: "right", cellWidth: 29 } },
    styles: { font: "helvetica", fontSize: 8 },
  });

  const tableEnd = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 110;
  let y = tableEnd + 9;
  const summaryX = 132;
  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...(bold ? brand : muted));
    doc.text(label, summaryX, y);
    doc.setTextColor(...(bold ? brand : ([30, 41, 59] as [number, number, number])));
    doc.text(value, 194, y, { align: "right" });
    y += 6;
  };
  row("Subtotal", money(subtotal));
  row("Discount", `- ${money(discount)}`);
  row(`GST / Tax (${taxRate}%)`, money(tax));
  doc.setDrawColor(...brand);
  doc.line(summaryX, y - 2, 194, y - 2);
  row("Grand total", money(total), true);
  row("Amount received", money(invoice.paid));
  row("Balance due", money(total - invoice.paid), true);

  const notesY = Math.max(y + 9, 180);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...brand);
  doc.setFontSize(8);
  doc.text("NOTES / TERMS & CONDITIONS", 16, notesY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...muted);
  doc.text(doc.splitTextToSize(notes, 110), 16, notesY + 6);

  doc.setDrawColor(30, 41, 59);
  doc.line(145, 253, 194, 253);
  doc.setTextColor(30, 41, 59);
  doc.text("Authorized Signature", 169.5, 258, { align: "center" });
  doc.setTextColor(...muted);
  doc.text(`For ${companyDetails.name}`, 169.5, 263, { align: "center" });
  doc.setDrawColor(220, 228, 235);
  doc.line(16, 274, 194, 274);
  doc.text("Thank you for trusting Breath Care Kart with your care at home.", 105, 280, { align: "center" });

  doc.save(`${invoice.number.replaceAll("/", "-")}.pdf`);
}