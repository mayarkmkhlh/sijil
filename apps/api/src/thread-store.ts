import { OrderSchema } from "@sijil/shared";
import { pool } from "./db.js";

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export type ThreadSummary = {
  id: string;
  customerName: string;
  channel: "shop_link" | "whatsapp";
  preview: string;
  updatedAt: string;
  approved: boolean;
  unread: boolean;
};

export type ThreadMessage = {
  id: string;
  author: "customer" | "seller";
  text: string;
  sentAt: string;
};

export async function shopName(sellerId: string): Promise<string | null> {
  const result = await pool.query<{ shop_name: string }>(`select shop_name from sellers where id = $1`, [
    sellerId,
  ]);
  return result.rows[0]?.shop_name ?? null;
}

export async function postCustomerMessage(input: {
  sellerId: string;
  threadId: string | null;
  customerName: string;
  body: string;
}): Promise<{ threadId: string; messages: ThreadMessage[] } | null> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    let threadId = input.threadId;
    if (threadId) {
      const owned = await client.query(`select id from threads where id = $1 and seller_id = $2`, [
        threadId,
        input.sellerId,
      ]);
      if (!owned.rows[0]) threadId = null;
    }
    if (!threadId) {
      const created = await client.query<{ id: string }>(
        `insert into threads (seller_id, customer_name) values ($1, $2) returning id`,
        [input.sellerId, input.customerName],
      );
      threadId = created.rows[0]?.id ?? null;
    }
    if (!threadId) {
      await client.query("rollback");
      return null;
    }
    await client.query(
      `insert into thread_messages (thread_id, author, body) values ($1, 'customer', $2)`,
      [threadId, input.body],
    );
    await client.query(`update threads set updated_at = now(), customer_name = $2 where id = $1`, [
      threadId,
      input.customerName,
    ]);
    await client.query("commit");
    const messages = await listMessages(input.sellerId, threadId);
    return messages ? { threadId, messages } : null;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function ingestWhatsAppMessage(input: {
  sellerId: string;
  customerPhone: string;
  customerName: string;
  body: string;
  waMessageId: string;
}): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const thread = await client.query<{ id: string }>(
      `insert into threads (seller_id, customer_name, channel, customer_phone)
       values ($1, $2, 'whatsapp', $3)
       on conflict (seller_id, customer_phone) where customer_phone is not null
       do update set customer_name = excluded.customer_name, updated_at = now()
       returning id`,
      [input.sellerId, input.customerName, input.customerPhone],
    );
    const threadId = thread.rows[0]?.id;
    if (!threadId) {
      await client.query("rollback");
      return;
    }
    const inserted = await client.query(
      `insert into thread_messages (thread_id, author, body, wa_message_id)
       values ($1, 'customer', $2, $3)
       on conflict (wa_message_id) where wa_message_id is not null
       do nothing
       returning id`,
      [threadId, input.body, input.waMessageId],
    );
    if (inserted.rows[0]) {
      await client.query(`update threads set updated_at = now() where id = $1`, [threadId]);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function whatsAppRecipient(sellerId: string, threadId: string): Promise<string | null> {
  const result = await pool.query<{ customer_phone: string | null }>(
    `select customer_phone from threads where id = $1 and seller_id = $2 and channel = 'whatsapp'`,
    [threadId, sellerId],
  );
  return result.rows[0]?.customer_phone ?? null;
}

export async function listThreads(sellerId: string): Promise<ThreadSummary[]> {
  const result = await pool.query<{
    id: string;
    customer_name: string;
    channel: string;
    preview: string | null;
    updated_at: Date;
    approved: boolean;
    unread: boolean;
  }>(
    `select t.id, t.customer_name, t.channel, t.updated_at,
        (select m.body from thread_messages m where m.thread_id = t.id order by m.created_at desc limit 1) as preview,
        exists(select 1 from shop_orders o where o.thread_id = t.id) as approved,
        exists(
          select 1 from thread_messages m
          where m.thread_id = t.id and m.author = 'customer'
            and (t.seller_read_at is null or m.created_at > t.seller_read_at)
        ) as unread
     from threads t
     where t.seller_id = $1
     order by t.updated_at desc`,
    [sellerId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    customerName: row.customer_name,
    channel: row.channel === "whatsapp" ? "whatsapp" : "shop_link",
    preview: row.preview ?? "",
    updatedAt: row.updated_at.toISOString(),
    approved: row.approved,
    unread: row.unread,
  }));
}

export async function markThreadRead(sellerId: string, threadId: string): Promise<void> {
  await pool.query(`update threads set seller_read_at = now() where id = $1 and seller_id = $2`, [threadId, sellerId]);
}

export async function threadApproved(sellerId: string, threadId: string): Promise<boolean> {
  const result = await pool.query<{ approved: boolean }>(
    `select exists(select 1 from shop_orders where seller_id = $1 and thread_id = $2) as approved`,
    [sellerId, threadId],
  );
  return result.rows[0]?.approved ?? false;
}

export async function postSellerMessage(sellerId: string, threadId: string, body: string): Promise<ThreadMessage[] | null> {
  const owned = await pool.query(`select id from threads where id = $1 and seller_id = $2`, [threadId, sellerId]);
  if (!owned.rows[0]) return null;
  await pool.query(`insert into thread_messages (thread_id, author, body) values ($1, 'seller', $2)`, [threadId, body]);
  await pool.query(`update threads set updated_at = now(), seller_read_at = now() where id = $1`, [threadId]);
  return listMessages(sellerId, threadId);
}

export async function listMessages(sellerId: string, threadId: string): Promise<ThreadMessage[] | null> {
  const owned = await pool.query(`select id from threads where id = $1 and seller_id = $2`, [threadId, sellerId]);
  if (!owned.rows[0]) return null;
  const result = await pool.query<{ id: string; author: string; body: string; created_at: Date }>(
    `select id, author, body, created_at from thread_messages where thread_id = $1 order by created_at`,
    [threadId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    author: row.author === "seller" ? "seller" : "customer",
    text: row.body,
    sentAt: row.created_at.toISOString(),
  }));
}

export async function latestOrder(sellerId: string, threadId: string): Promise<unknown | null> {
  const result = await pool.query<{ order_json: unknown }>(
    `select order_json from shop_orders where seller_id = $1 and thread_id = $2 order by created_at desc limit 1`,
    [sellerId, threadId],
  );
  const value = result.rows[0]?.order_json;
  if (value == null) return null;
  const raw = typeof value === "string" ? safeJson(value) : value;
  const parsed = OrderSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

