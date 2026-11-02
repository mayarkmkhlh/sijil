import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveMissingFields } from "@sijil/shared";
import { describe, expect, it } from "vitest";
import { extractOrder, type ChatMessage, type ModelClient } from "./extract.js";

type LabelItem = {
  name: string;
  variant: string | null;
  quantity: number;
  unitPrice: number | null;
};

type ChatFile = {
  chatDate: string;
  messages: { from: string; text: string }[];
  expected: {
    customerName: string | null;
    items: LabelItem[];
    currency: string | null;
    delivery: { city: string | null; district: string | null; address: string | null };
    deliveryDate: string | null;
    notes: string | null;
    paymentMethod: string | null;
    language: string;
  };
};

const languageMap: Record<string, string> = {
  gulf: "gulf_ar",
  msa: "msa",
  en: "en",
  arabizi: "mixed",
  mixed: "mixed",
};

function loadChat(id: string): ChatFile {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), "../../data/chats", `${id}.json`);
  return JSON.parse(readFileSync(path, "utf8")) as ChatFile;
}

function transcript(chat: ChatFile): string {
  return chat.messages.map((message) => `${message.from}: ${message.text}`).join("\n");
}

/** The shape Meta returns: one object, with the order nested inside. */
function modelReply(chat: ChatFile, confidence: number): string {
  const label = chat.expected;
  return JSON.stringify({
    noOrder: false,
    reason: null,
    order: {
      customer_name: label.customerName,
      items: label.items.map((item) => ({
        name: item.name,
        qty: item.quantity,
        unit_price: item.unitPrice,
        variant: item.variant
          ? { size: null, colour: null, text: item.variant }
          : null,
      })),
      currency: label.currency,
      delivery_city: label.delivery.city,
      delivery_district: label.delivery.district,
      delivery_address: label.delivery.address,
      delivery_date: label.deliveryDate,
      notes: label.notes,
      payment_method: label.paymentMethod,
      missing_fields: [],
      language: languageMap[label.language] ?? label.language,
      confidence,
    },
  });
}

function fakeClient(replies: string[]): ModelClient & { calls: ChatMessage[][] } {
  const calls: ChatMessage[][] = [];
  return {
    calls,
    async complete(messages) {
      calls.push(messages);
      const reply = replies[calls.length - 1];
      if (reply === undefined) throw new Error("extractOrder asked for a third call");
      return reply;
    },
  };
}

describe("extractOrder", () => {
  it("returns c01 when the first reply is valid", async () => {
    const chat = loadChat("c01");
    const client = fakeClient([modelReply(chat, 0.9)]);

    const outcome = await extractOrder(transcript(chat), chat.chatDate, client);

    expect(outcome.ok).toBe(true);
    expect(outcome.attempts).toBe(1);
    expect(client.calls).toHaveLength(1);
    if (!outcome.ok || "noOrder" in outcome.result) return;
    expect(outcome.result.customer_name).toBe("نورة");
    expect(outcome.result.missing_fields).toEqual(deriveMissingFields(outcome.result));
  });

  it("retries once when the first reply is truncated or over-confident", async () => {
    const chat = loadChat("c02");
    const valid = modelReply(chat, 0.9);
    const truncated = `{"customer_name": "Re`;
    const overConfident = modelReply(chat, 1.7);

    for (const first of [truncated, overConfident]) {
      const client = fakeClient([first, valid]);
      const outcome = await extractOrder(transcript(chat), chat.chatDate, client);
      const retryText = (client.calls[1] ?? []).map((message) => message.content).join("\n");

      expect(outcome.ok).toBe(true);
      expect(outcome.attempts).toBe(2);
      expect(client.calls).toHaveLength(2);
      expect(retryText).toContain(first);
      if (first === overConfident) expect(retryText).toContain("confidence");
      if (!outcome.ok || "noOrder" in outcome.result) return;
      expect(outcome.result.missing_fields).toEqual(deriveMissingFields(outcome.result));
    }
  });

  it("stops after two invalid replies for c03", async () => {
    const chat = loadChat("c03");
    const client = fakeClient([`{"customer_name": "Re`, "{"]);

    const outcome = await extractOrder(transcript(chat), chat.chatDate, client);

    expect(outcome.ok).toBe(false);
    expect(outcome.attempts).toBe(2);
    expect(client.calls).toHaveLength(2);
  });
});
