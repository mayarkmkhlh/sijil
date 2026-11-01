import {
  deriveMissingFields,
  extractionJsonSchema,
  parseExtractionResult,
  type Order,
} from "@sijil/shared";
import { loadEnv } from "./env.js";

const env = loadEnv();
const chatDate = "2026-11-02";

const chat = `هلا، ابغى العباية السوداء مقاس M
الاسم نورة
الجوال 0550000000
الرياض، حي النرجس`;

const response = await fetch(`${env.MODEL_API_BASE_URL}/chat/completions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${env.MODEL_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: env.MUSE_SPARK_MODEL,
    temperature: 0,
    reasoning_effort: "low",
    max_completion_tokens: 1000,
    store: false,
    messages: [
      {
        role: "system",
        content:
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
          "Otherwise set noOrder to false, reason to null, and put the order in order.",
      },
      { role: "user", content: `Chat date: ${chatDate}\n\n${chat}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "extraction", schema: extractionJsonSchema },
    },
  }),
});

const payload = (await response.json()) as {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

if (!response.ok) {
  console.error(response.status, payload.error?.message ?? "request failed");
  process.exit(1);
}

const content = payload.choices?.[0]?.message?.content;
const parsed = parseExtractionResult(JSON.parse(content ?? ""));
if (!parsed.success) {
  console.error(parsed.error.issues);
  process.exit(1);
}

if ("noOrder" in parsed.data) {
  console.log(JSON.stringify(parsed.data, null, 2));
} else {
  const missing = deriveMissingFields(parsed.data);
  const order: Order = { ...parsed.data, missing_fields: missing };
  console.log(JSON.stringify({ order, missing }, null, 2));
}
