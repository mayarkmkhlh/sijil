import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import type { ModelClient } from "./extract.js";
import { ModelRequestError } from "./muse-spark.js";

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

function postExtract(
  app: ReturnType<typeof createApp>,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return app.request("/api/extract", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
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

  it("returns 502 with the upstream status when the client is refused", async () => {
    const client: ModelClient = {
      async complete() {
        throw new ModelRequestError("http", 404);
      },
    };
    const response = await postExtract(createApp(client), { chat: "هلا" });
    const body = (await response.json()) as {
      error: string;
      upstream: { kind: string; status?: number };
    };

    expect(response.status).toBe(502);
    expect(body.error).toBe("model request failed");
    expect(body.upstream).toEqual({ kind: "http", status: 404 });
    expect(JSON.stringify(body)).not.toContain("هلا");
  });

  it("returns 413 when the body is over 16 KB", async () => {
    const client = fakeClient([validReply]);
    const response = await postExtract(createApp(client), { chat: "a".repeat(16 * 1024) });

    expect(response.status).toBe(413);
    expect(client.calls).toBe(0);
  });

  it("returns 503 and does not call the model when extract is turned off", async () => {
    process.env.EXTRACT_ENABLED = "false";
    const client = fakeClient([validReply]);
    try {
      const response = await postExtract(createApp(client), { chat: "هلا" });
      expect(response.status).toBe(503);
      expect(client.calls).toBe(0);
      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Extract is turned off.");
    } finally {
      delete process.env.EXTRACT_ENABLED;
    }
  });

  it("returns 429 for the third extract from the same address", async () => {
    process.env.EXTRACT_IP_LIMIT = "2";
    const client = fakeClient([validReply, validReply, validReply, validReply]);
    const forwarded = { "x-forwarded-for": "198.51.100.4, 203.0.113.9" };
    try {
      const app = createApp(client);
      expect((await postExtract(app, { chat: "هلا" }, forwarded)).status).toBe(200);
      expect((await postExtract(app, { chat: "هلا" }, { "x-forwarded-for": "203.0.113.9" })).status).toBe(200);
      const blocked = await postExtract(app, { chat: "هلا" }, forwarded);
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get("retry-after")).toBeTruthy();
      expect(client.calls).toBe(2);

      const other = await postExtract(app, { chat: "هلا" }, { "x-forwarded-for": "203.0.113.10" });
      expect(other.status).toBe(200);
      expect(client.calls).toBe(3);
    } finally {
      delete process.env.EXTRACT_IP_LIMIT;
    }
  });

  it("returns 503 once the daily extract limit is reached", async () => {
    process.env.EXTRACT_DAILY_LIMIT = "1";
    const client = fakeClient([validReply, validReply]);
    try {
      const app = createApp(client);
      expect((await postExtract(app, { chat: "هلا" })).status).toBe(200);
      const blocked = await postExtract(app, { chat: "هلا" });
      expect(blocked.status).toBe(503);
      expect(client.calls).toBe(1);
      const body = (await blocked.json()) as { error: string };
      expect(body.error).toBe("Daily extract limit reached.");
    } finally {
      delete process.env.EXTRACT_DAILY_LIMIT;
    }
  });
});
