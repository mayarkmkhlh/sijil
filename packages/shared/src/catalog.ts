import { deriveMissingFields, type Item, type Order } from "./order.js";

/** Fictional catalog for Reem's Sweets. Prices are SAR. The model never assigns these ids. */
export type CatalogItem = {
  id: string;
  name: string;
  aliases: readonly string[];
  price: number;
};

export const catalog: readonly CatalogItem[] = [
  { id: "cake-chocolate", name: "كيكة شوكولاتة", aliases: ["كيك شوكولاتة", "chocolate cake"], price: 120 },
  { id: "cookies", name: "كوكيز", aliases: ["cookies", "علبة كوكيز"], price: 45 },
  { id: "maamoul", name: "معمول", aliases: ["date-filled maamoul", "maamoul", "معمول تمر"], price: 60 },
  { id: "saffron-tea", name: "شاي زعفران", aliases: ["saffron tea"], price: 35 },
  { id: "sukkari-dates", name: "تمر سكري", aliases: ["سكري فاخر", "sukkari dates"], price: 150 },
  { id: "ceramic-cup", name: "كوب سيراميك", aliases: ["ceramic cup"], price: 30 },
  { id: "plates", name: "صحون", aliases: ["plates", "صحون تقديم"], price: 30 },
  { id: "baklava", name: "بقلاوة", aliases: ["baklava"], price: 40 },
];

export type ItemReview = {
  status: "matched" | "unknown" | "price_mismatch";
  catalogId: string | null;
  catalogName: string | null;
  catalogPrice: number | null;
  quotedPrice: number | null;
};

const unknownReview: ItemReview = {
  status: "unknown",
  catalogId: null,
  catalogName: null,
  catalogPrice: null,
  quotedPrice: null,
};

const alef = /[أإآ]/g;
const diacritics = /[\u064B-\u065F\u0670\u0640]/g;
const digits = "٠١٢٣٤٥٦٧٨٩";

function normalize(value: string): string {
  const asciiDigits = value.replace(/[٠-٩]/g, (digit) => String(digits.indexOf(digit)));
  return asciiDigits
    .normalize("NFKC")
    .replace(diacritics, "")
    .replace(alef, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Longest catalog name or alias contained in the extracted name. */
export function matchCatalog(name: string, items: readonly CatalogItem[] = catalog): CatalogItem | null {
  const query = normalize(name);
  if (!query) return null;

  let best: { item: CatalogItem; length: number } | null = null;
  for (const item of items) {
    for (const candidate of [item.name, ...item.aliases].map(normalize).filter((value) => value.length >= 3)) {
      if (query !== candidate && !query.includes(candidate)) continue;
      if (!best || candidate.length > best.length) best = { item, length: candidate.length };
    }
  }
  return best?.item ?? null;
}

function samePrice(quoted: number, listed: number): boolean {
  return Math.round(quoted * 100) === Math.round(listed * 100);
}

/** The model proposes a name and a price. This decides matched, unknown, or a price that disagrees. */
export function reviewItem(
  name: string | null,
  unitPrice: number | null,
  items: readonly CatalogItem[] = catalog,
): ItemReview {
  if (!name) return unknownReview;
  const match = matchCatalog(name, items);
  if (!match) return { ...unknownReview, quotedPrice: unitPrice };
  const review = {
    catalogId: match.id,
    catalogName: match.name,
    catalogPrice: match.price,
    quotedPrice: unitPrice,
  };
  if (unitPrice === null || samePrice(unitPrice, match.price)) {
    return { status: "matched", ...review };
  }
  return { status: "price_mismatch", ...review };
}

export function reviewItems(
  items: readonly Item[],
  catalogItems: readonly CatalogItem[] = catalog,
): ItemReview[] {
  return items.map((item) => reviewItem(item.name, item.unit_price, catalogItems));
}

/** The catalog price replaces a missing price and a price the chat invented. Unknown lines stay untouched. */
export function applyCatalog(
  order: Order,
  catalogItems: readonly CatalogItem[] = catalog,
): { order: Order; reviews: ItemReview[] } {
  const reviews = reviewItems(order.items, catalogItems);
  const items = order.items.map((item, index) => {
    const review = reviews[index];
    if (!review || review.catalogPrice === null || review.status === "unknown") return item;
    if (item.unit_price !== null && samePrice(item.unit_price, review.catalogPrice)) return item;
    return { ...item, unit_price: review.catalogPrice };
  });
  if (items.every((item, index) => item === order.items[index])) return { order, reviews };
  const priced: Order = { ...order, items };
  return { order: { ...priced, missing_fields: deriveMissingFields(priced) }, reviews };
}
