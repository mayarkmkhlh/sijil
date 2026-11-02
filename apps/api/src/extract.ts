import {
  deriveMissingFields,
  parseExtractionResult,
  type ExtractionResult,
  type Order,
} from "@sijil/shared";

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

const systemPrompt =
  "Extract one seller order from the customer chat. " +
  "The chat may be Gulf Arabic, Modern Standard Arabic, English, or a mix. " +
  "Use null for anything the customer did not state. Do not invent a name, item, address, or payment. " +
  "Keep the customer's own words for names, sizes, and colours. " +
  "If the seller quotes a bare price and names no currency, use SAR. If no price is quoted, currency is null. " +
  "delivery_date is YYYY-MM-DD. Resolve relative dates such as tomorrow against the chat date. If the customer names no date, use null. " +
  "language is gulf_ar, msa, en, or mixed. " +
  "confidence is a number from 0 to 1. " +
  "variant.text is pack size, flavour, or any other wording that is not a size or a colour. " +
  "size and colour are null when unstated. Use null for the whole variant when none of the three was named. " +
  "If the chat is not a new order, set noOrder to true, put the reason in reason, and set order to null. " +
  "Otherwise set noOrder to false, reason to null, and put the order in order.";

function formatIssues(issues: ExtractIssue[]): string {
  return issues
    .map((issue) => (issue.path ? `${issue.path}: ${issue.message}` : issue.message))
    .join("\n");
}

function readReply(
  reply: string,
): { ok: true; result: ExtractionResult } | { ok: false; issues: ExtractIssue[] } {
  let value: unknown;
  try {
    value = JSON.parse(reply);
  } catch {
    return { ok: false, issues: [{ path: "", message: "The reply wasn't valid JSON" }] };
  }

  const parsed = parseExtractionResult(value);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    };
  }

  if ("noOrder" in parsed.data) return { ok: true, result: parsed.data };
  const order: Order = {
    ...parsed.data,
    missing_fields: deriveMissingFields(parsed.data),
  };
  return { ok: true, result: order };
}

/**
 * The retry message contains the original chat, the bad reply, and the exact error.
 * One retry only: a second failure is structural, and another call costs money and time.
 */
export async function extractOrder(
  chat: string,
  chatDate: string,
  client: ModelClient,
): Promise<ExtractOrderResult> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Chat date: ${chatDate}\n\n${chat}` },
  ];
  let issues: ExtractIssue[] = [];

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const reply = await client.complete([...messages]);
    const read = readReply(reply);
    if (read.ok) return { ok: true, result: read.result, attempts: attempt };

    issues = read.issues;
    if (attempt === 2) break;
    messages.push({ role: "assistant", content: reply });
    messages.push({ role: "user", content: formatIssues(issues) });
  }

  return { ok: false, issues, attempts: 2 };
}
