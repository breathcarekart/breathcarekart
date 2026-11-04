/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeSignInEmail, signInErrorMessage } from "./auth-errors.ts";

test("wrong email or password gets one message (it never says which was wrong)", () => {
  assert.equal(
    signInErrorMessage({ code: "invalid_credentials", status: 400 }),
    "Incorrect email or password.",
  );
  assert.equal(
    signInErrorMessage({ message: "Invalid login credentials", status: 400 }),
    "Incorrect email or password.",
  );
});

test("account problems, rate limits, network and server errors get safe messages", () => {
  assert.match(
    signInErrorMessage({ code: "email_not_confirmed", status: 400 }),
    /hasn't been confirmed/,
  );
  assert.match(signInErrorMessage({ code: "user_banned", status: 400 }), /blocked/);
  assert.match(signInErrorMessage({ code: "over_request_rate_limit", status: 429 }), /Too many/);
  assert.match(signInErrorMessage({ status: 429 }), /Too many/);
  assert.match(
    signInErrorMessage({ name: "AuthRetryableFetchError", status: 0, message: "Failed to fetch" }),
    /Couldn't reach/,
  );
  assert.match(signInErrorMessage({ message: "TypeError: Failed to fetch" }), /Couldn't reach/);
  assert.match(
    signInErrorMessage({ status: 503, message: "upstream connect error" }),
    /having a problem/,
  );
});

test("unknown errors never show the raw server text", () => {
  const raw = "pq: relation auth.sessions does not exist (SQLSTATE 42P01)";
  const shown = signInErrorMessage({ status: 400, code: "unexpected_failure", message: raw });
  assert.ok(!shown.includes("SQLSTATE") && !shown.includes("auth.sessions"), shown);
});

test("spaces around the email are removed before signing in", () => {
  assert.equal(normalizeSignInEmail("  owner@example.com \n"), "owner@example.com");
});
