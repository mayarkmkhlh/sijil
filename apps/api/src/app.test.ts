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
});

describe("GET /api/debug-models", () => {
  it("returns model ids and a short completion body, never the key", async () => {
    const previous = globalThis.fetch;
    let seenKey = "";
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      const auth = new Headers(init?.headers).get("authorization") ?? "";
      seenKey = auth.replace(/^Bearer\s+/i, "");
      if (url.endsWith("/models")) {
        return new Response(JSON.stringify({ data: [{ id: "muse-spark-1.3" }, { id: "other" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(`model muse-spark-1.3 not found key=${seenKey} ${auth}`, { status: 404 });
    };

    try {
      const response = await createApp(fakeClient([validReply])).request("/api/debug-models");
      const body = (await response.json()) as {
        models: { status: number; ids: string[] };
        completion: { status: number; body: string };
      };
      const serialized = JSON.stringify(body);

      expect(response.status).toBe(200);
      expect(serialized).not.toContain("Authorization");
      if (seenKey) {
        expect(serialized).not.toContain(seenKey);
        expect(body.models).toEqual({ status: 200, ids: ["muse-spark-1.3", "other"] });
        expect(body.completion.status).toBe(404);
        expect(body.completion.body.length).toBeLessThanOrEqual(300);
      } else {
        expect(body.completion.body).toBe("MODEL_API_KEY is empty");
      }
    } finally {
      globalThis.fetch = previous;
    }
  });
});
