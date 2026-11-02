import type { ExtractionResult } from "@sijil/shared";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** The model sits behind this, so tests can pass a fake and Llama can replace Muse Spark. */
export interface ModelClient {
  complete(messages: ChatMessage[]): Promise<string>;
}

export type ExtractIssue = { path: string; message: string };

export type ExtractOrderResult =
  | { ok: true; result: ExtractionResult; attempts: number }
  | { ok: false; issues: ExtractIssue[]; attempts: number };

/** Stub. The tests are written first, so this fails their assertions on purpose. */
export async function extractOrder(
  _chat: string,
  _chatDate: string,
  _client: ModelClient,
): Promise<ExtractOrderResult> {
  return { ok: false, issues: [], attempts: 0 };
}
