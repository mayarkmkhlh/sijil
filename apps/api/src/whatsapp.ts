import { createHmac, timingSafeEqual } from "node:crypto";

export type WhatsAppConfig = {
  verifyToken: string;
  appSecret: string;
  accessToken: string;
  phoneNumberId: string;
  sellerId: string;
  graphVersion: string;
};

export type IncomingWhatsApp = {
  waMessageId: string;
  from: string;
  name: string;
  body: string;
  phoneNumberId: string;
};

export function whatsAppReady(config: WhatsAppConfig): boolean {
  return (
    config.verifyToken.length > 0 &&
    config.appSecret.length > 0 &&
    config.accessToken.length > 0 &&
    config.phoneNumberId.length > 0 &&
    config.sellerId.length > 0
  );
}

export function verifyWhatsAppSignature(appSecret: string, rawBody: string, header: string | undefined): boolean {
  if (!appSecret || !header) return false;
  const digest = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const expected = Buffer.from(`sha256=${digest}`);
  const actual = Buffer.from(header);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

function sameSecret(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function challengeMatches(config: WhatsAppConfig, mode: string | undefined, token: string | undefined): boolean {
  return mode === "subscribe" && Boolean(token) && sameSecret(token as string, config.verifyToken);
}

function textOf(message: Record<string, unknown>): string {
  if (message.type === "text") {
    const text = message.text;
    if (text && typeof text === "object" && "body" in text && typeof text.body === "string") return text.body.trim();
    return "";
  }
  return typeof message.type === "string" && message.type.length > 0 ? `[${message.type}]` : "";
}

/** Text messages, plus a short placeholder for anything else WhatsApp delivered. */
export function incomingWhatsAppMessages(payload: unknown): IncomingWhatsApp[] {
  if (!payload || typeof payload !== "object" || !("entry" in payload) || !Array.isArray(payload.entry)) return [];
  const found: IncomingWhatsApp[] = [];
  for (const entry of payload.entry) {
    if (!entry || typeof entry !== "object" || !("changes" in entry) || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      if (!change || typeof change !== "object" || !("value" in change)) continue;
      const value = change.value;
      if (!value || typeof value !== "object") continue;
      const metadata = "metadata" in value ? value.metadata : null;
      const phoneNumberId =
        metadata && typeof metadata === "object" && "phone_number_id" in metadata
          ? String(metadata.phone_number_id ?? "")
          : "";
      const names = new Map<string, string>();
      if ("contacts" in value && Array.isArray(value.contacts)) {
        for (const contact of value.contacts) {
          if (!contact || typeof contact !== "object") continue;
          const waId = "wa_id" in contact ? String(contact.wa_id ?? "") : "";
          const profile = "profile" in contact ? contact.profile : null;
          const name =
            profile && typeof profile === "object" && "name" in profile ? String(profile.name ?? "").trim() : "";
          if (waId && name) names.set(waId, name);
        }
      }
      if (!("messages" in value) || !Array.isArray(value.messages)) continue;
      for (const message of value.messages) {
        if (!message || typeof message !== "object") continue;
        const record = message as Record<string, unknown>;
        const from = typeof record.from === "string" ? record.from.replace(/\D/g, "") : "";
        const waMessageId = typeof record.id === "string" ? record.id : "";
        const body = textOf(record).slice(0, 2_000);
        if (!from || !waMessageId || !body || !phoneNumberId) continue;
        found.push({
          waMessageId,
          from,
          name: (names.get(from) || from).slice(0, 80),
          body,
          phoneNumberId,
        });
      }
    }
  }
  return found;
}

export class WhatsAppSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhatsAppSendError";
  }
}

export async function sendWhatsAppText(
  config: WhatsAppConfig,
  input: { to: string; body: string },
): Promise<void> {
  if (!whatsAppReady(config)) throw new WhatsAppSendError("WhatsApp is not configured.");
  let response: Response;
  try {
    response = await fetch(`https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.to,
        type: "text",
        text: { preview_url: false, body: input.body },
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new WhatsAppSendError("WhatsApp could not be reached.");
  }
  if (response.ok) {
    await response.body?.cancel();
    return;
  }
  const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  const message = payload?.error?.message?.slice(0, 200) || `WhatsApp send failed (${response.status})`;
  throw new WhatsAppSendError(message);
}
