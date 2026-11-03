export type MessageAuthor = "customer" | "seller";

export type Message = {
  id: string;
  conversationId: string;
  author: MessageAuthor;
  text: string;
  sentAt: string;
};
