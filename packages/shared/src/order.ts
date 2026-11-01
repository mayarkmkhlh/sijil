import { z } from "zod/v4";

export const orderStatusSchema = z.enum([
  "extracted",
  "needs_details",
  "approved",
  "invoiced",
  "paid",
  "failed",
]);

export const orderStatuses = orderStatusSchema.options;

export type OrderStatus = z.infer<typeof orderStatusSchema>;

/** ISO codes a Gulf direct-message order will actually name. Null when the chat names none. */
export const currencySchema = z.enum([
  "USD",
  "SAR",
  "AED",
  "KWD",
  "BHD",
  "QAR",
  "OMR",
]);

/** The ask-back is written in this language. */
export const languageSchema = z.enum(["gulf_ar", "msa", "en", "mixed"]);

export const paymentMethodSchema = z.enum([
  "cash_on_delivery",
  "bank_transfer",
  "paypal",
  "mada",
  "apple_pay",
  "stc_pay",
  "card",
  "card_link",
]);

const optionalText = z.string().min(1).nullable();

/** size and colour when the chat names them. text is everything else: pack size, flavour, fabric. */
export const variantSchema = z.object({
  size: optionalText,
  colour: optionalText,
  text: optionalText,
});

export const ItemSchema = z.object({
  name: optionalText,
  qty: z.number().int().positive().nullable(),
  variant: variantSchema.nullable(),
  unit_price: z.number().nonnegative().nullable(),
});

/** A calendar day, YYYY-MM-DD. Null when the customer did not name one. */
export const deliveryDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "delivery_date must be YYYY-MM-DD")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "delivery_date must be a real calendar date");

export const missingFieldSchema = z
  .string()
  .regex(
    /^(customer_name|currency|delivery_city|delivery_district|delivery_address|delivery_date|payment_method|items|items\.\d+\.(name|qty|unit_price|variant|variant\.size|variant\.colour|variant\.text))$/,
  );

export const OrderSchema = z.object({
  customer_name: optionalText,
  items: z.array(ItemSchema),
  currency: currencySchema.nullable(),
  delivery_city: optionalText,
  delivery_district: optionalText,
  delivery_address: optionalText,
  delivery_date: deliveryDateSchema.nullable(),
  payment_method: paymentMethodSchema.nullable(),
  notes: optionalText,
  missing_fields: z.array(missingFieldSchema),
  language: languageSchema,
  confidence: z.number().min(0).max(1),
});

export type Item = z.infer<typeof ItemSchema>;
export type Order = z.infer<typeof OrderSchema>;

/** A complaint or any other chat that is not a new order. */
export const noOrderSchema = z.object({
  noOrder: z.literal(true),
  reason: z.string().min(1),
});

export const extractionResultSchema = z.union([OrderSchema, noOrderSchema]);
export type NoOrder = z.infer<typeof noOrderSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;

/**
 * One object for Meta structured output. A top-level union becomes anyOf,
 * which the API rejects at the root. parseExtractionResult unwraps this
 * into an order or a noOrder result.
 */
export const modelExtractionSchema = z.object({
  noOrder: z.boolean(),
  reason: z.string().min(1).nullable(),
  order: OrderSchema.nullable(),
});

/** JSON Schema for one order. Draft 2020-12, Zod's default. */
export const orderJsonSchema = z.toJSONSchema(OrderSchema);

/** JSON Schema sent to the model. Root stays a single object. */
export const extractionJsonSchema = z.toJSONSchema(modelExtractionSchema);

export function parseExtractionResult(value: unknown) {
  const direct = extractionResultSchema.safeParse(value);
  if (direct.success) return direct;

  const wrapped = modelExtractionSchema.safeParse(value);
  if (!wrapped.success) return wrapped;
  if (wrapped.data.noOrder) {
    return noOrderSchema.safeParse({ noOrder: true, reason: wrapped.data.reason });
  }
  return OrderSchema.safeParse(wrapped.data.order);
}

const requiredOrderFields = [
  "customer_name",
  "currency",
  "delivery_city",
  "delivery_district",
  "delivery_address",
  "delivery_date",
  "payment_method",
] as const;

/** Empty fields, computed from the order. This replaces the model's own missing_fields list. */
export function deriveMissingFields(order: Order): Order["missing_fields"] {
  const missing: string[] = [];

  for (const field of requiredOrderFields) {
    if (order[field] === null) missing.push(field);
  }

  if (order.items.length === 0) {
    missing.push("items");
    return missingFieldSchema.array().parse(missing);
  }

  order.items.forEach((item, index) => {
    if (item.name === null) missing.push(`items.${index}.name`);
    if (item.qty === null) missing.push(`items.${index}.qty`);
    if (item.unit_price === null) missing.push(`items.${index}.unit_price`);
    if (item.variant === null) {
      missing.push(`items.${index}.variant`);
      return;
    }
    if (item.variant.size === null) missing.push(`items.${index}.variant.size`);
    if (item.variant.colour === null) missing.push(`items.${index}.variant.colour`);
    if (item.variant.text === null) missing.push(`items.${index}.variant.text`);
  });

  return missingFieldSchema.array().parse(missing);
}
