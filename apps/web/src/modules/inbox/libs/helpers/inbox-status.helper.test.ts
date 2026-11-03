import { describe, expect, it } from "vitest";
import type { Order } from "@sijil/shared";
import type { ExtractState } from "../../../order/libs/types/extract-state.type.js";
import { inboxStatus, matchesInboxFilter } from "./inbox-status.helper.js";

function order(missing: Order["missing_fields"]): ExtractState {
  return {
    status: "order",
    order: {
      customer_name: "نورة",
      items: [],
      currency: "SAR",
      delivery_city: null,
      delivery_district: null,
      delivery_address: null,
      delivery_date: null,
      payment_method: null,
      notes: null,
      missing_fields: missing,
      language: "gulf_ar",
      confidence: 0.2,
    },
    reviews: [],
    meta: { attempts: 1, elapsedMs: 10 },
  };
}

describe("inboxStatus", () => {
  it("marks a chat awaiting info only when the latest order still has gaps", () => {
    expect(inboxStatus(false, order(["delivery_city"]))).toBe("incomplete");
    expect(inboxStatus(false, order([]))).toBe("ready");
  });

  it("keeps a question unbadged and leaves untouched chats new", () => {
    expect(inboxStatus(false, { status: "no_order", reason: "سؤال عن السعر" })).toBeNull();
    expect(inboxStatus(false, { status: "idle" })).toBe("new");
    expect(inboxStatus(false, { status: "error", httpStatus: 502, detail: null, cached: null })).toBe("new");
  });

  it("approves only when the seller has approved", () => {
    expect(inboxStatus(true, order(["delivery_city"]))).toBe("approved");
    expect(inboxStatus(false, order([]))).not.toBe("approved");
  });
});

describe("matchesInboxFilter", () => {
  it("keeps ready and approved chats out of the new and incomplete filters", () => {
    expect(matchesInboxFilter("incomplete", "ready")).toBe(false);
    expect(matchesInboxFilter("new", "ready")).toBe(false);
    expect(matchesInboxFilter("incomplete", "approved")).toBe(false);
    expect(matchesInboxFilter("new", "approved")).toBe(false);
    expect(matchesInboxFilter("all", "ready")).toBe(true);
    expect(matchesInboxFilter("incomplete", "incomplete")).toBe(true);
    expect(matchesInboxFilter("new", "new")).toBe(true);
    expect(matchesInboxFilter("new", null)).toBe(false);
  });
});
