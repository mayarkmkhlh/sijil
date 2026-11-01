import { describe, expect, it } from "vitest";
import { OrderSchema, extractionJsonSchema, parseExtractionResult } from "./order.js";

// Fictional chat: نورة wants a black abaya, size M, delivered in حي النرجس, Riyadh.
const validOrder = {
  customer_name: "نورة",
  items: [
    {
      name: "عباية سوداء",
      qty: 1,
      variant: { size: "M", colour: "أسود", text: null },
      unit_price: 250,
    },
  ],
  currency: "SAR",
  delivery_city: "الرياض",
  delivery_district: "حي النرجس",
  delivery_address: "الرياض، حي النرجس",
  delivery_date: "2026-11-05",
  payment_method: "cash_on_delivery",
  notes: null,
  missing_fields: [],
  language: "gulf_ar",
  confidence: 1,
};

describe("OrderSchema", () => {
  it("accepts a complete order", () => {
    const result = OrderSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
  });

  it("rejects an order with items removed", () => {
    const { items: _items, ...missingItems } = validOrder;
    const result = OrderSchema.safeParse(missingItems);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.path).toEqual(["items"]);
  });

  it("rejects a quantity written as text", () => {
    const wrongType = {
      ...validOrder,
      items: [{ ...validOrder.items[0], qty: "two" }],
    };
    const result = OrderSchema.safeParse(wrongType);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.path).toEqual(["items", 0, "qty"]);
  });

  it("accepts a complaint as a non-order", () => {
    const result = parseExtractionResult({
      noOrder: true,
      reason: "late delivery complaint, not a new order",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      noOrder: true,
      reason: "late delivery complaint, not a new order",
    });
  });

  it("keeps the model JSON Schema root as one object", () => {
    expect(extractionJsonSchema).toMatchObject({ type: "object" });
    expect(extractionJsonSchema).not.toHaveProperty("anyOf");
  });
});
