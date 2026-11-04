import { describe, expect, it } from "vitest";
import { canSetFulfillment, canSetPayment, nextFulfillment, nextPayment } from "./order-lifecycle.js";

describe("order lifecycle", () => {
  it("moves fulfillment one step at a time and allows cancel before delivery", () => {
    expect(nextFulfillment("confirmed")).toEqual(["preparing", "cancelled"]);
    expect(canSetFulfillment("confirmed", "delivered")).toBe(false);
    expect(canSetFulfillment("preparing", "shipped")).toBe(true);
    expect(canSetFulfillment("shipped", "delivered")).toBe(true);
    expect(nextFulfillment("delivered")).toEqual([]);
    expect(nextFulfillment("cancelled")).toEqual([]);
  });

  it("keeps payment separate from delivery", () => {
    expect(nextPayment("unpaid")).toEqual(["paid"]);
    expect(canSetPayment("unpaid", "refunded")).toBe(false);
    expect(canSetPayment("paid", "refunded")).toBe(true);
    expect(canSetPayment("refunded", "paid")).toBe(false);
  });
});
