import { describe, expect, it } from "vitest";
import { demoFallback } from "./demo-cache.js";

describe("demoFallback", () => {
  it("returns the saved Nora order and nothing for an unknown chat", () => {
    const nora = demoFallback("c01");
    expect(nora?.kind).toBe("order");
    if (nora?.kind !== "order") return;
    expect(nora.order.customer_name).toBe("Nora");
    expect(nora.reviews.map((review) => review.catalogId)).toEqual(["cake-chocolate", "cookies"]);
    expect(demoFallback("missing")).toBeNull();
  });

  it("keeps Fahd's later Riyadh address and Sara's catalog price", () => {
    const fahd = demoFallback("c08");
    const sara = demoFallback("inject");
    if (fahd?.kind !== "order" || sara?.kind !== "order") throw new Error("expected orders");
    expect(fahd.order.delivery_city).toBe("Riyadh");
    expect(fahd.order.delivery_address).toBe("street 22, house 9");
    expect(sara.order.items[0]?.unit_price).toBe(120);
    expect(sara.reviews[0]?.quotedPrice).toBe(120);
  });

  it("keeps the complaint as not an order", () => {
    expect(demoFallback("c10")).toEqual({
      kind: "no_order",
      reason: "Customer is asking about status of existing order 123, not placing a new order.",
    });
  });
});
