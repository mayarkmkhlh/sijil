import { reviewItems, type ItemReview, type Order } from "@sijil/shared";
import { errorDetail, HttpError, postJson } from "../../../lib/http/http.js";

export type ExtractCall =
  | { ok: true; kind: "order"; order: Order; reviews: ItemReview[]; attempts: number | null }
  | { ok: true; kind: "no_order"; reason: string; attempts: number | null }
  | { ok: false; status: number; detail: string | null };

export async function requestExtract(chat: string, chatDate: string): Promise<ExtractCall> {
  try {
    const payload = await postJson("/api/extract", { chat, chatDate });
    return readPayload(payload);
  } catch (error) {
    if (error instanceof HttpError) {
      return {
        ok: false,
        status: error.status,
        detail: error.status === 0 ? null : errorDetail(error.payload),
      };
    }
    return { ok: false, status: 0, detail: null };
  }
}

function readPayload(payload: unknown): ExtractCall {
  if (!payload || typeof payload !== "object") return { ok: false, status: 0, detail: null };
  const record = payload as {
    kind?: unknown;
    reason?: unknown;
    attempts?: unknown;
    order?: unknown;
    item_reviews?: unknown;
  };
  const attempts = typeof record.attempts === "number" && Number.isFinite(record.attempts) ? record.attempts : null;
  if (record.kind === "noOrder" && typeof record.reason === "string") {
    return { ok: true, kind: "no_order", reason: record.reason, attempts };
  }
  if (record.kind === "order" && isOrder(record.order)) {
    return { ok: true, kind: "order", order: record.order, reviews: readReviews(record.item_reviews, record.order), attempts };
  }
  return { ok: false, status: 0, detail: null };
}

function readReviews(value: unknown, order: Order): ItemReview[] {
  if (!Array.isArray(value)) return reviewItems(order.items);
  const reviews = value.filter(isReview);
  return reviews.length === order.items.length ? reviews : reviewItems(order.items);
}

function isReview(value: unknown): value is ItemReview {
  if (!value || typeof value !== "object") return false;
  const review = value as ItemReview;
  return (
    (review.status === "matched" || review.status === "unknown" || review.status === "price_mismatch") &&
    (typeof review.catalogPrice === "number" || review.catalogPrice === null) &&
    (typeof review.quotedPrice === "number" || review.quotedPrice === null)
  );
}

function isOrder(value: unknown): value is Order {
  if (!value || typeof value !== "object") return false;
  const order = value as { items?: unknown; customer_name?: unknown; confidence?: unknown; missing_fields?: unknown };
  return (
    Array.isArray(order.items) &&
    Array.isArray(order.missing_fields) &&
    (typeof order.customer_name === "string" || order.customer_name === null) &&
    typeof order.confidence === "number"
  );
}
