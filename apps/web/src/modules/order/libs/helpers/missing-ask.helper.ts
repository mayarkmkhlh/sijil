import type { Order } from "@sijil/shared";

export const askFieldKeys = [
  "customer_name",
  "delivery_city",
  "delivery_district",
  "delivery_address",
  "delivery_date",
  "payment_method",
] as const satisfies readonly (keyof Order)[];

export type AskField = (typeof askFieldKeys)[number];

const itemPath =
  /^items\.(\d+)\.(name|qty|unit_price|variant|variant\.size|variant\.colour|variant\.text)$/;

const english: Record<string, string> = {
  customer_name: "your name",
  delivery_city: "the city",
  delivery_district: "the district",
  delivery_address: "the address",
  delivery_date: "the delivery day",
  payment_method: "how you'll pay",
  currency: "the currency",
  items: "the items",
  name: "the item name",
  qty: "the quantity",
  unit_price: "the price",
  variant: "the item details",
  "variant.size": "the size",
  "variant.colour": "the colour",
  "variant.text": "the item note",
};

const gulf: Record<string, string> = {
  customer_name: "الاسم",
  delivery_city: "المدينة",
  delivery_district: "الحي",
  delivery_address: "العنوان",
  delivery_date: "يوم التوصيل",
  payment_method: "طريقة الدفع",
  currency: "العملة",
  items: "الأصناف",
  name: "اسم الصنف",
  qty: "الكمية",
  unit_price: "السعر",
  variant: "تفاصيل الصنف",
  "variant.size": "المقاس",
  "variant.colour": "اللون",
  "variant.text": "الوصف",
};

/** A copyable ask for the gaps only. Null when the order is complete. Nothing is sent. */
export function draftAsk(order: Pick<Order, "language" | "missing_fields">): string | null {
  if (order.missing_fields.length === 0) return null;
  const dialect = order.language === "gulf_ar" || order.language === "msa" ? order.language : "en";
  const words = dialect === "en" ? english : gulf;
  const gaps = [...new Set(order.missing_fields)].map((path) => gapPhrase(path, words, dialect === "en"));
  const list = joinList(gaps, dialect === "en");
  if (dialect === "gulf_ar") return `هلا، ممكن ترسل ${list}؟`;
  if (dialect === "msa") return `مرحباً، هل يمكنك إرسال ${list}؟`;
  return `Hi, could you send ${list}?`;
}

function gapPhrase(path: string, words: Record<string, string>, english: boolean): string {
  const named = words[path];
  if (named) return named;
  const match = itemPath.exec(path);
  if (!match) return path;
  const index = Number(match[1]);
  const word = words[match[2]] ?? path;
  if (index === 0) return word;
  return english ? `${word} for item ${index + 1}` : `${word} للصنف ${index + 1}`;
}

function joinList(items: string[], english: boolean): string {
  if (items.length <= 1) return items[0] ?? "";
  const last = items[items.length - 1];
  const rest = items.slice(0, -1);
  return english ? `${rest.join(", ")} and ${last}` : `${rest.join("، ")} و${last}`;
}
