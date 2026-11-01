import { OrderSchema, deriveMissingFields } from "@sijil/shared";
import { loadEnv } from "./env.js";

const env = loadEnv();

const chat = `هلا، ابغى العباية السوداء مقاس M
الاسم نورة
الجوال 0550000000
الرياض، حي النرجس`;

const orderSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "customer_name",
    "items",
    "currency",
    "delivery_city",
    "delivery_district",
    "delivery_address",
    "delivery_date",
    "payment_method",
    "notes",
    "missing_fields",
    "language",
    "confidence",
  ],
  properties: {
    customer_name: { type: ["string", "null"] },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "qty", "variant", "unit_price"],
        properties: {
          name: { type: ["string", "null"] },
          qty: { type: ["integer", "null"] },
          variant: {
            type: ["object", "null"],
            additionalProperties: false,
            required: ["size", "colour"],
            properties: {
              size: { type: ["string", "null"] },
              colour: { type: ["string", "null"] },
            },
          },
          unit_price: { type: ["number", "null"] },
        },
      },
    },
    currency: {
      type: ["string", "null"],
      enum: ["USD", "SAR", "AED", "KWD", "BHD", "QAR", "OMR", null],
    },
    delivery_city: { type: ["string", "null"] },
    delivery_district: { type: ["string", "null"] },
    delivery_address: { type: ["string", "null"] },
    delivery_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
    payment_method: {
      type: ["string", "null"],
      enum: ["cash_on_delivery", "bank_transfer", "paypal", "mada", "apple_pay", null],
    },
    notes: { type: ["string", "null"] },
    missing_fields: { type: "array", items: { type: "string" } },
    language: { type: "string", enum: ["gulf_ar", "msa", "en", "mixed"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
} as const;

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
          "Use null for anything the customer did not state. Do not guess. " +
          "Keep the customer's own words for names, sizes, and colours. " +
          "currency is an ISO code, or null when they named none. " +
          "delivery_date is YYYY-MM-DD, or null. " +
          "language is gulf_ar, msa, en, or mixed. " +
          "confidence is a number from 0 to 1. " +
          "variant holds size and colour.",
      },
      { role: "user", content: chat },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "order", schema: orderSchema },
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
const parsed = OrderSchema.safeParse(JSON.parse(content ?? ""));
if (!parsed.success) {
  console.error(parsed.error.issues);
  process.exit(1);
}

const missing = deriveMissingFields(parsed.data);
console.log(
  JSON.stringify({ order: { ...parsed.data, missing_fields: missing }, missing }, null, 2),
);