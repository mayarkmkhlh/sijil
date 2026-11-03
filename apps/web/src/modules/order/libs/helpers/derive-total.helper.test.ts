import { describe, expect, it } from "vitest";
import { deriveTotal, lineTotal } from "./derive-total.helper.js";

describe("deriveTotal", () => {
  it("multiplies quantity by unit price and sums the lines", () => {
    expect(
      deriveTotal([
        { qty: 1, unit_price: 180 },
        { qty: 12, unit_price: 5 },
      ]),
    ).toBe(240);
  });

  it("returns null when any line has no price", () => {
    expect(deriveTotal([{ qty: 1, unit_price: null }])).toBeNull();
    expect(lineTotal({ qty: null, unit_price: 10 })).toBeNull();
  });

  it("returns zero when there are no lines", () => {
    expect(deriveTotal([])).toBe(0);
  });

  it("rounds to cents", () => {
    expect(deriveTotal([{ qty: 3, unit_price: 0.1 }])).toBe(0.3);
  });
});
