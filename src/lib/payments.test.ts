/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { paymentCustomer, paymentTransactionType, totalPaid, uniqueById } from "./payments.ts";

const custA = { id: "c1", name: "Customer A" };
const custB = { id: "c2", name: "Customer B" };

test("rental-only payment: customer comes from the rental, type is rental", () => {
  const p = { id: "p1", amount: 1500, rental_id: "r1", invoice: null, rental: { customer: custA } };
  assert.deepEqual(paymentCustomer(p), custA);
  assert.equal(paymentTransactionType(p), "rental");
});

test("invoice-only payment: customer and type come from the invoice", () => {
  const p = {
    id: "p2",
    amount: 900,
    rental_id: null,
    invoice: { customer: custB, transaction_type: "sale" },
    rental: null,
  };
  assert.deepEqual(paymentCustomer(p), custB);
  assert.equal(paymentTransactionType(p), "sale");
});

test("payment linked to both: invoice wins and it is counted once", () => {
  const p = {
    id: "p3",
    amount: "2500.50",
    rental_id: "r1",
    invoice: { customer: custA, transaction_type: "rental" },
    rental: { customer: custA },
  };
  assert.deepEqual(paymentCustomer(p), custA);
  assert.equal(paymentTransactionType(p), "rental");
  // The same payment arrives once via the invoice and once via the rental.
  assert.equal(totalPaid([p, { ...p }]), 2500.5);
  assert.equal(uniqueById([p, { ...p }]).length, 1);
});

test("missing customer information returns null, not a crash", () => {
  assert.equal(paymentCustomer({ invoice: null, rental: null }), null);
  assert.equal(paymentCustomer({ invoice: { customer: null }, rental: { customer: null } }), null);
  assert.equal(paymentCustomer({}), null);
  // Invoice without a visible customer falls back to the rental's.
  assert.deepEqual(
    paymentCustomer({ invoice: { customer: null }, rental: { customer: custB } }),
    custB,
  );
  assert.equal(paymentTransactionType({ rental_id: null, invoice: null }), null);
});

test("totals: distinct payments add up exactly, no float drift", () => {
  const list = [
    { id: "a", amount: 0.1 },
    { id: "b", amount: 0.2 },
    { id: "c", amount: "1000.35" },
  ];
  assert.equal(totalPaid(list), 1000.65);
  assert.equal(totalPaid([]), 0);
});
