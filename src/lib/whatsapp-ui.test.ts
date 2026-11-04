/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ACCEPTED_NOTE,
  createSendGuard,
  DEFAULT_SEND_MODE,
  describeSendError,
  historyStatusLabels,
  historyStatusTone,
  inFlightPhase,
  initialSendMode,
  isOutcomeUnknown,
  maskCustomerPhone,
  maskDestination,
  modeOptions,
  needsResendConfirmation,
  phaseLabels,
  previewValues,
  resultPhase,
  safeHistoryError,
  type WhatsAppPreview,
} from "./whatsapp-ui.ts";

const preview = (over: Partial<WhatsAppPreview> = {}): WhatsAppPreview => ({
  ok: true,
  action: "preview",
  campaign: "invoice_send",
  mapping_verified: false,
  template_params: ["A", "B", "03 Nov 2026", "Item", "1.00"],
  recipient: { name: "Test Customer", phone_masked: "+91 ******1223" },
  test_destination_masked: "+91 ******0000",
  modes: { dry_run: true, test: true, live: false },
  already_sent: { live: false, test: false },
  attachment_filename: "BCK-2026-0001.pdf",
  ...over,
});

// ── Modes ──────────────────────────────────────────────────────────────────
test("send to customer is offered first and pre-selected only when the server allows it", () => {
  assert.equal(DEFAULT_SEND_MODE, "dry_run");
  const on = preview({ modes: { dry_run: true, test: true, live: true } });
  assert.deepEqual(
    modeOptions(on).map((o) => [o.mode, o.available]),
    [
      ["live", true],
      ["test", true],
      ["dry_run", true],
    ],
  );
  assert.equal(initialSendMode(on), "live");
  const off = preview({ modes: { dry_run: true, test: false, live: false } });
  assert.equal(modeOptions(off).find((o) => o.mode === "live")?.available, false);
  assert.equal(initialSendMode(off), "dry_run");
  assert.equal(initialSendMode(null), "dry_run");
});

test("a repeat to the customer checks the customer history, not the test history", () => {
  const sentLive = preview({ already_sent: { live: true, test: false } });
  assert.equal(needsResendConfirmation("live", sentLive, null), true);
  assert.equal(needsResendConfirmation("test", sentLive, null), false);
  const sentTest = preview({ already_sent: { live: false, test: true } });
  assert.equal(needsResendConfirmation("live", sentTest, null), false);
});

test("the review step lists every message value with its name", () => {
  const values = previewValues(
    preview({ template_params: ["A", "B", "C", "D", "E"] }),
    "payment_request",
  );
  assert.deepEqual(
    values.map((v) => v.label),
    ["Customer name", "Invoice number", "Pending amount (₹)", "Payment due date", "UPI ID"],
  );
  assert.deepEqual(
    values.map((v) => v.value),
    ["A", "B", "C", "D", "E"],
  );
});

test("test send is only available when the server says so", () => {
  const off = modeOptions(preview({ modes: { dry_run: true, test: false, live: false } }));
  assert.equal(off.find((o) => o.mode === "test")?.available, false);
  assert.ok(off.find((o) => o.mode === "test")?.reason);
  assert.equal(modeOptions(preview()).find((o) => o.mode === "test")?.available, true);
  // No preview yet: nothing can be sent.
  assert.ok(modeOptions(null).every((o) => !o.available));
});

// ── Statuses ───────────────────────────────────────────────────────────────
test("all six statuses have the agreed labels", () => {
  assert.deepEqual(phaseLabels, {
    ready: "Ready",
    preparing: "Preparing",
    sending: "Sending",
    accepted: "Accepted by AiSensy",
    failed: "Failed",
    dry_run_done: "Dry run completed",
  });
});

test("a dry run shows Preparing invoice, a test send shows Sending", () => {
  assert.equal(inFlightPhase("dry_run"), "preparing");
  assert.equal(inFlightPhase("test"), "sending");
});

test("results map to Dry run completed or Accepted by AiSensy", () => {
  const base = {
    ok: true as const,
    message_id: "m",
    destination_masked: "x",
    attachment_filename: "f",
  };
  assert.equal(resultPhase({ ...base, status: "dry_run", note: "" }), "dry_run_done");
  assert.equal(resultPhase({ ...base, status: "accepted", mode: "test", note: "" }), "accepted");
});

test("acceptance is explicitly not delivery", () => {
  assert.match(ACCEPTED_NOTE, /not a delivery confirmation/);
  assert.equal(historyStatusLabels["sent"], "Accepted by AiSensy");
  assert.ok(!Object.values(historyStatusLabels).some((l) => /delivered/i.test(l)));
});

test("history statuses have labels and tones, unknown values fall back safely", () => {
  assert.equal(historyStatusLabels["dry_run"], "Dry run completed");
  assert.equal(historyStatusTone("failed"), "overdue");
  assert.equal(historyStatusTone("something_new"), "neutral");
});

// ── Resend and retries ─────────────────────────────────────────────────────
test("a test send after an accepted test send needs explicit confirmation", () => {
  const sent = preview({ already_sent: { live: false, test: true } });
  assert.equal(needsResendConfirmation("test", sent, null), true);
  assert.equal(needsResendConfirmation("test", preview(), null), false);
  // Dry runs never need confirmation.
  assert.equal(needsResendConfirmation("dry_run", sent, "already_sent"), false);
});

test("the server's already_sent and uncertain outcomes require confirmation", () => {
  for (const code of ["already_sent", "provider_timeout", "network", "unexpected"]) {
    assert.equal(needsResendConfirmation("test", preview(), code), true, code);
    assert.equal(describeSendError(code).retry, "confirm_resend", code);
  }
});

test("retry is offered only when nothing was sent", () => {
  for (const code of [
    "pdf_failed",
    "storage_failed",
    "signed_url_failed",
    "pdf_link_unreachable",
    "log_failed",
    "provider_unreachable",
  ]) {
    assert.equal(describeSendError(code).retry, "retry", code);
    assert.equal(needsResendConfirmation("test", preview(), code), false, code);
  }
  assert.equal(describeSendError("send_in_progress").retry, "wait");
  for (const code of [
    "forbidden",
    "missing_phone",
    "invalid_phone",
    "live_disabled",
    "function_not_deployed",
  ]) {
    assert.equal(describeSendError(code).retry, "none", code);
  }
});

test("error messages are the app's own wording, never raw server text", () => {
  assert.equal(describeSendError("totally_unknown").message, describeSendError(null).message);
  for (const code of ["provider_rejected", "unexpected", "pdf_failed"]) {
    const m = describeSendError(code).message;
    assert.ok(!/https?:|token|api.?key|stack/i.test(m), m);
  }
});

test("only uncertain outcomes are remembered as possibly sent", () => {
  for (const code of ["provider_timeout", "network", "unexpected", "something_new"]) {
    assert.equal(isOutcomeUnknown(code), true, code);
  }
  for (const code of [
    "already_sent",
    "pdf_failed",
    "provider_rejected",
    "send_in_progress",
    "forbidden",
  ]) {
    assert.equal(isOutcomeUnknown(code), false, code);
  }
});

test("a double click only starts one send", () => {
  const guard = createSendGuard();
  assert.equal(guard.tryStart(), true);
  assert.equal(guard.tryStart(), false);
  assert.equal(guard.busy, true);
  guard.finish();
  assert.equal(guard.tryStart(), true);
});

// ── Masking and safe history text ──────────────────────────────────────────
test("numbers are always masked", () => {
  assert.equal(maskDestination("+919845011223"), "+91 ******1223");
  assert.equal(maskDestination(null), "—");
  assert.equal(maskCustomerPhone("98450 11223"), "+91 ******1223");
  assert.equal(maskCustomerPhone("+44 7700 900123"), "******0123");
  assert.equal(maskCustomerPhone(null), null);
  assert.ok(!maskCustomerPhone("98450 11223")?.includes("98450"));
});

test("history errors lose links and are kept short", () => {
  assert.equal(
    safeHistoryError("Failed at https://x.supabase.co/sign/a.pdf?token=abc now"),
    "Failed at [link] now",
  );
  assert.equal(safeHistoryError(null), null);
  assert.equal(safeHistoryError("  "), null);
  assert.ok((safeHistoryError("x".repeat(500)) ?? "").length <= 160);
});
