import { describe, expect, it } from "vitest";
import { toTranscript } from "./to-transcript.helper.js";
import type { Message } from "../types/message.type.js";

function message(author: Message["author"], text: string): Message {
  return {
    id: text,
    conversationId: "c",
    author,
    text,
    sentAt: "2026-11-03T16:15:00+03:00",
  };
}

describe("toTranscript", () => {
  it("labels each turn in order", () => {
    const transcript = toTranscript([
      message("customer", "السلام عليكم، ابي كيكة"),
      message("seller", "هلا، وين التوصيل؟"),
    ]);

    expect(transcript).toBe("customer: السلام عليكم، ابي كيكة\nseller: هلا، وين التوصيل؟");
  });

  it("returns an empty string when there are no messages", () => {
    expect(toTranscript([])).toBe("");
  });
});
