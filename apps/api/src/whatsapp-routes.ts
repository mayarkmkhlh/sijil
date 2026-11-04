import type { Hono } from "hono";
import { challengeMatches, incomingWhatsAppMessages, verifyWhatsAppSignature, type WhatsAppConfig } from "./whatsapp.js";

export type WhatsAppIngest = (input: {
  sellerId: string;
  customerPhone: string;
  customerName: string;
  body: string;
  waMessageId: string;
}) => Promise<void>;

export function mountWhatsApp(app: Hono, config: WhatsAppConfig, ingest: WhatsAppIngest) {
  app.get("/api/whatsapp/webhook", (c) => {
    if (!config.verifyToken) return c.json({ error: "WhatsApp is not configured." }, 503);
    const mode = c.req.query("hub.mode");
    const token = c.req.query("hub.verify_token");
    const challenge = c.req.query("hub.challenge") ?? "";
    if (!challengeMatches(config, mode, token)) return c.json({ error: "Verification failed." }, 403);
    return c.text(challenge);
  });

  app.post("/api/whatsapp/webhook", async (c) => {
    if (!config.appSecret || !config.sellerId || !config.phoneNumberId) {
      return c.json({ error: "WhatsApp is not configured." }, 503);
    }
    const raw = await c.req.text();
    if (!verifyWhatsAppSignature(config.appSecret, raw, c.req.header("x-hub-signature-256"))) {
      return c.json({ error: "Verification failed." }, 401);
    }
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return c.json({ ok: true });
    }
    for (const message of incomingWhatsAppMessages(payload)) {
      if (message.phoneNumberId !== config.phoneNumberId) continue;
      await ingest({
        sellerId: config.sellerId,
        customerPhone: message.from,
        customerName: message.name,
        body: message.body,
        waMessageId: message.waMessageId,
      });
    }
    return c.json({ ok: true });
  });
}
