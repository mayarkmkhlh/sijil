import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import type { ModelClient } from "./extract.js";

function fakeClient(replies: string[]): ModelClient & { calls: number } {
  const state = { calls: 0 };
  return {
    get calls() {
      return state.calls;
    },
    async complete() {
      const reply = replies[state.calls];
      state.calls += 1;
      if (reply === undefined) throw new Error("extract route asked for another call");
      return reply;
    },
  };
}

const validReply = JSON.stringify({
  noOrder: false,
  reason: null,
  order: {
    customer_name: "نورة",
    items: [
      {
        name: "عباية",
        qty: 1,
        unit_price: 250,
        variant: { size: "M", colour: "سوداء", text: null },
      },
    ],
    currency: "SAR",
    delivery_city: "الرياض",
    delivery_district: "النرجس",
    delivery_address: "شارع التحلية",
    delivery_date: null,
    notes: null,
    payment_method: "cash_on_delivery",
    language: "gulf_ar",
    confidence: 0.9,
  },
});

function postExtract(app: ReturnType<typeof createApp>, body: unknown) {
  return app.request("/api/extract", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/extract", () => {
  it("returns 400 for an empty chat", async () => {
    const client = fakeClient([validReply]);
    const response = await postExtract(createApp(client), { chat: "" });

    expect(response.status).toBe(400);
    expect(client.calls).toBe(0);
    const body = (await response.json()) as { issues: { path: string }[] };
    expect(body.issues.some((issue) => issue.path === "chat")).toBe(true);
  });

  it("returns 200 with the order, missing fields, and attempts", async () => {
    const client = fakeClient([validReply]);
    const response = await postExtract(createApp(client), { chat: "هلا، عباية" });
    const body = (await response.json()) as {
      kind: string;
      order: { customer_name: string; missing_fields: string[] };
      missing_fields: string[];
      attempts: number;
    };

    expect(response.status).toBe(200);
    expect(body.kind).toBe("order");
    expect(body.attempts).toBe(1);
    expect(body.order.customer_name).toBe("نورة");
    expect(body.missing_fields).toEqual(body.order.missing_fields);
    expect(body.missing_fields).toContain("delivery_date");
  });

  it("returns 422 with the issues when both replies are invalid", async () => {
    const client = fakeClient([`{"customer_name": "Re`, "{"]);
    const response = await postExtract(createApp(client), { chat: "هلا" });
    const body = (await response.json()) as {
      issues: { message: string }[];
      attempts: number;
    };

    expect(response.status).toBe(422);
    expect(body.attempts).toBe(2);
    expect(client.calls).toBe(2);
    expect(body.issues.length).toBeGreaterThan(0);
  });
});
