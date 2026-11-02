import { extractionJsonSchema } from "@sijil/shared";
import type { ChatMessage, ModelClient } from "./extract.js";

export type MuseSparkConfig = {
  apiKey: string;
  model: string;
  baseUrl: string;
};

/** Meta refused the call, or the call never reached Meta. The message has no response body and no key. */
export class ModelRequestError extends Error {
  readonly kind: "http" | "network" | "timeout";
  readonly status?: number;

  constructor(kind: "http", status: number);
  constructor(kind: "network" | "timeout");
  constructor(kind: "http" | "network" | "timeout", status?: number) {
    super(kind === "http" ? `Muse Spark request failed (${status})` : `Muse Spark request failed (${kind})`);
    this.name = "ModelRequestError";
    this.kind = kind;
    this.status = status;
  }
}

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
    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/chat/completions`, {
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
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      throw new ModelRequestError(timedOut ? "timeout" : "network");
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new ModelRequestError("http", response.status);
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
