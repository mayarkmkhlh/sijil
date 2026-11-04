import type { FulfillmentStatus, Order, PaymentStatus } from "@sijil/shared";
import { getJson, HttpError, patchJson, postJson } from "../../lib/http/http.js";

export type PublicMessage = {
  id: string;
  author: "customer" | "seller";
  text: string;
  sentAt: string;
};

export type LiveThread = {
  id: string;
  customerName: string;
  channel?: "shop_link" | "whatsapp";
  preview: string;
  updatedAt: string;
  approved: boolean;
  unread: boolean;
};

export async function loadShop(sellerId: string): Promise<string | null> {
  try {
    const payload = await getJson(`/api/shops/${sellerId}`);
    if (!payload || typeof payload !== "object" || !("shopName" in payload)) return null;
    return String((payload as { shopName: unknown }).shopName);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}

export async function sendShopMessage(
  sellerId: string,
  input: { customerName: string; body: string; threadId: string | null },
): Promise<{ threadId: string; messages: PublicMessage[] }> {
  const payload = await postJson(`/api/shops/${sellerId}/messages`, input);
  return payload as { threadId: string; messages: PublicMessage[] };
}

export async function loadShopMessages(
  sellerId: string,
  threadId: string,
): Promise<{ messages: PublicMessage[]; approved: boolean } | null> {
  try {
    const payload = await getJson(`/api/shops/${sellerId}/threads/${threadId}`);
    if (!payload || typeof payload !== "object" || !("messages" in payload)) return null;
    const body = payload as { messages: PublicMessage[]; approved?: boolean };
    return { messages: body.messages, approved: body.approved === true };
  } catch {
    return null;
  }
}

export async function loadThreads(): Promise<LiveThread[]> {
  const payload = await getJson("/api/threads");
  if (!payload || typeof payload !== "object" || !("threads" in payload)) return [];
  return (payload as { threads: LiveThread[] }).threads;
}

export type ShopOrder = {
  id: string;
  orderNumber: string;
  threadId: string | null;
  customerName: string;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  paymentMethod: Order["payment_method"];
  currency: Order["currency"];
  total: number | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  fulfilledAt: string | null;
  order: Order;
  messages?: PublicMessage[];
};

export async function loadThreadMessages(
  threadId: string,
  markRead = false,
): Promise<{ messages: PublicMessage[]; order: Order | null; shopOrder: ShopOrder | null }> {
  const payload = await getJson(`/api/threads/${threadId}${markRead ? "?read=1" : ""}`);
  if (!payload || typeof payload !== "object" || !("messages" in payload)) {
    return { messages: [], order: null, shopOrder: null };
  }
  const body = payload as { messages: PublicMessage[]; order?: Order | null; shopOrder?: ShopOrder | null };
  return { messages: body.messages, order: body.order ?? null, shopOrder: body.shopOrder ?? null };
}

export async function sendSellerReply(threadId: string, body: string): Promise<PublicMessage[]> {
  const payload = await postJson(`/api/threads/${threadId}/messages`, { body });
  if (!payload || typeof payload !== "object" || !("messages" in payload)) return [];
  return (payload as { messages: PublicMessage[] }).messages;
}

export async function loadShopOrders(): Promise<ShopOrder[]> {
  const payload = await getJson("/api/orders");
  if (!payload || typeof payload !== "object" || !("orders" in payload)) return [];
  return (payload as { orders: ShopOrder[] }).orders;
}

export async function loadShopOrder(orderId: string): Promise<ShopOrder | null> {
  try {
    const payload = await getJson(`/api/orders/${orderId}`);
    if (!payload || typeof payload !== "object" || !("order" in payload)) return null;
    return (payload as { order: ShopOrder }).order;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}

export async function updateShopOrderStatus(
  orderId: string,
  change: { paymentStatus?: PaymentStatus; fulfillmentStatus?: FulfillmentStatus },
): Promise<ShopOrder> {
  const payload = await patchJson(`/api/orders/${orderId}`, change);
  return (payload as { order: ShopOrder }).order;
}

export async function saveApprovedOrder(input: {
  threadId: string;
  customerName: string;
  order: unknown;
}): Promise<ShopOrder> {
  const payload = await postJson("/api/orders", input);
  return (payload as { order: ShopOrder }).order;
}
