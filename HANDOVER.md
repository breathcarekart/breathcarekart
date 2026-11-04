# Breath Care Kart — Handover

Internal operations app for Breath Care Kart: equipment inventory, customers, rentals and
deliveries, sales, invoices and payments.

- **Business owner / primary admin:** Harinath Neelam
- **Official business email:** breathcarekart@gmail.com
- **GSTIN/UIN (client-provided):** 36AALCG1309A1Z4

The email, GSTIN and signatory are stored in Settings (not in the code) and are set initially by
migration `20261104000100_initial_business_details.sql`. An admin can change them any time in
Settings → Business & GST.

## Who can do what

| Role       | Access                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------- |
| Admin      | Everything, including Users & Roles, Activity Log and **Settings** (business and GST details) |
| Telecaller | Customers, inventory, rentals, sales, invoices, payments, reports                             |
| Supervisor | Rentals assigned to them, delivery status and delivery photos                                 |

Access is enforced by the database (row-level security), not only by the screens.

## First steps for the admin

1. **Profile → your name.** Set your display name (for example "Harinath Neelam"). The dashboard
   greeting and "Created by" on invoices use each person's own profile name.
2. **Settings → Business & GST** (admins only):
   - **Business name, email, phone, address**: printed on every invoice and PDF.
   - **Authorised signatory**: optional; printed under "Authorized Signature" on invoices.
   - **GST registration status**:
     - _Registered_: enter the 15-character **GSTIN**. Invoices are titled "Tax invoice" and show
       the GSTIN.
     - _Not registered_: no GSTIN is needed or stored. Invoices are titled "Invoice".
   - The app checks the GSTIN's format and check character to catch typing mistakes. That is
     **not** a confirmation of registration — verify it on the GST portal.
   - **Default GST rate**: optional; pre-selected on new invoices. Staff can still change the rate
     on each invoice. Confirm rates with your accountant (they depend on each item's HSN code).
   - **Invoice prefix and terms**: numbering (e.g. BCK/2026/0001) and the terms printed on invoices.
3. **Users & Roles**: add staff accounts and choose their role.

Changing Settings affects invoices **from then on** in previews and PDFs. Each invoice keeps the
tax rate and amounts it was created with; old financial records are never recalculated.

## Running the app locally

```bash
npm install
npm run dev
```

Opens on http://localhost:8080. Needs a `.env.local` (see `.env.example`):

| Variable                 | Purpose                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Supabase project URL (public)                                       |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (public; access is limited by row-level security) |
| `VITE_WHATSAPP_ENABLED`  | `false` until WhatsApp sending is approved and deployed             |

Never put secret keys (service role, AiSensy API key) in `.env` files or the browser. Server-side
secrets live only in Supabase Edge Function secrets.

Checks: `npm run test:unit`, `npm run test:db`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Deploying changes (in this order)

1. Back up the production database.
2. Apply new migrations in `supabase/migrations/` (after review and approval).
3. Deploy any changed Edge Functions.
4. Deploy the web app.

The web app expects the database changes from step 2; deploying it first will make saving
Settings fail until the migration is applied.

## WhatsApp invoices

Built but **not live**. Sending runs only through the `send-invoice-whatsapp` Edge Function
(AiSensy). It stays switched off until the template mapping is verified, secrets are set, the
function is deployed and live sending is explicitly approved.
