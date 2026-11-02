import { extractionJsonSchema } from "@sijil/shared";
import type { ChatMessage, ModelClient } from "./extract.js";

export type MuseSparkConfig = {
  apiKey: string;
  model: string;
  baseUrl: string;
};

type CompletionBody = {
  choices?: Array<{
    finish_reason?: string | null;
    message?: { content?: string | null };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    completion_tokens_details?: { reasoning_tokens?: number };
  };
};

/** Muse Spark behind ModelClient. Env is read by the caller so tests can pass a fake config. */
export class MuseSparkClient implements ModelClient {
  constructor(private readonly config: MuseSparkConfig) {}

  async complete(messages: ChatMessage[]): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: 0,
        reasoning_effort: "low",
        max_completion_tokens: 4000,
        store: false,
        messages,
        response_format: {
          type: "json_schema",
          json_schema: { name: "extraction", schema: extractionJsonSchema },
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const detail = redact(await response.text(), this.config.apiKey).trim().slice(0, 500);
      throw new Error(`Muse Spark request failed (${response.status}): ${detail}`);
    }

    const payload = (await response.json()) as CompletionBody;
    const usage = payload.usage;
    const choice = payload.choices?.[0];
    // finish=length means the token cap cut the JSON off. A retry uses the same cap, so it fails the same way.
    console.log(
      `muse spark tokens input=${usage?.prompt_tokens ?? "unknown"} output=${usage?.completion_tokens ?? "unknown"} reasoning=${usage?.completion_tokens_details?.reasoning_tokens ?? "unknown"} finish=${choice?.finish_reason ?? "unknown"}`,
    );
    return choice?.message?.content ?? "";
  }
}

function redact(text: string, secret: string): string {
  if (!secret) return text;
  return text.split(secret).join("[redacted]");
}
