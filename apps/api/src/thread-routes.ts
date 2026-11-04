import type { Hono } from "hono";
import { OrderSchema, fulfillmentStatuses, paymentStatuses } from "@sijil/shared";
import { z } from "zod";
import { clientIp } from "./extract-guard.js";
import { sellerForRequest } from "./seller-routes.js";
import {
  latestOrder,
  listMessages,
  listThreads,
  markThreadRead,
  postCustomerMessage,
  postSellerMessage,
  shopName,
  threadApproved,
} from "./thread-store.js";
import { getShopOrder, listShopOrders, saveShopOrder, shopOrderForThread, updateShopOrder } from "./order-store.js";

const messageSchema = z.object({
  customerName: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(2_000),
  threadId: z.string().uuid().nullable().optional(),
});

const hits = new Map<string, { start: number; count: number }>();

function allowMessage(ip: string): boolean {
  const now = Date.now();
  const row = hits.get(ip);
  if (!row || now - row.start > 60 * 60 * 1000) {
    hits.set(ip, { start: now, count: 1 });
    return true;
  }
  if (row.count >= 30) return false;
  row.count += 1;
  return true;
}

export function mountThreads(app: Hono) {
  app.get("/api/shops/:id", async (c) => {
    const id = c.req.param("id");
    if (!z.string().uuid().safeParse(id).success) return c.json({ error: "Shop not found." }, 404);
    try {
      const name = await shopName(id);
      if (!name) return c.json({ error: "Shop not found." }, 404);
      return c.json({ shopName: name });
    } catch {
      return c.json({ error: "The shop database is not ready." }, 503);
    }
  });

  app.get("/api/shops/:id/threads/:threadId", async (c) => {
    const sellerId = c.req.param("id");
    const threadId = c.req.param("threadId");
    if (!z.string().uuid().safeParse(sellerId).success || !z.string().uuid().safeParse(threadId).success) {
      return c.json({ error: "Not found." }, 404);
    }
    const messages = await listMessages(sellerId, threadId);
    if (!messages) return c.json({ error: "Not found." }, 404);
    return c.json({ messages, approved: await threadApproved(sellerId, threadId) });
  });

  app.post("/api/shops/:id/messages", async (c) => {
    const sellerId = c.req.param("id");
    if (!z.string().uuid().safeParse(sellerId).success) return c.json({ error: "Shop not found." }, 404);
    if (!allowMessage(clientIp(c.req.header("x-forwarded-for")))) {
      return c.json({ error: "Too many messages from this address. Try later." }, 429);
    }
    const parsed = messageSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Write your name and a message." }, 400);
    if (!(await shopName(sellerId))) return c.json({ error: "Shop not found." }, 404);
    const saved = await postCustomerMessage({
      sellerId,
      threadId: parsed.data.threadId ?? null,
      customerName: parsed.data.customerName,
      body: parsed.data.body,
    });
    if (!saved) return c.json({ error: "Shop not found." }, 404);
    return c.json(saved);
  });

  app.get("/api/threads", async (c) => {
    const seller = await sellerForRequest(c.req.header("cookie"));
    if (!seller) return c.json({ error: "Log in first." }, 401);
    return c.json({ threads: await listThreads(seller.id) });
  });

  app.get("/api/threads/:id", async (c) => {
    const seller = await sellerForRequest(c.req.header("cookie"));
    if (!seller) return c.json({ error: "Log in first." }, 401);
    const threadId = c.req.param("id");
    if (!z.string().uuid().safeParse(threadId).success) return c.json({ error: "Not found." }, 404);
    const messages = await listMessages(seller.id, threadId);
    if (!messages) return c.json({ error: "Not found." }, 404);
    if (c.req.query("read") === "1") await markThreadRead(seller.id, threadId);
    return c.json({
      messages,
      order: await latestOrder(seller.id, threadId),
      shopOrder: await shopOrderForThread(seller.id, threadId),
    });
  });

  app.post("/api/threads/:id/messages", async (c) => {
    const seller = await sellerForRequest(c.req.header("cookie"));
    if (!seller) return c.json({ error: "Log in first." }, 401);
    const body = z.object({ body: z.string().trim().min(1).max(2_000) }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Write a reply." }, 400);
    if (!z.string().uuid().safeParse(c.req.param("id")).success) return c.json({ error: "That chat is not in this shop." }, 404);
    const messages = await postSellerMessage(seller.id, c.req.param("id"), body.data.body);
    if (!messages) return c.json({ error: "That chat is not in this shop." }, 404);
    return c.json({ messages });
  });

  app.post("/api/orders", async (c) => {
    const seller = await sellerForRequest(c.req.header("cookie"));
    if (!seller) return c.json({ error: "Log in first." }, 401);
    const body = z
      .object({
        threadId: z.string().uuid(),
        customerName: z.string().trim().min(1).max(80),
        order: z.unknown(),
      })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "The order could not be saved." }, 400);
    const order = OrderSchema.safeParse(body.data.order);
    if (!order.success) return c.json({ error: "The order could not be saved." }, 400);
    const saved = await saveShopOrder({
      sellerId: seller.id,
      threadId: body.data.threadId,
      customerName: body.data.customerName,
      order: order.data,
    });
    if (!saved) return c.json({ error: "That chat is not in this shop." }, 404);
    return c.json({ order: saved });
  });

  app.get("/api/orders", async (c) => {
    const seller = await sellerForRequest(c.req.header("cookie"));
    if (!seller) return c.json({ error: "Log in first." }, 401);
    return c.json({ orders: await listShopOrders(seller.id) });
  });

  app.get("/api/orders/:id", async (c) => {
    const seller = await sellerForRequest(c.req.header("cookie"));
    if (!seller) return c.json({ error: "Log in first." }, 401);
    if (!z.string().uuid().safeParse(c.req.param("id")).success) return c.json({ error: "Order not found." }, 404);
    const order = await getShopOrder(seller.id, c.req.param("id"));
    if (!order) return c.json({ error: "Order not found." }, 404);
    return c.json({ order });
  });

  app.patch("/api/orders/:id", async (c) => {
    const seller = await sellerForRequest(c.req.header("cookie"));
    if (!seller) return c.json({ error: "Log in first." }, 401);
    const body = z
      .object({
        paymentStatus: z.enum(paymentStatuses).optional(),
        fulfillmentStatus: z.enum(fulfillmentStatuses).optional(),
      })
      .refine((value) => value.paymentStatus || value.fulfillmentStatus)
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Choose a status." }, 400);
    const updated = await updateShopOrder({
      sellerId: seller.id,
      orderId: c.req.param("id"),
      paymentStatus: body.data.paymentStatus,
      fulfillmentStatus: body.data.fulfillmentStatus,
    });
    if (updated.kind === "missing") return c.json({ error: "Order not found." }, 404);
    if (updated.kind === "rejected") return c.json({ error: "That status change is not allowed." }, 409);
    return c.json({ order: updated.order });
  });
}
