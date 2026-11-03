import type { Message } from "../types/message.type.js";

export function toTranscript(messages: readonly Message[]): string {
  return messages.map((message) => `${message.author}: ${message.text}`).join("\n");
}
