import { createHmac } from "node:crypto";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { mountWhatsApp } from "./whatsapp-routes.js";
import {
  challengeMatches,
  incomingWhatsAppMessages,
  verifyWhatsAppSignature,
  type WhatsAppConfig,
} from "./whatsapp.js";

const config: WhatsAppConfig = {
  verifyToken: "verify-token",
  appSecret: "app-secret",
  accessToken: "access-token",
  phoneNumberId: "1414581435073321",
  sellerId: "c6854b0b-05c5-478a-9401-0132dba78f3a",
  graphVersion: "v25.0",
};

function sign(body: string): string {
  return `sha256=${createHmac("sha256", config.appSecret).update(body).digest("hex")}`;
}

const payload = {
  entry: [
    {
      changes: [
        {
          value: {
            metadata: { phone_number_id: config.phoneNumberId },
            contacts: [{ wa_id: "966512345678", profile: { name: "Hana" } }],
            messages: [
              { from: "966512345678", id: "wamid.1", type: "text", text: { body: "2 chocolate cakes tomorrow" } },
              { from: "966512345678", id: "wamid.2", type: "image", image: { id: "media" } },
            ],
            statuses: [{ id: "wamid.1", status: "sent" }],
          },
        },
      ],
    },
  ],
};

describe("whatsapp webhook", () => {
  it("accepts the verify challenge and rejects a wrong token", () => {
    expect(challengeMatches(config, "subscribe", "verify-token")).toBe(true);
    expect(challengeMatches(config, "subscribe", "other")).toBe(false);
  });

  it("reads a text message and a placeholder for anything else", () => {
    expect(incomingWhatsAppMessages(payload)).toEqual([
      {
        waMessageId: "wamid.1",
        from: "966512345678",
        name: "Hana",
        body: "2 chocolate cakes tomorrow",
        phoneNumberId: config.phoneNumberId,
      },
      {
        waMessageId: "wamid.2",
        from: "966512345678",
        name: "Hana",
        body: "[image]",
        phoneNumberId: config.phoneNumberId,
      },
    ]);
    expect(incomingWhatsAppMessages({ entry: [{ changes: [{ value: { statuses: [] } }] }] })).toEqual([]);
  });

  it("checks the signature and stores only messages for this number", async () => {
    const seen: string[] = [];
    const app = new Hono();
    mountWhatsApp(app, config, async (input) => {
      seen.push(input.body);
    });
    const raw = JSON.stringify(payload);
    const denied = await app.request("/api/whatsapp/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=nope" },
      body: raw,
    });
    expect(denied.status).toBe(401);

    const accepted = await app.request("/api/whatsapp/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": sign(raw) },
      body: raw,
    });
    expect(accepted.status).toBe(200);
    expect(seen).toEqual(["2 chocolate cakes tomorrow", "[image]"]);
    expect(verifyWhatsAppSignature(config.appSecret, raw, sign(raw))).toBe(true);
  });

  it("returns the challenge as plain text", async () => {
    const app = new Hono();
    mountWhatsApp(app, config, async () => undefined);
    const response = await app.request(
      "/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=987654",
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("987654");
  });
});
