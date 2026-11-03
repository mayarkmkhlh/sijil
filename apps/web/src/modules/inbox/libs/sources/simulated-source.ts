import { conversations, messages } from "../constants/simulated-conversations.js";
import type { ConversationSource } from "./conversation-source.type.js";

export const simulatedSource: ConversationSource = {
  list() {
    return conversations;
  },
  messagesOf(conversationId) {
    return messages.filter((message) => message.conversationId === conversationId);
  },
};
