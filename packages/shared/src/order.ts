import { z } from "zod";

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

const optionalText = z.string().nullable().default(null);
const optionalMoney = z.number().nonnegative().nullable().default(null);
const optionalQuantity = z.number().int().positive().nullable().default(null);

export const lineItemSchema = z.object({
  name: optionalText,
  size: optionalText,
  colour: optionalText,
  quantity: optionalQuantity,
  unitPrice: optionalMoney,
});

export const orderDraftSchema = z.object({
  customerName: optionalText,
  phone: optionalText,
  city: optionalText,
  address: optionalText,
  currency: z.literal("USD").default("USD"),
  notes: optionalText,
  items: z.array(lineItemSchema).default([]),
});

export type LineItem = z.infer<typeof lineItemSchema>;
export type OrderDraft = z.infer<typeof orderDraftSchema>;

const requiredOrderFields = ["customerName", "phone", "city", "address"] as const;
const requiredItemFields = ["name", "size", "colour", "quantity"] as const;

function blank(value: string | number | null): boolean {
  if (value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

/** Fields still empty after validation. The model does not get to decide this. */
export function missingFields(order: OrderDraft): string[] {
  const missing: string[] = [];

  for (const field of requiredOrderFields) {
    if (blank(order[field])) missing.push(field);
  }

  if (order.items.length === 0) {
    missing.push("items");
    return missing;
  }

  order.items.forEach((item, index) => {
    for (const field of requiredItemFields) {
      if (blank(item[field])) missing.push(`items.${index}.${field}`);
    }
  });

  return missing;
}
