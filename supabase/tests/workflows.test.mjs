// Phase 3 workflow + security tests against the real migrations.
// Run: npm run test:db
//
// Every role (admin / telecaller / supervisor / inactive / anonymous) calls the
// same SQL the app sends through Supabase, with RLS enforced exactly as in
// production (SET ROLE authenticated + JWT subject).
import { createDb } from "./supabase-stub.mjs";

const { db } = await createDb();

const U = {
  admin: "a0000000-0000-0000-0000-000000000001",
  tele: "a0000000-0000-0000-0000-000000000002",
  sup: "a0000000-0000-0000-0000-000000000003",
  sup2: "a0000000-0000-0000-0000-000000000004",
  inactive: "a0000000-0000-0000-0000-000000000005",
};

// New auth users → profiles via trigger (role supervisor, inactive).
for (const [k, id] of Object.entries(U)) {
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
    id,
    `${k}@test.local`,
    { full_name: k === "tele" ? "Anitha" : k === "sup" ? "Ravi" : k },
  ]);
}

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + String(detail).slice(0, 140) : ""}`);
};

async function as(user, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ""}', false);`);
  await db.exec(user ? "set role authenticated" : "set role anon");
  try {
    return { rows: (await db.query(sql, params)).rows };
  } catch (e) {
    return { error: e.message, code: e.code };
  } finally {
    await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);");
  }
}
const sys = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await sys(sql, params))[0];

// ── Defaults for new accounts ─────────────────────────────────────────────
const fresh = await one(`select role, is_active, email from public.profiles where id = $1`, [U.tele]);
check("new account defaults to inactive supervisor", fresh.role === "supervisor" && fresh.is_active === false, JSON.stringify(fresh));
check("profile email filled from auth", fresh.email === "tele@test.local");

// Bootstrap like the SQL editor (no JWT).
await sys(`update public.profiles set role='admin', is_active=true where id=$1`, [U.admin]);
await sys(`update public.profiles set is_active=true where id = any($1)`, [[U.sup, U.sup2]]);

// Admin activates the telecaller through the API.
let r = await as(U.admin, `update public.profiles set role='telecaller', is_active=true where id=$1 returning role`, [U.tele]);
check("admin sets role + activates user", r.rows?.[0]?.role === "telecaller", r.error);

// ── Role security ─────────────────────────────────────────────────────────
r = await as(U.tele, `update public.profiles set role='admin' where id=$1`, [U.tele]);
check("telecaller cannot promote self", !!r.error, r.error);
r = await as(U.inactive, `update public.profiles set is_active=true where id=$1`, [U.inactive]);
check("inactive user cannot activate self", !!r.error, r.error);
r = await as(U.sup, `update public.profiles set role='telecaller' where id=$1 returning id`, [U.sup2]);
check("supervisor cannot change others' roles", !r.error && r.rows.length === 0, r.error ?? "0 rows");
r = await as(U.tele, `update public.profiles set full_name='Anitha R' where id=$1 returning full_name`, [U.tele]);
check("user can edit own name", r.rows?.[0]?.full_name === "Anitha R", r.error);
r = await as(U.sup, `select id from public.profiles`);
check("supervisor sees only own profile", r.rows?.length === 1, r.error);
r = await as(U.tele, `select id from public.profiles`);
check("telecaller sees staff list (for names/assignment)", r.rows?.length === 5, r.error);

// ── Customers ─────────────────────────────────────────────────────────────
r = await as(U.tele, `insert into public.customers (name, phone, city, address, created_by) values ('Ramesh Kumar','9845011223','Bengaluru','42 Indiranagar', $1) returning id, created_by`, [U.admin]);
const custId = r.rows?.[0]?.id;
check("telecaller creates customer", !!custId, r.error);
check("created_by forced to real user (spoof ignored)", r.rows?.[0]?.created_by === U.tele);
r = await as(U.sup, `insert into public.customers (name, phone) values ('X','9000000000')`);
check("supervisor cannot create customer", !!r.error, r.error);
r = await as(U.sup, `select id from public.customers`);
check("supervisor sees no unassigned customers", r.rows?.length === 0, r.error);
r = await as(U.inactive, `select id from public.customers`);
check("inactive user sees nothing", r.rows?.length === 0, r.error);
r = await as(null, `select id from public.customers`);
check("anonymous sees nothing", r.rows?.length === 0, r.error);
r = await as(U.tele, `update public.customers set city='Mysuru', created_by=$2 where id=$1 returning city, created_by`, [custId, U.admin]);
check("telecaller updates customer; creator immutable", r.rows?.[0]?.city === "Mysuru" && r.rows[0].created_by === U.tele, r.error);

// ── Equipment ─────────────────────────────────────────────────────────────
const bipap = (await one(`select id from public.equipment_types where name='BiPAP Machine'`)).id;
const wheel = (await one(`select id from public.equipment_types where name='Wheelchair'`)).id;
r = await as(U.tele, `insert into public.equipment_units (equipment_type_id, unit_code, brand, model, monthly_rate) values ($1,'BIP-001','Philips','A40',10000) returning id, status`, [bipap]);
const unitRent = r.rows?.[0]?.id;
check("telecaller adds rental unit", !!unitRent, r.error);
r = await as(U.tele, `insert into public.equipment_units (equipment_type_id, unit_code, available_for, sale_price) values ($1,'WC-001','sale',8500) returning id`, [wheel]);
const unitSale = r.rows?.[0]?.id;
check("telecaller adds sale unit", !!unitSale, r.error);
r = await as(U.tele, `insert into public.equipment_units (equipment_type_id, unit_code) values ($1,'BIP-002') returning id`, [bipap]);
const unit3 = r.rows?.[0]?.id;
r = await as(U.sup, `insert into public.equipment_units (equipment_type_id) values ($1)`, [bipap]);
check("supervisor cannot add equipment", !!r.error, r.error);
r = await as(U.tele, `update public.equipment_units set status='on_rent' where id=$1`, [unit3]);
check("cannot set on_rent directly (workflow only)", !!r.error, r.error);
r = await as(U.tele, `update public.equipment_units set status='maintenance' where id=$1 returning status`, [unit3]);
check("telecaller can mark maintenance", r.rows?.[0]?.status === "maintenance", r.error);

// ── Rental + invoice ──────────────────────────────────────────────────────
const rentalPayload = (unit, extra = {}) =>
  JSON.stringify({
    transaction_type: "rental",
    customer_id: custId,
    invoice_date: "2026-10-08",
    due_date: "2026-10-15",
    start_date: "2026-10-08",
    end_date: "2026-11-07",
    supervisor_id: U.sup,
    deposit_amount: 5000,
    tax_rate: 18,
    items: [{ equipment_unit_id: unit, rate: 10000, months: 1 }],
    ...extra,
  });
r = await as(U.sup, `select public.create_invoice($1::jsonb) as res`, [rentalPayload(unitRent)]);
check("supervisor cannot create invoice/rental (RPC)", r.code === "42501", r.error);
r = await as(U.tele, `select public.create_invoice($1::jsonb) as res`, [rentalPayload(unitRent)]);
const rent = r.rows?.[0]?.res;
check("telecaller creates rental invoice", !!rent?.invoice_id, r.error);
let inv = await one(`select * from public.invoices where id=$1`, [rent.invoice_id]);
check("invoice number generated", inv.invoice_number === "BCK/2026/0001", inv.invoice_number);
check("GST math: 10000 + 18% = 11800", Number(inv.subtotal) === 10000 && Number(inv.tax_amount) === 1800 && Number(inv.grand_total) === 11800,
  `${inv.subtotal}/${inv.tax_amount}/${inv.grand_total}`);
check("deposit not in invoice total", Number(inv.grand_total) === 11800);
check("invoice creator = authenticated telecaller", inv.created_by === U.tele);
check("invoice transaction_type rental + linked rental", inv.transaction_type === "rental" && inv.rental_id === rent.rental_id);
const rental = await one(`select * from public.rentals where id=$1`, [rent.rental_id]);
check("rental assigned to supervisor", rental.supervisor_id === U.sup && rental.delivery_status === "assigned" && Number(rental.deposit_amount) === 5000);
check("equipment → on_rent", (await one(`select status from public.equipment_units where id=$1`, [unitRent])).status === "on_rent");
r = await as(U.tele, `select public.create_invoice($1::jsonb) as res`, [rentalPayload(unitRent)]);
check("unavailable unit cannot be rented again", !!r.error && /not available/.test(r.error), r.error);
check("failed create left no partial rental", (await one(`select count(*)::int n from public.rentals`)).n === 1);
r = await as(U.tele, `select public.create_invoice($1::jsonb) as res`, [rentalPayload(unit3)]);
check("unit in maintenance cannot be rented", !!r.error && /not available/.test(r.error), r.error);
r = await as(U.tele, `select public.create_invoice($1::jsonb) as res`, [JSON.stringify({ transaction_type: "rental", customer_id: "00000000-0000-0000-0000-000000000000", tax_rate: 18, end_date: "2026-12-01", items: [{ equipment_unit_id: unit3, rate: 1 }] })]);
check("invoice needs an existing customer", !!r.error && /existing customer/.test(r.error), r.error);

// ── Visibility after assignment ───────────────────────────────────────────
r = await as(U.sup, `select id from public.rentals`);
check("assigned supervisor sees the rental", r.rows?.length === 1, r.error);
r = await as(U.sup, `select name, phone, address from public.customers`);
check("assigned supervisor sees that customer's contact", r.rows?.length === 1, r.error);
r = await as(U.sup2, `select id from public.rentals`);
check("other supervisor sees nothing", r.rows?.length === 0, r.error);
r = await as(U.sup, `select id from public.invoices`);
check("supervisor cannot read invoices", r.rows?.length === 0, r.error);

// ── Direct API bypass attempts ────────────────────────────────────────────
r = await as(U.tele, `insert into public.invoices (invoice_number, customer_id, due_date) values ('FAKE', $1, '2026-12-01')`, [custId]);
check("direct invoice insert rejected", !!r.error, r.error);
r = await as(U.tele, `update public.invoices set grand_total = 1 where id=$1 returning id`, [rent.invoice_id]);
check("direct invoice edit rejected", !r.error && r.rows.length === 0, r.error ?? "0 rows");
r = await as(U.tele, `insert into public.payments (invoice_id, amount) values ($1, 11800)`, [rent.invoice_id]);
check("direct payment insert rejected", !!r.error, r.error);
r = await as(U.tele, `insert into public.activity_log (entity_type, entity_id, action, actor_id) values ('x', $1, 'fake', $2)`, [custId, U.admin]);
check("activity log cannot be forged", !!r.error, r.error);
r = await as(U.tele, `select public.log_activity('x', $1, 'fake', 'fake')`, [custId]);
check("log_activity not callable over API", !!r.error, r.error);
r = await as(U.tele, `select public.next_invoice_number(current_date)`);
check("invoice counter not callable over API", !!r.error, r.error);

// ── Sale ──────────────────────────────────────────────────────────────────
const salePayload = JSON.stringify({ transaction_type: "sale", customer_id: custId, invoice_date: "2026-10-08", tax_rate: 5, delivery_charge: 500, items: [{ equipment_unit_id: unitSale, rate: 8500 }] });
r = await as(U.sup, `select public.create_invoice($1::jsonb) as res`, [salePayload]);
check("supervisor cannot create sale", r.code === "42501", r.error);
r = await as(U.tele, `select public.create_invoice($1::jsonb) as res`, [salePayload]);
const sale = r.rows?.[0]?.res;
check("telecaller creates sale invoice", !!sale?.sale_id, r.error);
inv = await one(`select * from public.invoices where id=$1`, [sale.invoice_id]);
check("sale invoice: (8500+500 delivery) + 5% = 9450", Number(inv.subtotal) === 9000 && Number(inv.tax_amount) === 450 && Number(inv.grand_total) === 9450,
  `${inv.subtotal}/${inv.tax_amount}/${inv.grand_total}`);
check("second invoice number", inv.invoice_number === "BCK/2026/0002", inv.invoice_number);
check("sold unit status → sold", (await one(`select status from public.equipment_units where id=$1`, [unitSale])).status === "sold");
check("sale row + item", (await one(`select count(*)::int n from public.sale_items where sale_id=$1`, [sale.sale_id])).n === 1);
r = await as(U.sup, `select id from public.sales`);
check("supervisor cannot read sales", r.rows?.length === 0, r.error);

// ── Payments ──────────────────────────────────────────────────────────────
r = await as(U.sup, `select public.record_payment($1, 5000, 'upi')`, [rent.invoice_id]);
check("supervisor cannot record payment", r.code === "42501", r.error);
r = await as(U.tele, `select public.record_payment($1, 5000, 'upi', '2026-10-09', 'UPI-1')`, [rent.invoice_id]);
check("telecaller records partial payment", !r.error, r.error);
inv = await one(`select amount_paid, grand_total, status from public.invoices where id=$1`, [rent.invoice_id]);
check("partial: paid 5000, outstanding 6800, not marked paid", Number(inv.amount_paid) === 5000 && Number(inv.grand_total) - Number(inv.amount_paid) === 6800 && inv.status === "pending",
  JSON.stringify(inv));
r = await as(U.tele, `select public.record_payment($1, 7000, 'cash')`, [rent.invoice_id]);
check("overpayment rejected", !!r.error && /outstanding/.test(r.error), r.error);
r = await as(U.tele, `select public.record_payment($1, 6800, 'cash')`, [rent.invoice_id]);
inv = await one(`select amount_paid, status from public.invoices where id=$1`, [rent.invoice_id]);
check("full payment → paid", !r.error && inv.status === "paid" && Number(inv.amount_paid) === 11800, r.error ?? JSON.stringify(inv));
const pay = await one(`select recorded_by from public.payments where invoice_id=$1 limit 1`, [rent.invoice_id]);
check("payment recorded_by = real user", pay.recorded_by === U.tele);

// ── Delivery ──────────────────────────────────────────────────────────────
r = await as(U.sup2, `select public.set_delivery_status($1, 'out_for_delivery')`, [rent.rental_id]);
check("unassigned supervisor cannot update delivery", r.code === "42501", r.error);
r = await as(U.sup, `select public.set_delivery_status($1, 'out_for_delivery')`, [rent.rental_id]);
check("assigned supervisor → out for delivery", !r.error, r.error);
r = await as(U.sup, `select public.set_delivery_status($1, 'delivered')`, [rent.rental_id]);
check("delivered requires a photo", !!r.error && /photo/.test(r.error), r.error);
r = await as(U.sup2, `insert into public.delivery_photos (rental_id, storage_path) values ($1, $2)`, [rent.rental_id, `${rent.rental_id}/x.jpg`]);
check("other supervisor cannot attach photo", !!r.error && /row-level security/.test(r.error), r.error);
r = await as(U.sup2, `insert into storage.objects (bucket_id, name) values ('delivery-photos', $1 || '/x.jpg')`, [rent.rental_id]);
check("other supervisor cannot upload file (storage RLS)", !!r.error, r.error);
r = await as(U.sup, `insert into storage.objects (bucket_id, name) values ('delivery-photos', $1 || '/photo.jpg') returning name`, [rent.rental_id]);
check("assigned supervisor uploads file (storage RLS)", !!r.rows?.length, r.error);
r = await as(U.sup, `insert into storage.objects (bucket_id, name) values ('delivery-photos', 'not-a-rental/photo.jpg')`);
check("upload outside a rental folder rejected", !!r.error, r.error);
r = await as(U.sup, `insert into public.delivery_photos (rental_id, storage_path, uploaded_by) values ($1, $2, $3) returning uploaded_by`, [rent.rental_id, `${rent.rental_id}/photo.jpg`, U.admin]);
check("photo metadata saved; uploaded_by forced", r.rows?.[0]?.uploaded_by === U.sup, r.error);
r = await as(U.sup, `select public.set_delivery_status($1, 'delivered', 'Installed in bedroom')`, [rent.rental_id]);
const delivered = await one(`select delivery_status, delivered_at, delivery_notes from public.rentals where id=$1`, [rent.rental_id]);
check("supervisor confirms delivery", !r.error && delivered.delivery_status === "delivered" && !!delivered.delivered_at, r.error);
r = await as(U.admin, `select name from storage.objects where bucket_id='delivery-photos'`);
check("admin can see delivery proof", r.rows?.length === 1, r.error);
r = await as(U.sup2, `select name from storage.objects`);
check("other supervisor cannot see proof", r.rows?.length === 0, r.error);
r = await as(null, `select name from storage.objects`);
check("anonymous cannot see proof", r.rows?.length === 0, r.error);

// ── Renew / return ────────────────────────────────────────────────────────
r = await as(U.tele, `select public.renew_rental($1, '2026-10-01')`, [rent.rental_id]);
check("renew must extend the end date", !!r.error, r.error);
r = await as(U.tele, `select public.renew_rental($1, '2026-12-07')`, [rent.rental_id]);
check("telecaller renews rental", !r.error && (await one(`select due_date::text d from public.rentals where id=$1`, [rent.rental_id])).d === "2026-12-07", r.error);
r = await as(U.sup, `select public.return_rental($1)`, [rent.rental_id]);
check("supervisor cannot close rental", r.code === "42501", r.error);
r = await as(U.tele, `select public.return_rental($1, '2026-12-01')`, [rent.rental_id]);
const closed = await one(`select status, returned_date::text from public.rentals where id=$1`, [rent.rental_id]);
check("return → rental completed", !r.error && closed.status === "completed", r.error ?? JSON.stringify(closed));
check("return → equipment available", (await one(`select status from public.equipment_units where id=$1`, [unitRent])).status === "available");
r = await as(U.tele, `select public.return_rental($1)`, [rent.rental_id]);
check("cannot return twice", !!r.error, r.error);

// ── Activity log ──────────────────────────────────────────────────────────
const acts = await sys(`select a.entity_type, a.action, p.full_name actor from public.activity_log a left join public.profiles p on p.id = a.actor_id order by a.created_at`);
const has = (type, action, actor) => acts.some((a) => a.entity_type === type && a.action === action && (!actor || a.actor === actor));
check("logged: customer created/updated by Anitha", has("customer", "created", "Anitha R") && has("customer", "updated", "Anitha R"));
check("logged: rental created, delivery assigned", has("rental", "created", "Anitha R") && has("rental", "delivery_assigned"));
check("logged: sale + invoices created", has("sale", "created") && has("invoice", "created", "Anitha R"));
check("logged: payment recorded", has("payment", "recorded", "Anitha R"));
check("logged: out for delivery, photo, delivered by Ravi", has("rental", "out_for_delivery", "Ravi") && has("rental", "delivery_photo_uploaded", "Ravi") && has("rental", "delivered", "Ravi"));
check("logged: renewed, returned", has("rental", "renewed") && has("rental", "returned"));
check("logged: role change", has("profile", "role_changed"));
r = await as(U.tele, `select count(*)::int n from public.activity_log where entity_type='profile'`);
check("telecaller can't read user-admin activity", r.rows?.[0]?.n === 0, r.error);
r = await as(U.admin, `select count(*)::int n from public.activity_log`);
check("admin reads full activity log", r.rows?.[0]?.n === acts.length, r.error);
r = await as(U.sup, `select count(*)::int n from public.activity_log`);
check("supervisor can't read activity log", r.rows?.[0]?.n === 0, r.error);

// ── Settings ──────────────────────────────────────────────────────────────
r = await as(U.tele, `update public.company_settings set gstin='X' returning id`);
check("telecaller cannot edit company settings", !r.error && r.rows.length === 0, r.error ?? "0 rows");
r = await as(U.admin, `update public.company_settings set invoice_prefix='INV', gstin='29AAAAA0000A1Z5' returning updated_by`);
check("admin edits settings (stamped)", r.rows?.[0]?.updated_by === U.admin, r.error);
r = await as(U.tele, `select public.create_invoice($1::jsonb) as res`, [rentalPayload(unitRent, { supervisor_id: null })]);
inv = r.rows ? await one(`select invoice_number from public.invoices where id=$1`, [r.rows[0].res.invoice_id]) : null;
check("new prefix used, counter continues", inv?.invoice_number === "INV/2026/0003", r.error ?? inv?.invoice_number);
check("rental without supervisor → pending delivery", (await one(`select delivery_status from public.rentals where id=$1`, [r.rows[0].res.rental_id])).delivery_status === "pending");
r = await as(U.tele, `select public.set_delivery_status($1, 'out_for_delivery')`, [r.rows[0].res.rental_id]);
check("can't start delivery before assignment", !!r.error && /Assign/.test(r.error), r.error);

// ── Staff account creation (database side of the create-staff-user Edge Function) ──
// The function creates the auth user (trigger adds an inactive supervisor profile), then
// sets role + activation AS THE ADMIN CALLER, so RLS, the role guard and the log apply.
const NEW1 = "b0000000-0000-0000-0000-000000000001";
const NEW2 = "b0000000-0000-0000-0000-000000000002";
const FAKE_ADMIN = "b0000000-0000-0000-0000-000000000003";
await db.query(
  `insert into auth.users (id, email, raw_user_meta_data) values
    ($1, 'new.staff@test.local', '{"full_name":"New Staff"}'),
    ($2, 'second.staff@test.local', '{"full_name":"Second"}'),
    ($3, 'fake.admin@test.local', '{"full_name":"Fake"}')`,
  [NEW1, NEW2, FAKE_ADMIN],
);
const created = await one(`select role, is_active, full_name, email from public.profiles where id=$1`, [NEW1]);
check(
  "staff create: new account starts as inactive supervisor with name and email",
  created.role === "supervisor" && created.is_active === false && created.full_name === "New Staff" && created.email === "new.staff@test.local",
  JSON.stringify(created),
);
r = await as(U.tele, `update public.profiles set role='telecaller', is_active=true where id=$1 returning id`, [NEW1]);
check("staff create: telecaller can't finish setting up an account", !!r.error || r.rows.length === 0, r.error ?? "0 rows");
r = await as(U.sup, `update public.profiles set role='telecaller', is_active=true where id=$1 returning id`, [NEW1]);
check("staff create: supervisor can't finish setting up an account", !!r.error || r.rows.length === 0, r.error ?? "0 rows");
await sys(`update public.profiles set role='admin', is_active=false where id=$1`, [FAKE_ADMIN]);
r = await as(FAKE_ADMIN, `update public.profiles set role='telecaller', is_active=true where id=$1 returning id`, [NEW1]);
check("staff create: inactive admin can't finish setting up an account", !!r.error || r.rows.length === 0, r.error ?? "0 rows");
check("staff create: account unchanged after all refused attempts", (await one(`select is_active from public.profiles where id=$1`, [NEW1])).is_active === false);
r = await as(U.admin, `update public.profiles set role='telecaller', is_active=true, full_name='New Staff' where id=$1 returning role, is_active`, [NEW1]);
check("staff create: active admin sets role + activates", r.rows?.[0]?.role === "telecaller" && r.rows?.[0]?.is_active === true, r.error);
r = await as(U.admin, `update public.profiles set role='supervisor', is_active=false where id=$1 returning role, is_active`, [NEW2]);
check("staff create: admin can create an inactive supervisor", r.rows?.[0]?.role === "supervisor" && r.rows?.[0]?.is_active === false, r.error);
const logged = await sys(`select action, actor_id from public.activity_log where entity_type='profile' and entity_id=$1`, [NEW1]);
check(
  "staff create: logged against the admin",
  logged.some((a) => a.action === "role_changed" && a.actor_id === U.admin) && logged.some((a) => a.action === "activated" && a.actor_id === U.admin),
  JSON.stringify(logged),
);
r = await as(NEW1, `select count(*)::int n from public.customers`);
check("staff create: new telecaller can read customers", !r.error && r.rows?.[0]?.n > 0, r.error ?? r.rows?.[0]?.n);
r = await as(NEW1, `select count(*)::int n from public.activity_log where entity_type='profile'`);
check("staff create: new telecaller can't read user-admin log", r.rows?.[0]?.n === 0, r.error);
r = await as(NEW2, `select count(*)::int n from public.payments`);
check("staff create: inactive new supervisor sees no payments", r.rows?.[0]?.n === 0, r.error);
r = await as(NEW1, `update public.profiles set role='admin' where id=$1`, [NEW1]);
check("staff create: new telecaller can't promote self", !!r.error, r.error);

// ── Never zero active admins (migration 20261014000000_keep_one_active_admin) ──
// Run last: it promotes and demotes admins, then restores the starting state.
//
// Layers worth knowing about when reading these tests:
//  * Deleting a profile that has activity-log history is already refused by a foreign
//    key, before our trigger runs. Our trigger is what protects a last admin with no
//    history, so those cases use a fresh admin (CLEAN).
//  * A plain TRUNCATE of profiles is refused by foreign keys from other tables; our
//    trigger is what stops TRUNCATE ... CASCADE.
//  * Multi-row statements as an API admin run into the existing role guard on the
//    second row, so those cases run without a login (as the SQL editor/CLI do).
const tryS = async (sql, params = []) => {
  try {
    await db.query(sql, params);
    return {};
  } catch (e) {
    return { error: e.message, code: e.code };
  }
};
const LAST = /At least one active admin is required/;
const activeAdmins = async () => (await one(`select count(*)::int n from public.profiles where role='admin' and is_active`)).n;
const adminRow = async (id) => one(`select role, is_active from public.profiles where id=$1`, [id]);
const stillActiveAdmin = async (id) => {
  const p = await adminRow(id);
  return p?.role === "admin" && p?.is_active === true;
};
const authUserExists = async (id) => (await one(`select count(*)::int n from auth.users where id=$1`, [id])).n === 1;
const CLEAN = "b0000000-0000-0000-0000-000000000004"; // an admin with no activity history

check("last admin: setup has exactly one active admin (plus an inactive one that must not count)", (await activeAdmins()) === 1 && (await adminRow(FAKE_ADMIN)).role === "admin");

// ── One active admin: every way of removing them is refused ──────────────
r = await as(U.admin, `update public.profiles set role='telecaller' where id=$1`, [U.admin]);
check("last admin: cannot demote (API)", LAST.test(r.error ?? "") && r.code === "P0001" && (await stillActiveAdmin(U.admin)), r.error);
r = await as(U.admin, `update public.profiles set is_active=false where id=$1`, [U.admin]);
check("last admin: cannot deactivate (API)", LAST.test(r.error ?? "") && (await stillActiveAdmin(U.admin)), r.error);
r = await tryS(`update public.profiles set role='supervisor' where id=$1`, [U.admin]);
check("last admin: cannot demote (SQL, no login)", LAST.test(r.error ?? "") && (await stillActiveAdmin(U.admin)), r.error);
r = await tryS(`update public.profiles set is_active=false where id=$1`, [U.admin]);
check("last admin: cannot deactivate (SQL, no login)", LAST.test(r.error ?? "") && (await stillActiveAdmin(U.admin)), r.error);
r = await tryS(`update public.profiles set role='telecaller', is_active=false where role='admin'`);
check("last admin: one statement removing every admin is refused", LAST.test(r.error ?? "") && (await stillActiveAdmin(U.admin)), r.error);
r = await as(U.admin, `delete from public.profiles where id=$1`, [U.admin]);
check("last admin with history: profile delete (API) is refused", !!r.error && (await stillActiveAdmin(U.admin)), r.error);
r = await tryS(`delete from auth.users where id=$1`, [U.admin]);
check("last admin with history: deleting the login (cascade) is refused, nothing removed", !!r.error && (await stillActiveAdmin(U.admin)) && (await authUserExists(U.admin)), r.error);
r = await tryS(`truncate public.profiles`);
check("profiles: plain TRUNCATE is refused", !!r.error && (await activeAdmins()) === 1, r.error);
r = await tryS(`truncate public.profiles cascade`);
check("profiles: TRUNCATE ... CASCADE is refused by the trigger", /can't be truncated/.test(r.error ?? "") && (await activeAdmins()) === 1, r.error);
r = await tryS(`truncate auth.users cascade`);
check("profiles: TRUNCATE auth.users CASCADE is refused by the trigger", /can't be truncated/.test(r.error ?? "") && (await stillActiveAdmin(U.admin)), r.error);

// Normal edits are unaffected, even for the only admin.
r = await as(U.admin, `update public.profiles set full_name='Admin One', phone='9000000000' where id=$1 returning full_name`, [U.admin]);
check("last admin: editing own name/phone still works", r.rows?.[0]?.full_name === "Admin One", r.error);

// ── Last admin with no history: delete paths reach our trigger ───────────
await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'clean.admin@test.local', '{"full_name":"Clean Admin"}')`, [CLEAN]);
await sys(`update public.profiles set role='admin', is_active=true where id=$1`, [CLEAN]);
check("clean admin: promoting a second admin works", (await activeAdmins()) === 2);
await sys(`update public.profiles set role='telecaller' where id=$1`, [U.admin]);
check("clean admin: first admin can step down while another remains", (await activeAdmins()) === 1 && (await stillActiveAdmin(CLEAN)));
r = await as(CLEAN, `delete from public.profiles where id=$1`, [CLEAN]);
check("last admin: cannot delete own profile (API)", LAST.test(r.error ?? "") && (await stillActiveAdmin(CLEAN)), r.error);
r = await tryS(`delete from public.profiles where id=$1`, [CLEAN]);
check("last admin: cannot delete profile (SQL)", LAST.test(r.error ?? "") && (await stillActiveAdmin(CLEAN)), r.error);
r = await tryS(`delete from auth.users where id=$1`, [CLEAN]);
check(
  "last admin: deleting the login (cascade) is refused by the trigger, nothing removed",
  LAST.test(r.error ?? "") && (await stillActiveAdmin(CLEAN)) && (await authUserExists(CLEAN)),
  r.error,
);
r = await tryS(`delete from public.profiles where role='admin'`);
check("last admin: deleting every admin profile in one statement is refused", LAST.test(r.error ?? "") && (await activeAdmins()) === 1, r.error);

// ── Two active admins ────────────────────────────────────────────────────
await sys(`update public.profiles set role='admin' where id=$1`, [U.admin]);
check("two admins: restored", (await activeAdmins()) === 2);
r = await tryS(`update public.profiles set role='telecaller' where id = any($1)`, [[U.admin, CLEAN]]);
check("two admins: demoting both in one statement is refused", LAST.test(r.error ?? "") && (await activeAdmins()) === 2, r.error);
r = await tryS(`update public.profiles set is_active=false where id = any($1)`, [[U.admin, CLEAN]]);
check("two admins: deactivating both in one statement is refused", LAST.test(r.error ?? "") && (await activeAdmins()) === 2, r.error);
r = await tryS(`update public.profiles set role = case when id=$1 then 'telecaller' else 'supervisor' end, is_active = (id=$1) where id = any($2)`, [U.admin, [U.admin, CLEAN]]);
check("two admins: demoting one and deactivating the other in one statement is refused", LAST.test(r.error ?? "") && (await activeAdmins()) === 2, r.error);
r = await as(U.admin, `update public.profiles set role='telecaller' where id=$1 returning role`, [CLEAN]);
check("two admins: one admin can demote the other (API)", r.rows?.[0]?.role === "telecaller" && (await activeAdmins()) === 1, r.error);
r = await as(U.admin, `update public.profiles set role='supervisor' where id=$1`, [U.admin]);
check("two admins: and is then protected as the last one", LAST.test(r.error ?? "") && (await stillActiveAdmin(U.admin)), r.error);

// Swapping admins in one statement is judged on the end result.
r = await tryS(`update public.profiles set role = case when id=$1 then 'telecaller' else 'admin' end where id = any($2)`, [U.admin, [U.admin, CLEAN]]);
check("swap: handing adminship over in one statement works", !r.error && (await adminRow(U.admin)).role === "telecaller" && (await stillActiveAdmin(CLEAN)) && (await activeAdmins()) === 1, r.error);
r = await tryS(`update public.profiles set role = case when id=$1 then 'telecaller' else 'admin' end where id = any($2)`, [CLEAN, [U.admin, CLEAN]]);
check("swap: and back again", !r.error && (await stillActiveAdmin(U.admin)) && (await adminRow(CLEAN)).role === "telecaller", r.error);

// Promotion order that the screen uses: promote first, then step down.
r = await as(U.admin, `update public.profiles set role='admin' where id=$1 returning role`, [CLEAN]);
check("handover: promote the new admin first", r.rows?.[0]?.role === "admin" && (await activeAdmins()) === 2, r.error);
r = await as(U.admin, `update public.profiles set is_active=false where id=$1 returning is_active`, [U.admin]);
check("handover: original admin can then be deactivated", r.rows?.[0]?.is_active === false && (await stillActiveAdmin(CLEAN)), r.error);
r = await as(CLEAN, `update public.profiles set is_active=false where id=$1`, [CLEAN]);
check("handover: and the new admin cannot deactivate themselves", LAST.test(r.error ?? "") && (await stillActiveAdmin(CLEAN)), r.error);
r = await as(CLEAN, `update public.profiles set is_active=true where id=$1 returning is_active`, [U.admin]);
check("handover: reactivating the original is allowed", r.rows?.[0]?.is_active === true && (await activeAdmins()) === 2, r.error);

// ── Inactive admins don't count, and changing them is not blocked ────────
check("inactive admin: not counted as an active admin", (await adminRow(FAKE_ADMIN)).is_active === false && (await activeAdmins()) === 2);
r = await as(U.admin, `update public.profiles set role='supervisor' where id=$1 returning role`, [FAKE_ADMIN]);
check("inactive admin: can be changed freely", r.rows?.[0]?.role === "supervisor", r.error);
await sys(`update public.profiles set role='admin' where id=$1`, [FAKE_ADMIN]);

// ── Things that must keep working ────────────────────────────────────────
r = await tryS(`delete from auth.users where id=$1`, [NEW2]);
check("clean-up: deleting a non-admin login still works (staff-creation rollback)", !r.error && !(await adminRow(NEW2)), r.error);
r = await as(U.admin, `update public.profiles set role='supervisor' where id=$1 returning role`, [U.tele]);
check("clean-up: ordinary role changes by the admin still work", r.rows?.[0]?.role === "supervisor", r.error);
await as(U.admin, `update public.profiles set role='telecaller' where id=$1`, [U.tele]);
r = await as(U.admin, `update public.profiles set role='telecaller' where id=$1`, [CLEAN]);
check("final state: back to exactly one active admin", !r.error && (await activeAdmins()) === 1 && (await stillActiveAdmin(U.admin)), r.error);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
