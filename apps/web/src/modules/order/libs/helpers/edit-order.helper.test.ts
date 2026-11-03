import { describe, expect, it } from "vitest";
import type { Order } from "@sijil/shared";
import { editOrder } from "./edit-order.helper.js";

function order(patch: Partial<Order> = {}): Order {
  return {
    customer_name: "نورة",
    items: [
      {
        name: "كيكة",
        qty: 1,
        variant: null,
        unit_price: null,
      },
    ],
    currency: "SAR",
    delivery_city: null,
    delivery_district: "النرجس",
    delivery_address: null,
    delivery_date: null,
    payment_method: null,
    notes: null,
    missing_fields: ["delivery_city", "delivery_address", "delivery_date", "payment_method", "items.0.unit_price"],
    language: "gulf_ar",
    confidence: 0.4,
    ...patch,
  };
}

describe("editOrder", () => {
  it("fills one missing field and drops only that entry", () => {
    const next = editOrder(order(), "delivery_city", "الرياض");
    expect(next.delivery_city).toBe("الرياض");
    expect(next.missing_fields).not.toContain("delivery_city");
    expect(next.missing_fields).toContain("delivery_address");
    expect(next.missing_fields).not.toContain("items.0.variant");
  });

  it("puts a cleared field back into missing_fields", () => {
    const next = editOrder(order(), "customer_name", "  ");
    expect(next.customer_name).toBeNull();
    expect(next.missing_fields).toContain("customer_name");
  });

  it("rejects an invalid date and an unknown payment", () => {
    const current = order();
    expect(editOrder(current, "delivery_date", "tomorrow")).toBe(current);
    expect(editOrder(current, "payment_method", "cash")).toBe(current);
  });

  it("sets a line price from the seller and clears that gap", () => {
    const next = editOrder(order(), "items.0.unit_price", 12.5);
    expect(next.items[0]?.unit_price).toBe(12.5);
    expect(next.missing_fields).not.toContain("items.0.unit_price");
  });

  it("returns the same order when a missing field is cleared again", () => {
    const current = order();
    expect(editOrder(current, "delivery_city", "")).toBe(current);
  });
});
