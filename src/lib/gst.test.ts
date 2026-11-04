/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkGstin, GST_RATES, gstinCheckCharacter, isGstRate, normalizeGstin } from "./gst.ts";

// The example GSTIN from GSTN's own documentation. Used only to test the algorithm.
const DOC_EXAMPLE = "27AAPFU0939F1ZV";

test("a well-formed GSTIN passes, after spaces and case are normalised", () => {
  assert.deepEqual(checkGstin(DOC_EXAMPLE), { ok: true, gstin: DOC_EXAMPLE });
  assert.deepEqual(checkGstin(" 27aapfu0939f1zv "), { ok: true, gstin: DOC_EXAMPLE });
  assert.deepEqual(checkGstin("27 AAPFU 0939 F1ZV"), { ok: true, gstin: DOC_EXAMPLE });
  assert.equal(normalizeGstin("27 aapfu0939f1zv"), DOC_EXAMPLE);
});

test("the check character follows GSTN's method", () => {
  assert.equal(gstinCheckCharacter(DOC_EXAMPLE.slice(0, 14)), "V");
});

test("a typo in any position is caught by the check character", () => {
  const changed = (i: number) => {
    const c = DOC_EXAMPLE[i] === "A" ? "B" : DOC_EXAMPLE[i] === "0" ? "1" : "A";
    return DOC_EXAMPLE.slice(0, i) + c + DOC_EXAMPLE.slice(i + 1);
  };
  // Changing a letter position to another letter (or digit to digit) keeps the format.
  for (const i of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
    const r = checkGstin(changed(i));
    assert.equal(r.ok, false, changed(i));
  }
  assert.equal(checkGstin("27AAPFU0939F1ZW").ok, false);
});

test("wrong length, format and state codes are refused with a reason", () => {
  const reasons = (g: string) => {
    const r = checkGstin(g);
    return r.ok ? "ok" : r.reason;
  };
  assert.equal(reasons(""), "empty");
  assert.equal(reasons("27AAPFU0939F1Z"), "length");
  assert.equal(reasons("27AAPFU0939F1ZVX"), "length");
  assert.equal(reasons("2AAAPFU0939F1ZV"), "format");
  assert.equal(reasons("27AAPFU0939F1YV"), "format"); // 14th character must be Z
  assert.equal(reasons("27AAPFU0939F0ZV"), "format"); // entity number can't be 0
  assert.equal(reasons("00AAPFU0939F1ZV"), "state");
  assert.equal(reasons("45AAPFU0939F1ZV"), "state");
});

test("the offered GST rates are unchanged, and only those are accepted", () => {
  assert.deepEqual([...GST_RATES], ["0", "5", "12", "18", "28"]);
  assert.equal(isGstRate("18"), true);
  assert.equal(isGstRate("40"), false);
  assert.equal(isGstRate(18), false);
});

test("the client-provided GSTIN passes the Settings validation", () => {
  // Saved by migration 20261104000100; format check only, not proof of registration.
  assert.deepEqual(checkGstin("36AALCG1309A1Z4"), { ok: true, gstin: "36AALCG1309A1Z4" });
});
