import {
  currencySchema,
  deliveryDateSchema,
  paymentMethodSchema,
  type Item,
  type Order,
} from "@sijil/shared";
import { askFieldKeys, type AskField } from "./missing-ask.helper.js";

const itemPath =
  /^items\.(\d+)\.(name|qty|unit_price|variant|variant\.size|variant\.colour|variant\.text)$/;

/** Writes one seller edit back onto the draft and updates only that missing-field entry. */
export function editOrder(order: Order, path: string, value: string | number | null): Order {
  if ((askFieldKeys as readonly string[]).includes(path)) {
    return editAsk(order, path as AskField, value);
  }
  if (path === "currency") return editCurrency(order, value);
  const match = itemPath.exec(path);
  if (!match) return order;
  return editItem(order, Number(match[1]), match[2], value);
}

function editAsk(order: Order, key: AskField, value: string | number | null): Order {
  if (typeof value === "number") return order;
  const text = value ?? "";
  if (key === "payment_method") {
    if (text.trim() === "") return apply(order, { payment_method: null }, key, false);
    const parsed = paymentMethodSchema.safeParse(text);
    if (!parsed.success) return order;
    return apply(order, { payment_method: parsed.data }, key, true);
  }
  if (key === "delivery_date") {
    if (text.trim() === "") return apply(order, { delivery_date: null }, key, false);
    const parsed = deliveryDateSchema.safeParse(text);
    if (!parsed.success) return order;
    return apply(order, { delivery_date: parsed.data }, key, true);
  }
  const stored = text.trim() === "" ? null : text;
  return apply(order, { [key]: stored }, key, stored !== null);
}

function editCurrency(order: Order, value: string | number | null): Order {
  if (typeof value === "number") return order;
  const text = value ?? "";
  if (text.trim() === "") return apply(order, { currency: null }, "currency", false);
  const parsed = currencySchema.safeParse(text);
  if (!parsed.success) return order;
  return apply(order, { currency: parsed.data }, "currency", true);
}

function editItem(order: Order, index: number, suffix: string, value: string | number | null): Order {
  const item = order.items[index];
  if (!item) return order;
  const path = `items.${index}.${suffix}`;
  if (suffix === "name") {
    if (typeof value === "number") return order;
    const stored = value === null || value.trim() === "" ? null : value;
    return apply(order, { items: replaceItem(order.items, index, { ...item, name: stored }) }, path, stored !== null);
  }
  if (suffix === "qty") {
    const qty = asQty(value);
    if (qty === undefined) return order;
    return apply(order, { items: replaceItem(order.items, index, { ...item, qty }) }, path, qty !== null);
  }
  if (suffix === "unit_price") {
    const unitPrice = asPrice(value);
    if (unitPrice === undefined) return order;
    return apply(
      order,
      { items: replaceItem(order.items, index, { ...item, unit_price: unitPrice }) },
      path,
      unitPrice !== null,
    );
  }
  return editVariant(order, index, suffix, value);
}

function editVariant(order: Order, index: number, suffix: string, value: string | number | null): Order {
  const item = order.items[index];
  if (!item || typeof value === "number") return order;
  const stored = value === null || value.trim() === "" ? null : value;
  const path = `items.${index}.${suffix}`;
  if (suffix === "variant") {
    const variant = stored === null ? null : { size: null, colour: null, text: stored };
    return apply(order, { items: replaceItem(order.items, index, { ...item, variant }) }, path, stored !== null);
  }
  const key = suffix === "variant.size" ? "size" : suffix === "variant.colour" ? "colour" : "text";
  const base = item.variant ?? { size: null, colour: null, text: null };
  const variant = { ...base, [key]: stored };
  return apply(order, { items: replaceItem(order.items, index, { ...item, variant }) }, path, stored !== null);
}

function asQty(value: string | number | null): number | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value === "string" && !/^\d+$/.test(value)) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function asPrice(value: string | number | null): number | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value === "string" && !/^\d+(\.\d{1,2})?$/.test(value)) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

function replaceItem(items: readonly Item[], index: number, item: Item): Item[] {
  return items.map((current, itemIndex) => (itemIndex === index ? item : current));
}

function apply(order: Order, patch: Partial<Order>, path: string, filled: boolean): Order {
  const missingFields = setMissing(order.missing_fields, path, filled);
  const next: Order = { ...order, ...patch, missing_fields: missingFields };
  return sameOrder(order, next) ? order : next;
}

function setMissing(fields: Order["missing_fields"], path: string, filled: boolean): Order["missing_fields"] {
  const has = fields.some((field) => field === path);
  if (filled) {
    if (!has) return fields;
    return fields.filter((field) => field !== path);
  }
  if (has) return fields;
  return [...fields, path as Order["missing_fields"][number]];
}

function sameOrder(left: Order, right: Order): boolean {
  return (
    left.customer_name === right.customer_name &&
    left.currency === right.currency &&
    left.delivery_city === right.delivery_city &&
    left.delivery_district === right.delivery_district &&
    left.delivery_address === right.delivery_address &&
    left.delivery_date === right.delivery_date &&
    left.payment_method === right.payment_method &&
    left.notes === right.notes &&
    left.language === right.language &&
    left.confidence === right.confidence &&
    JSON.stringify(left.items) === JSON.stringify(right.items) &&
    left.missing_fields.length === right.missing_fields.length &&
    left.missing_fields.every((field, index) => field === right.missing_fields[index])
  );
}
