/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canRecordDelivery,
  canRemoveDeliveryPhoto,
  deliveryPhotoProblem,
  MAX_DELIVERY_PHOTO_BYTES,
} from "./delivery.ts";

const SUP = "sup-1";
const rental = (over: Record<string, unknown> = {}) => ({
  status: "active",
  delivery_status: "assigned",
  supervisor_id: SUP,
  ...over,
});

test("only the assigned supervisor records a delivery", () => {
  assert.equal(canRecordDelivery({ role: "supervisor", profileId: SUP }, rental()), true);
  assert.equal(canRecordDelivery({ role: "supervisor", profileId: "sup-2" }, rental()), false);
  for (const role of ["admin", "telecaller"]) {
    assert.equal(canRecordDelivery({ role, profileId: SUP }, rental()), false, role);
  }
});

test("only while the delivery is in progress and the rental is open", () => {
  const me = { role: "supervisor", profileId: SUP };
  assert.equal(canRecordDelivery(me, rental({ delivery_status: "out_for_delivery" })), true);
  for (const delivery_status of ["pending", "delivered"]) {
    assert.equal(canRecordDelivery(me, rental({ delivery_status })), false, delivery_status);
  }
  for (const status of ["completed", "cancelled"]) {
    assert.equal(canRecordDelivery(me, rental({ status })), false, status);
  }
  assert.equal(canRecordDelivery(me, rental({ status: "overdue" })), true);
});

test("a supervisor removes only their own photos, before confirmation", () => {
  const me = { role: "supervisor", profileId: SUP };
  assert.equal(canRemoveDeliveryPhoto(me, rental(), { uploaded_by: SUP }), true);
  assert.equal(canRemoveDeliveryPhoto(me, rental(), { uploaded_by: "admin-1" }), false);
  assert.equal(
    canRemoveDeliveryPhoto(me, rental({ delivery_status: "delivered" }), { uploaded_by: SUP }),
    false,
  );
  assert.equal(
    canRemoveDeliveryPhoto({ role: "admin", profileId: SUP }, rental(), { uploaded_by: SUP }),
    false,
  );
});

test("photos: image types only, not empty, at most 10 MB each", () => {
  assert.equal(deliveryPhotoProblem({ name: "a.jpg", type: "image/jpeg", size: 1000 }), null);
  assert.equal(deliveryPhotoProblem({ name: "a.heic", type: "image/HEIC", size: 1000 }), null);
  assert.match(
    deliveryPhotoProblem({ name: "a.pdf", type: "application/pdf", size: 1000 }) ?? "",
    /JPG, PNG/,
  );
  assert.match(deliveryPhotoProblem({ name: "a.gif", type: "image/gif", size: 1000 }) ?? "", /JPG/);
  assert.match(deliveryPhotoProblem({ name: "e.jpg", type: "image/jpeg", size: 0 }) ?? "", /empty/);
  assert.equal(
    deliveryPhotoProblem({ name: "max.jpg", type: "image/jpeg", size: MAX_DELIVERY_PHOTO_BYTES }),
    null,
  );
  assert.match(
    deliveryPhotoProblem({
      name: "big.jpg",
      type: "image/jpeg",
      size: MAX_DELIVERY_PHOTO_BYTES + 1,
    }) ?? "",
    /10 MB/,
  );
});
