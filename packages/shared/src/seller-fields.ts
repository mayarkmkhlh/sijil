export const extractFieldKeys = [
  "customer_name",
  "delivery_city",
  "delivery_district",
  "delivery_address",
  "delivery_date",
  "payment_method",
  "currency",
  "item_qty",
  "item_price",
  "item_size",
  "item_colour",
] as const;

export type ExtractFieldKey = (typeof extractFieldKeys)[number];

export const defaultExtractFields: readonly ExtractFieldKey[] = [
  "customer_name",
  "delivery_city",
  "delivery_district",
  "delivery_address",
  "delivery_date",
  "payment_method",
  "item_qty",
  "item_price",
  "item_size",
  "item_colour",
];

const keySet = new Set<string>(extractFieldKeys);

export function isExtractFieldKey(value: string): value is ExtractFieldKey {
  return keySet.has(value);
}

/** Drops gaps the seller did not ask to collect. Item names always stay. */
export function keepMissingField(path: string, fields: readonly string[]): boolean {
  const chosen = new Set(fields);
  if (path === "items" || path.endsWith(".name")) return true;
  if (chosen.has(path)) return true;
  if (path.endsWith(".qty")) return chosen.has("item_qty");
  if (path.endsWith(".unit_price")) return chosen.has("item_price");
  if (path.endsWith(".variant.size")) return chosen.has("item_size");
  if (path.endsWith(".variant.colour")) return chosen.has("item_colour");
  if (path.endsWith(".variant")) {
    return chosen.has("item_size") || chosen.has("item_colour");
  }
  return false;
}
