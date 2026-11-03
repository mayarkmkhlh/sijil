import type { Order } from "@sijil/shared";
import type { Channel } from "../../../../lib/enums/channel.js";

export type ConversationStatus = "new" | "incomplete" | "ready" | "approved";

export type Conversation = {
  id: string;
  customerName: string;
  channel: Channel;
  chatLanguage: Order["language"];
  preview: string;
  updatedAt: string;
  chatDate: string;
};
