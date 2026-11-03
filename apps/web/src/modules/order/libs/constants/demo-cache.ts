import type { ItemReview, Order } from "@sijil/shared";
import raw from "./demo-cache.json" with { type: "json" };

/** A real extract saved for the demo. Shown only after a timeout, and labelled as cached. */
export type CachedExtract =
  | { kind: "order"; order: Order; reviews: ItemReview[] }
  | { kind: "no_order"; reason: string };

const cache = raw as Record<string, CachedExtract>;

export function demoFallback(conversationId: string): CachedExtract | null {
  return cache[conversationId] ?? null;
}
