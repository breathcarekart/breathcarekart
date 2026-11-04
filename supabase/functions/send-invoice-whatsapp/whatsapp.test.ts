/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { postCampaign } from "./aisensy.ts";
import {
  AISENSY_ENDPOINT,
  buildCampaignPayload,
  buildTemplateParams,
  describeItems,
  formatTemplateAmount,
  formatTemplateDate,
  INVOICE_SEND_TEMPLATE,
  maskPhone,
  normalizeIndianMobile,
  redactSignedUrl,
  sanitizeProviderResponse,
  sanitizeTemplateValue,
} from "./whatsapp.ts";

// ── Phone numbers ──────────────────────────────────────────────────────────
test("Indian mobile numbers normalise to +91XXXXXXXXXX", () => {
  for (const raw of [
    "9845011223",
    "98450 11223",
    "098450 11223",
    "919845011223",
    "+91 98450-11223",
    "+919845011223",
  ]) {
    assert.deepEqual(normalizeIndianMobile(raw), { ok: true, e164: "+919845011223" }, raw);
  }
});

test("missing and invalid numbers are refused", () => {
  assert.deepEqual(normalizeIndianMobile(null), { ok: false, reason: "missing" });
  assert.deepEqual(normalizeIndianMobile("   "), { ok: false, reason: "missing" });
  // Landlines with a short local number (e.g. 080 2345 678) are refused. Note: an 11-digit
  // "0" + 10-digit landline such as 080 2345 6789 is indistinguishable from a mobile written
  // with a leading 0 ("098450 11223"), so it is accepted; AiSensy/WhatsApp then rejects it.
  for (const raw of [
    "12345",
    "5845011223",
    "080 2345 678",
    "0124 234 567",
    "+1 415 555 0100",
    "+44 7700 900123",
    "98450112234",
    "abc",
  ]) {
    assert.equal(normalizeIndianMobile(raw).ok, false, raw);
  }
});

test("phone numbers are masked for display", () => {
  assert.equal(maskPhone("+919845011223"), "+91 ******1223");
});

// ── Template values ────────────────────────────────────────────────────────
test("dates use the approved style 03 Nov 2026, never locale-dependent", () => {
  assert.equal(formatTemplateDate("2026-11-03"), "03 Nov 2026");
  assert.equal(formatTemplateDate("2026-09-15"), "15 Sep 2026");
  assert.throws(() => formatTemplateDate("03/11/2026"));
});

test("amounts are 2-decimal Indian format without the rupee symbol", () => {
  assert.equal(formatTemplateAmount(14750), "14,750.00");
  assert.equal(formatTemplateAmount("114750.5"), "1,14,750.50");
  assert.equal(formatTemplateAmount("0"), "0.00");
  assert.ok(!formatTemplateAmount(14750).includes("₹"));
  assert.throws(() => formatTemplateAmount("abc"));
});

test("template values lose new lines, tabs and long space runs", () => {
  assert.equal(
    sanitizeTemplateValue("  Oxygen\nConcentrator\t(5L)    rental  "),
    "Oxygen Concentrator (5L) rental",
  );
  assert.equal(sanitizeTemplateValue("x".repeat(600)).length, 500);
});

test("items: joined with commas, first three, then +N more", () => {
  const at = (i: number) => `2026-11-03T10:0${i}:00Z`;
  assert.equal(
    describeItems([{ description: "BiPAP Machine", created_at: at(1) }]),
    "BiPAP Machine",
  );
  assert.equal(
    describeItems([
      { description: "Oxygen Concentrator (5L)", created_at: at(2) },
      { description: "BiPAP Machine", created_at: at(1) },
    ]),
    "BiPAP Machine, Oxygen Concentrator (5L)",
  );
  const five = [1, 2, 3, 4, 5].map((i) => ({ description: `Item ${i}`, created_at: at(i) }));
  assert.equal(describeItems(five), "Item 1, Item 2, Item 3 +2 more");
  assert.equal(describeItems([]), "");
  const long = describeItems(
    [1, 2, 3, 4].map((i) => ({ description: "W".repeat(90), created_at: at(i) })),
  );
  assert.ok(long.length <= 200 && long.endsWith(" +1 more"), long);
});

test("template parameters follow the single mapping config, in placeholder order", () => {
  const r = buildTemplateParams({
    customerName: "Test Customer",
    invoiceNumber: "BCK/2026/0001",
    invoiceDate: "2026-11-03",
    items: [{ description: "Oxygen Concentrator (5L)", created_at: "2026-11-03T10:00:00Z" }],
    grandTotal: "14750.00",
  });
  assert.ok(r.ok);
  assert.deepEqual(r.params, [
    "Test Customer",
    "BCK/2026/0001",
    "03 Nov 2026",
    "Oxygen Concentrator (5L)",
    "14,750.00",
  ]);
  assert.equal(r.params.length, INVOICE_SEND_TEMPLATE.parameters.length);
});

test("the mapping is explicitly marked as not yet verified", () => {
  assert.equal(INVOICE_SEND_TEMPLATE.mappingVerified, false);
  assert.equal(INVOICE_SEND_TEMPLATE.campaignName, "invoice_send");
});

test("missing values make the parameters invalid instead of sending blanks", () => {
  const base = {
    customerName: "A",
    invoiceNumber: "B",
    invoiceDate: "2026-11-03",
    items: [{ description: "x", created_at: "t" }],
    grandTotal: 1,
  };
  assert.equal(buildTemplateParams({ ...base, items: [] }).ok, false);
  assert.equal(buildTemplateParams({ ...base, customerName: "  " }).ok, false);
  assert.equal(buildTemplateParams({ ...base, invoiceDate: "bad" }).ok, false);
});

// ── AiSensy payload and request ─────────────────────────────────────────────
const payload = buildCampaignPayload({
  destination: "+919845011223",
  userName: "Test Customer",
  mediaUrl: "https://example.test/storage/v1/object/sign/invoice-pdfs/x.pdf?token=abc",
  mediaFilename: "BCK-2026-0001.pdf",
  templateParams: ["Test Customer", "BCK/2026/0001", "03 Nov 2026", "Item", "14,750.00"],
});

test("payload has exactly the documented Legacy Campaign fields and never the key", () => {
  assert.deepEqual(Object.keys(payload).sort(), [
    "campaignName",
    "destination",
    "media",
    "source",
    "templateParams",
    "userName",
  ]);
  assert.equal(payload.campaignName, "invoice_send");
  assert.equal(payload.source, "breathcarekart-app");
  assert.deepEqual(Object.keys(payload.media).sort(), ["filename", "url"]);
  assert.ok(!("apiKey" in payload));
});

type Captured = { url: string; init: RequestInit };
const fakeFetch = (status: number, body: string, captured: Captured[]) =>
  (async (url: string | URL | Request, init?: RequestInit) => {
    captured.push({ url: String(url), init: init ?? {} });
    return new Response(body, { status });
  }) as typeof fetch;

test("request: POST to the confirmed endpoint, apiKey in the JSON body, no Bearer header", async () => {
  const captured: Captured[] = [];
  const r = await postCampaign(
    payload,
    "TEST-KEY-123",
    fakeFetch(200, '{"success":"true"}', captured),
  );
  assert.equal(r.kind, "accepted");
  assert.equal(captured.length, 1);
  assert.equal(captured[0]!.url, AISENSY_ENDPOINT);
  assert.equal(captured[0]!.url, "https://backend.aisensy.com/campaign/t1/api/v2");
  assert.equal(captured[0]!.init.method, "POST");
  const headers = new Headers(captured[0]!.init.headers);
  assert.equal(headers.get("authorization"), null);
  assert.equal(headers.get("content-type"), "application/json");
  const sent = JSON.parse(String(captured[0]!.init.body));
  assert.equal(sent.apiKey, "TEST-KEY-123");
  assert.equal(sent.campaignName, "invoice_send");
  assert.deepEqual(sent.templateParams, payload.templateParams);
});

test("provider rejection and network failure are reported, never as success", async () => {
  const rejected = await postCampaign(
    payload,
    "K",
    fakeFetch(400, '{"message":"Template params mismatch"}', []),
  );
  assert.equal(rejected.kind, "rejected");
  assert.equal(rejected.kind === "rejected" && rejected.httpStatus, 400);
  const failing = (async () => {
    throw new TypeError("network down");
  }) as typeof fetch;
  assert.equal((await postCampaign(payload, "K", failing)).kind, "network_error");
});

test("a slow provider times out", async () => {
  const hanging = ((_u: unknown, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
      );
    })) as typeof fetch;
  assert.equal((await postCampaign(payload, "K", hanging, 30)).kind, "timeout");
});

test("provider replies are sanitised: key removed, secret fields dropped, size capped", async () => {
  const r = await postCampaign(
    payload,
    "SECRET-KEY-9",
    fakeFetch(
      200,
      '{"success":"true","echo":"key was SECRET-KEY-9","apiKey":"SECRET-KEY-9","token":"t","id":"m1"}',
      [],
    ),
  );
  const stored = JSON.stringify(r.kind === "accepted" ? r.response : null);
  assert.ok(!stored.includes("SECRET-KEY-9"), stored);
  assert.ok(!/"apiKey"|"token"/.test(stored), stored);
  assert.match(stored, /"id":"m1"/);
  const text = sanitizeProviderResponse("plain text with SECRET-KEY-9", "SECRET-KEY-9");
  assert.deepEqual(text, { text: "plain text with [redacted]" });
  const huge = JSON.stringify(
    sanitizeProviderResponse(JSON.stringify({ a: "x".repeat(5000) }), null),
  );
  assert.ok(huge.length < 2100);
});

test("signed URL tokens are redacted before display or logging", () => {
  assert.equal(
    redactSignedUrl("https://x/y.pdf?token=abc.def&a=1"),
    "https://x/y.pdf?token=[redacted]&a=1",
  );
});
