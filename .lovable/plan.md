# Add official branding and reusable A4 invoices

## Goal
Use the supplied Breath Care Kart logo in the existing sidebar and invoice, and upgrade the current invoice preview into a professional, reusable A4 document without changing the dashboard layout or design system.

## Changes
- Store the uploaded official logo as a project asset and use the same source everywhere.
- Replace only the sidebar’s current medical icon with the logo, preserving the existing header dimensions and alignment.
- Build a reusable invoice document component for both existing and newly generated invoices.
- Keep the invoice on a white A4 sheet with the current blue brand color and include:
  - company and contact details
  - invoice number, invoice date, due date, and payment status
  - customer name, phone, and address
  - equipment, quantity, rental period, rate, and line totals
  - subtotal, discount, GST/tax, and grand total
  - notes, terms, and authorized signature
- Update the invoice preview to use this reusable document.
- Keep Print Invoice and add a working Download PDF action using the same invoice content.
- Extend invoice data only where needed so all required invoice fields render consistently.

## Technical details
- Preserve the existing dashboard shell, navigation, cards, forms, typography, spacing, and colors.
- Use print-specific A4 sizing and page-break rules; controls stay outside the printed page.
- Generate the downloadable PDF in the browser from structured invoice data, rather than taking a screenshot of the page.
- Keep existing invoice URLs and workflows intact.

## Validation
- Verify the sidebar logo in expanded and collapsed states.
- Verify an invoice at desktop and mobile widths.
- Verify print layout, PDF download, and navigation back to invoice details.
- Check for page overflow, clipped text, missing fields, and browser console errors.
