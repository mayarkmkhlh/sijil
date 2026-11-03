import { describe, expect, it } from "vitest";
import { draftAsk } from "./missing-ask.helper.js";

describe("draftAsk", () => {
  it("asks only for the missing size and district", () => {
    const draft = draftAsk({
      language: "en",
      missing_fields: ["delivery_district", "items.0.variant.size"],
    });

    expect(draft).toBe("Hi, could you send the district and the size?");
    expect(draft).not.toContain("city");
    expect(draft).not.toContain("name");
  });

  it("uses the customer dialect and stays quiet when nothing is missing", () => {
    expect(draftAsk({ language: "gulf_ar", missing_fields: ["delivery_district"] })).toBe(
      "هلا، ممكن ترسل الحي؟",
    );
    expect(draftAsk({ language: "en", missing_fields: [] })).toBeNull();
  });
});