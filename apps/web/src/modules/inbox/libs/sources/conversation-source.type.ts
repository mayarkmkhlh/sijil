import type { Conversation } from "../types/conversation.type.js";
import type { Message } from "../types/message.type.js";

/** Where a conversation list comes from. The simulated source stands in until a channel is connected. */
export interface ConversationSource {
  list(): readonly Conversation[];
  messagesOf(conversationId: string): readonly Message[];
}
