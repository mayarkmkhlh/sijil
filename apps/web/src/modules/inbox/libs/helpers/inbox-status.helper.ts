import type { ExtractState } from "../../../order/libs/types/extract-state.type.js";
import type { ConversationStatus } from "../types/conversation.type.js";

export type InboxFilter = "all" | "new" | "incomplete";

/** Status is decided here. A no-order chat stays unbadged. Approval only comes from the seller. */
export function inboxStatus(approved: boolean, state: ExtractState): ConversationStatus | null {
  if (approved) return "approved";
  if (state.status === "no_order") return null;
  if (state.status !== "order") return "new";
  return state.order.missing_fields.length > 0 ? "incomplete" : "ready";
}

export function matchesInboxFilter(filter: InboxFilter, status: ConversationStatus | null): boolean {
  if (filter === "all") return true;
  if (filter === "new") return status === "new";
  return status === "incomplete";
}
