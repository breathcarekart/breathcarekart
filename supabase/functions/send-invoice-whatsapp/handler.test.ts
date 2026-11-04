/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ProviderResult } from "./aisensy.ts";
import {
  handleSendInvoiceWhatsApp,
  type ClaimResult,
  type Deps,
  type HandlerRequest,
  type LoadedInvoice,
  type LoadedRental,
  type LogInsert,
  type LogPatch,
  type SendConfig,
} from "./handler.ts";

const INVOICE_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN = { id: "admin-1" };
const PDF = new TextEncoder().encode("%PDF-1.3\n" + "x".repeat(200));

const invoice = (over: Partial<LoadedInvoice> = {}): LoadedInvoice => ({
  id: INVOICE_ID,
  invoice_number: "BCK/2026/0001",
  invoice_date: "2026-11-03",
  due_date: "2026-11-10",
  period_start: "2026-11-03",
  period_end: "2026-12-02",
  transaction_type: "rental",
  subtotal: "12500.00",
  discount: "0",
  tax_rate: "18",
  tax_amount: "2250.00",
  grand_total: "14750.00",
  amount_paid: "0",
  status: "pending",
  notes: null,
  customer_id: "cust-1",
  customer: {
    id: "cust-1",
    name: "Test Customer",
    phone: "98450 11223",
    whatsapp: null,
    address: "Street",
    city: "City",
  },
  items: [
    {
      description: "Oxygen Concentrator (5L)",
      rental_period: "Nov",
      quantity: 1,
      rate: "12500",
      amount: "12500",
      created_at: "2026-11-03T10:00:00Z",
    },
  ],
  ...over,
});

const RENTAL_ID = "22222222-2222-4222-8222-222222222222";

const rental = (over: Partial<LoadedRental> = {}): LoadedRental => ({
  id: RENTAL_ID,
  rental_number: "RNT-0042",
  status: "active",
  start_date: "2026-11-03",
  due_date: "2026-12-02",
  returned_date: null,
  customer_id: "cust-1",
  customer: {
    id: "cust-1",
    name: "Test Customer",
    phone: "98450 11223",
    whatsapp: null,
    address: "Street",
    city: "City",
  },
  items: [
    {
      description: null,
      type_name: "Oxygen Concentrator (5L)",
      quantity: 1,
      rate: "3500",
      created_at: "2026-11-03T10:00:00Z",
    },
  ],
  invoice: { invoice_date: "2026-11-02", grand_total: "4130.00" },
  ...over,
});

const baseConfig: SendConfig = {
  apiKeyConfigured: true,
  testDestination: "+91 90000 00001",
  liveEnabled: false,
  signedUrlSeconds: 86400,
  staleAfterMinutes: 10,
};

type Calls = {
  claims: LogInsert[];
  inserts: LogInsert[];
  updates: { id: string; patch: LogPatch }[];
  uploads: string[];
  signed: { path: string; seconds: number; bucket: string }[];
  sends: unknown[];
  checks: { url: string; kind: string }[];
  activity: { action: string; entityType: string; entityId: string }[];
  expired: number;
};

function setup(
  over: Partial<Deps> = {},
  opts: {
    invoice?: LoadedInvoice | null;
    rental?: LoadedRental | null;
    settings?: Record<string, unknown>;
    provider?: ProviderResult;
    role?: string;
    active?: boolean;
  } = {},
) {
  const calls: Calls = {
    claims: [],
    inserts: [],
    updates: [],
    uploads: [],
    signed: [],
    sends: [],
    checks: [],
    activity: [],
    expired: 0,
  };
  const deps: Deps = {
    authenticate: async (t) => (t === "good" ? ADMIN : null),
    callerProfile: async () => ({ role: opts.role ?? "admin", is_active: opts.active ?? true }),
    loadInvoice: async (id) =>
      id === INVOICE_ID ? (opts.invoice === undefined ? invoice() : opts.invoice) : null,
    loadRental: async (id) =>
      id === RENTAL_ID ? (opts.rental === undefined ? rental() : opts.rental) : null,
    loadSettings: async () => ({
      company_name: "Breath Care Kart",
      address: null,
      phone: null,
      email: null,
      gstin: null,
      invoice_terms: null,
      upi_id: "owner-1@okbank",
      payment_qr_path: "payment-qr/abc123.jpg",
      ...opts.settings,
    }),
    priorSuccess: async () => false,
    expireStale: async () => {
      calls.expired++;
    },
    claimSend: async (row): Promise<ClaimResult> => {
      calls.claims.push(row);
      return { ok: true, id: `msg-${calls.claims.length}` };
    },
    insertLog: async (row) => {
      calls.inserts.push(row);
      return { id: "log-dry" };
    },
    updateLog: async (id, patch) => {
      calls.updates.push({ id, patch });
    },
    renderPdf: async () => PDF,
    uploadPdf: async (path) => {
      calls.uploads.push(path);
      return true;
    },
    signUrl: async (bucket, path, seconds) => {
      calls.signed.push({ path, seconds, bucket });
      return `https://proj.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=SIGNEDTOKEN`;
    },
    checkMediaUrl: async (url, kind) => {
      calls.checks.push({ url, kind });
      return true;
    },
    sendCampaign: async (payload) => {
      calls.sends.push(payload);
      return opts.provider ?? { kind: "accepted", httpStatus: 200, response: { success: "true" } };
    },
    logActivity: async (e) => {
      calls.activity.push({ action: e.action, entityType: e.entityType, entityId: e.entityId });
    },
    randomId: () => "rand-uuid",
    now: () => new Date("2026-11-03T06:00:00Z"),
    ...over,
  };
  const run = (
    body: Record<string, unknown>,
    config: Partial<SendConfig> = {},
    req: Partial<HandlerRequest> = {},
  ) =>
    handleSendInvoiceWhatsApp(
      {
        method: "POST",
        authorization: "Bearer good",
        body:
          typeof body["template"] === "string" &&
          String(body["template"]).startsWith("r") &&
          body["template"] !== "invoice_send"
            ? { rental_id: RENTAL_ID, ...body }
            : { invoice_id: INVOICE_ID, ...body },
        ...req,
      },
      deps,
      { ...baseConfig, ...config },
    );
  return { run, calls };
}

const code = (r: { body: Record<string, unknown> }) =>
  (r.body["error"] as { code: string } | undefined)?.code;

// ── Authorisation ──────────────────────────────────────────────────────────
test("admin and telecaller may send (dry run)", async () => {
  for (const role of ["admin", "telecaller"]) {
    const { run } = setup({}, { role });
    const r = await run({ mode: "dry_run" });
    assert.equal(r.status, 200, role);
    assert.equal(r.body["status"], "dry_run");
  }
});

test("supervisor, inactive users and unknown roles are refused before anything else happens", async () => {
  for (const [role, active] of [
    ["supervisor", true],
    ["admin", false],
    ["telecaller", false],
    ["", true],
  ] as const) {
    const { run, calls } = setup({}, { role, active });
    const r = await run({ mode: "dry_run" });
    assert.equal(r.status, 403, `${role}/${active}`);
    assert.equal(code(r), "forbidden");
    assert.equal(calls.uploads.length + calls.inserts.length + calls.claims.length, 0);
  }
});

test("missing or bad sessions are refused", async () => {
  const { run } = setup();
  for (const authorization of [null, "", "Bearer ", "Basic x", "Bearer stolen"]) {
    assert.equal(
      (await run({ mode: "dry_run" }, {}, { authorization })).status,
      401,
      String(authorization),
    );
  }
  assert.equal((await run({ mode: "dry_run" }, {}, { method: "GET" })).status, 405);
});

// ── Input and invoice data ─────────────────────────────────────────────────
test("invalid input: bad invoice id, unknown mode, unknown action", async () => {
  const { run } = setup();
  assert.equal(code(await run({ invoice_id: "nope", mode: "dry_run" })), "invalid_input");
  assert.equal(code(await run({ mode: "broadcast" })), "invalid_mode");
  assert.equal(code(await run({ mode: "dry_run", action: "delete" })), "invalid_input");
});

test("missing invoice, draft/cancelled invoice and missing customer are refused", async () => {
  assert.equal(
    code(await setup({}, { invoice: null }).run({ mode: "dry_run" })),
    "invoice_not_found",
  );
  assert.equal(
    code(
      await setup().run({ invoice_id: "22222222-2222-4222-8222-222222222222", mode: "dry_run" }),
    ),
    "invoice_not_found",
  );
  assert.equal(
    code(await setup({}, { invoice: invoice({ status: "draft" }) }).run({ mode: "dry_run" })),
    "invoice_not_sendable",
  );
  assert.equal(
    code(await setup({}, { invoice: invoice({ status: "cancelled" }) }).run({ mode: "dry_run" })),
    "invoice_not_sendable",
  );
  assert.equal(
    code(await setup({}, { invoice: invoice({ customer: null }) }).run({ mode: "dry_run" })),
    "customer_missing",
  );
});

test("missing and invalid customer numbers are refused; WhatsApp number wins over phone", async () => {
  const noPhone = invoice({ customer: { ...invoice().customer!, phone: null, whatsapp: null } });
  assert.equal(
    code(await setup({}, { invoice: noPhone }).run({ mode: "dry_run" })),
    "missing_phone",
  );
  const bad = invoice({ customer: { ...invoice().customer!, phone: "12345", whatsapp: null } });
  assert.equal(code(await setup({}, { invoice: bad }).run({ mode: "dry_run" })), "invalid_phone");
  const both = invoice({
    customer: { ...invoice().customer!, phone: "98450 11223", whatsapp: "91234 56789" },
  });
  const { run, calls } = setup({}, { invoice: both });
  await run({ mode: "dry_run" });
  assert.equal(calls.inserts[0]!.destination, "+919123456789");
});

test("invoice without items can't produce valid template parameters", async () => {
  const r = await setup({}, { invoice: invoice({ items: [] }) }).run({ mode: "dry_run" });
  assert.equal(r.status, 422);
  assert.equal(code(r), "invalid_template_params");
});

test("values sent by the browser are ignored; everything comes from the database", async () => {
  const { run, calls } = setup();
  const r = await run({
    mode: "dry_run",
    customer_name: "Hacker",
    phone: "+919999999999",
    grand_total: 1,
    template_params: ["x"],
  });
  assert.equal(r.status, 200);
  assert.deepEqual(calls.inserts[0]!.template_params, [
    "Test Customer",
    "BCK/2026/0001",
    "03 Nov 2026",
    "Oxygen Concentrator (5L)",
    "14,750.00",
  ]);
  assert.equal(calls.inserts[0]!.destination, "+919845011223");
});

// ── Dry run ────────────────────────────────────────────────────────────────
test("dry run: PDF generated, stored privately, link checked, logged as dry_run, AiSensy never called", async () => {
  const { run, calls } = setup();
  const r = await run({ mode: "dry_run" });
  assert.equal(r.status, 200);
  assert.equal(calls.sends.length, 0);
  assert.equal(calls.claims.length, 0);
  assert.deepEqual(calls.uploads, [`${INVOICE_ID}/rand-uuid.pdf`]);
  assert.deepEqual(calls.signed, [
    { path: `${INVOICE_ID}/rand-uuid.pdf`, seconds: 86400, bucket: "invoice-pdfs" },
  ]);
  assert.deepEqual(
    calls.checks.map((c) => c.kind),
    ["pdf"],
  );
  const row = calls.inserts[0]!;
  assert.equal(row.mode, "dry_run");
  assert.equal(row.status, "dry_run");
  assert.equal(row.media_path, `${INVOICE_ID}/rand-uuid.pdf`);
  assert.equal(row.media_filename, "BCK-2026-0001.pdf");
  assert.equal(row.requested_by, "admin-1");
  assert.deepEqual(
    calls.activity.map((a) => a.action),
    ["whatsapp_dry_run"],
  );
  const shown = JSON.stringify(r.body["payload"]);
  assert.ok(!shown.includes("SIGNEDTOKEN") && !shown.includes("apiKey"), shown);
  assert.equal(r.body["mapping_verified"], true);
});

test("dry run needs no API key", async () => {
  const r = await setup().run({ mode: "dry_run" }, { apiKeyConfigured: false });
  assert.equal(r.status, 200);
});

// ── Test mode ──────────────────────────────────────────────────────────────
test("test mode sends ONLY to the internal test number, never the customer", async () => {
  const { run, calls } = setup();
  const r = await run({ mode: "test" });
  assert.equal(r.status, 200);
  assert.equal(r.body["status"], "accepted");
  const sent = calls.sends[0] as { destination: string };
  assert.equal(sent.destination, "+919000000001");
  assert.equal(calls.claims[0]!.destination, "+919000000001");
  assert.notEqual(sent.destination, "+919845011223");
  assert.equal(calls.updates.at(-1)!.patch.status, "sent");
});

test("test mode refuses to run without a valid test number or API key", async () => {
  assert.equal(
    code(await setup().run({ mode: "test" }, { testDestination: null })),
    "test_not_configured",
  );
  assert.equal(
    code(await setup().run({ mode: "test" }, { testDestination: "12345" })),
    "test_not_configured",
  );
  assert.equal(
    code(await setup().run({ mode: "test" }, { apiKeyConfigured: false })),
    "not_configured",
  );
});

// ── Live mode ──────────────────────────────────────────────────────────────
test("live mode is off unless the server switch is on; then it sends to the customer's number", async () => {
  const off = setup();
  const r1 = await off.run({ mode: "live" });
  assert.equal(r1.status, 403);
  assert.equal(code(r1), "live_disabled");
  assert.equal(off.calls.sends.length + off.calls.claims.length + off.calls.uploads.length, 0);

  const on = setup();
  const r2 = await on.run({ mode: "live" }, { liveEnabled: true });
  assert.equal(r2.status, 200);
  assert.equal(r2.body["status"], "accepted");
  assert.equal(on.calls.claims[0]!.mode, "live");
  assert.equal(on.calls.claims[0]!.destination, "+919845011223");
  assert.equal((on.calls.sends[0] as { destination: string }).destination, "+919845011223");

  // Without an API key nothing can go out, even with the switch on.
  const noKey = setup();
  const r3 = await noKey.run({ mode: "live" }, { liveEnabled: true, apiKeyConfigured: false });
  assert.equal(code(r3), "not_configured");
  assert.equal(noKey.calls.sends.length, 0);
});

// ── Duplicates and resends ─────────────────────────────────────────────────
test("a send already in progress is refused (database unique rule)", async () => {
  const { run, calls } = setup({ claimSend: async () => ({ ok: false, reason: "in_progress" }) });
  const r = await run({ mode: "test" });
  assert.equal(r.status, 409);
  assert.equal(code(r), "send_in_progress");
  assert.equal(calls.uploads.length + calls.sends.length, 0);
});

test("after a success, a new send needs explicit confirmation; confirmation is passed to the database", async () => {
  const { run, calls } = setup({
    claimSend: async (row) => {
      calls.claims.push(row);
      return row.is_resend ? { ok: true, id: "msg-resend" } : { ok: false, reason: "already_sent" };
    },
  });
  const refused = await run({ mode: "test" });
  assert.equal(refused.status, 409);
  assert.equal(code(refused), "already_sent");
  assert.equal(refused.body["requires_confirmation"], true);
  for (const notTrue of ["true", 1, "yes"]) {
    assert.equal(
      code(await run({ mode: "test", confirm_resend: notTrue })),
      "already_sent",
      String(notTrue),
    );
  }
  const ok = await run({ mode: "test", confirm_resend: true });
  assert.equal(ok.status, 200);
  assert.equal(calls.claims.at(-1)!.is_resend, true);
});

test("stale 'sending' rows are expired before claiming", async () => {
  let olderThan: Date | null = null;
  const { run } = setup({
    expireStale: async (_i, _c, d) => {
      olderThan = d;
    },
  });
  await run({ mode: "test" });
  assert.equal((olderThan as Date | null)?.toISOString(), "2026-11-03T05:50:00.000Z");
});

test("dry runs never claim (they can't block or be blocked)", async () => {
  const { run, calls } = setup({ claimSend: async () => ({ ok: false, reason: "already_sent" }) });
  assert.equal((await run({ mode: "dry_run" })).status, 200);
  assert.equal(calls.claims.length, 0);
});

// ── Provider outcomes ──────────────────────────────────────────────────────
test("provider acceptance is recorded as sent but described as acceptance, not delivery", async () => {
  const { run, calls } = setup();
  const r = await run({ mode: "test" });
  assert.match(String(r.body["note"]), /not a delivery confirmation/);
  const done = calls.updates.at(-1)!.patch;
  assert.equal(done.status, "sent");
  assert.equal(done.provider_http_status, 200);
  assert.equal(done.media_path, `${INVOICE_ID}/rand-uuid.pdf`);
  assert.deepEqual(
    calls.activity.map((a) => a.action),
    ["whatsapp_sent"],
  );
});

test("provider rejection, timeout and network failure are recorded as failed", async () => {
  const cases: [ProviderResult, number, string][] = [
    [{ kind: "rejected", httpStatus: 400, response: { message: "bad" } }, 502, "provider_rejected"],
    [{ kind: "timeout" }, 504, "provider_timeout"],
    [{ kind: "network_error" }, 502, "provider_unreachable"],
  ];
  for (const [provider, http, expected] of cases) {
    const { run, calls } = setup({}, { provider });
    const r = await run({ mode: "test" });
    assert.equal(r.status, http, expected);
    assert.equal(code(r), expected);
    assert.equal(calls.updates.at(-1)!.patch.status, "failed");
    assert.ok(calls.updates.at(-1)!.patch.error_message);
    assert.deepEqual(
      calls.activity.map((a) => a.action),
      ["whatsapp_failed"],
    );
    assert.ok(
      !JSON.stringify(r.body).includes("bad"),
      "raw provider reply must not reach the browser",
    );
  }
});

test("PDF, storage, signed-URL and link-check failures stop the send and are logged", async () => {
  const cases: [Partial<Deps>, string][] = [
    [
      {
        renderPdf: async () => {
          throw new Error("boom");
        },
      },
      "pdf_failed",
    ],
    [
      {
        renderPdf: async () =>
          new TextEncoder().encode("not a pdf at all, definitely not ".repeat(5)),
      },
      "pdf_failed",
    ],
    [{ uploadPdf: async () => false }, "storage_failed"],
    [{ signUrl: async () => null }, "signed_url_failed"],
    [{ checkMediaUrl: async () => false }, "media_link_unreachable"],
  ];
  for (const [over, expected] of cases) {
    const { run, calls } = setup(over);
    const r = await run({ mode: "test" });
    assert.equal(code(r), expected);
    assert.equal(calls.sends.length, 0, `${expected}: AiSensy must not be called`);
    assert.equal(calls.updates.at(-1)!.patch.status, "failed", expected);
  }
});

test("an unexpected error never leaves a row stuck in 'sending'", async () => {
  const { run, calls } = setup({
    sendCampaign: async () => {
      throw new Error("crash");
    },
  });
  const r = await run({ mode: "test" });
  assert.equal(r.status, 500);
  assert.equal(calls.updates.at(-1)!.patch.status, "failed");
});

// ── Preview ────────────────────────────────────────────────────────────────
test("preview shows the values and availability without writing, rendering or sending anything", async () => {
  const { run, calls } = setup({ priorSuccess: async (_key, _campaign, mode) => mode === "test" });
  const r = await run({ action: "preview", mode: "live" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body["template_params"], [
    "Test Customer",
    "BCK/2026/0001",
    "03 Nov 2026",
    "Oxygen Concentrator (5L)",
    "14,750.00",
  ]);
  assert.deepEqual(r.body["modes"], { dry_run: true, test: true, live: false });
  assert.deepEqual(r.body["already_sent"], { live: false, test: true });
  assert.equal((r.body["recipient"] as { phone_masked: string }).phone_masked, "+91 ******1223");
  assert.equal(
    calls.inserts.length + calls.claims.length + calls.uploads.length + calls.sends.length,
    0,
  );
});

// ── payment_request ────────────────────────────────────────────────────────
test("payment_request: pending amount, due date and UPI ID in placeholder order, QR image attached", async () => {
  const { run, calls } = setup({}, { invoice: invoice({ amount_paid: "4750.00" }) });
  const r = await run({ template: "payment_request", mode: "test" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const sent = calls.sends[0] as {
    campaignName: string;
    templateParams: string[];
    media: { url: string; filename: string };
  };
  assert.equal(sent.campaignName, "payment_request");
  assert.deepEqual(sent.templateParams, [
    "Test Customer",
    "BCK/2026/0001",
    "10,000.00",
    "10 Nov 2026",
    "owner-1@okbank",
  ]);
  assert.equal(sent.media.filename, "payment-qr.jpg");
  assert.deepEqual(
    calls.signed.map((x) => [x.bucket, x.path]),
    [["business-assets", "payment-qr/abc123.jpg"]],
  );
  assert.deepEqual(
    calls.checks.map((c) => c.kind),
    ["image"],
  );
  assert.equal(calls.uploads.length, 0, "no invoice PDF is generated for a payment request");
  assert.equal(calls.claims[0]!.campaign_name, "payment_request");
  assert.equal(calls.claims[0]!.invoice_id, INVOICE_ID);
  assert.equal(calls.claims[0]!.rental_id, null);
});

test("payment_request is refused when nothing is due or the payment details are missing", async () => {
  const paid = setup({}, { invoice: invoice({ amount_paid: "14750.00" }) });
  assert.equal(code(await paid.run({ template: "payment_request", mode: "test" })), "nothing_due");
  for (const settings of [{ upi_id: null }, { upi_id: "not a upi" }, { payment_qr_path: null }]) {
    const s = setup({}, { settings });
    const r = await s.run({ template: "payment_request", mode: "test" });
    assert.equal(code(r), "payment_details_missing", JSON.stringify(settings));
    assert.equal(s.calls.sends.length + s.calls.claims.length, 0);
  }
});

// ── rental templates ───────────────────────────────────────────────────────
test("rental_booking_confirmation: six values from the rental and its invoice, no attachment", async () => {
  const { run, calls } = setup();
  const r = await run({ template: "rental_booking_confirmation", mode: "test" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const sent = calls.sends[0] as {
    campaignName: string;
    templateParams: string[];
    media?: unknown;
  };
  assert.equal(sent.campaignName, "rental_booking_confirmation");
  assert.deepEqual(sent.templateParams, [
    "Test Customer",
    "Oxygen Concentrator (5L)",
    "02 Nov 2026",
    "03 Nov 2026",
    "02 Dec 2026",
    "4,130.00",
  ]);
  assert.equal(sent.media, undefined);
  assert.equal(calls.signed.length + calls.uploads.length + calls.checks.length, 0);
  assert.equal(calls.claims[0]!.rental_id, RENTAL_ID);
  assert.equal(calls.claims[0]!.invoice_id, null);
  assert.deepEqual(
    calls.activity.map((a) => a.entityType),
    ["rental"],
  );
});

test("a register rental without an invoice uses the item rates and the start date", async () => {
  const { run, calls } = setup({}, { rental: rental({ invoice: null }) });
  const r = await run({ template: "rental_booking_confirmation", mode: "dry_run" });
  assert.equal(r.status, 200);
  const params = calls.inserts[0]!.template_params;
  assert.equal(params[2], "03 Nov 2026");
  assert.equal(params[5], "3,500.00");
});

test("return_or_renew_reminder: three values; refused for returned or cancelled rentals", async () => {
  const { run, calls } = setup();
  const r = await run({ template: "return_or_renew_reminder", mode: "test" });
  assert.equal(r.status, 200);
  assert.deepEqual((calls.sends[0] as { templateParams: string[] }).templateParams, [
    "Test Customer",
    "Oxygen Concentrator (5L)",
    "02 Dec 2026",
  ]);
  for (const status of ["returned", "cancelled"]) {
    const s = setup({}, { rental: rental({ status }) });
    const res = await s.run({ template: "return_or_renew_reminder", mode: "test" });
    assert.equal(code(res), "rental_closed", status);
    assert.equal(s.calls.sends.length, 0);
  }
});

test("unknown templates and the wrong kind of record are refused", async () => {
  const { run } = setup();
  assert.equal(
    code(await run({ template: "marketing_blast", mode: "dry_run" })),
    "invalid_template",
  );
  // A rental template needs a rental id; a missing or invoice-style body is refused.
  const r = await run({ template: "return_or_renew_reminder", rental_id: "", mode: "dry_run" });
  assert.equal(code(r), "invalid_input");
});

test("browser-supplied values are ignored for rental templates too", async () => {
  const { run, calls } = setup();
  await run({
    template: "rental_booking_confirmation",
    mode: "test",
    customer_name: "Someone Else",
    destination: "+919999999999",
    rental_amount: "1",
  });
  const sent = calls.sends[0] as { destination: string; templateParams: string[] };
  assert.equal(sent.destination, "+919000000001");
  assert.ok(!sent.templateParams.includes("Someone Else") && !sent.templateParams.includes("1"));
});
