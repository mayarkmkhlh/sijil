import {
  OrderSchema,
  canSetFulfillment,
  canSetPayment,
  isFulfillmentStatus,
  isPaymentStatus,
  type FulfillmentStatus,
  type Order,
  type PaymentStatus,
} from "@sijil/shared";
import { pool } from "./db.js";
import { listMessages, type ThreadMessage } from "./thread-store.js";

export type ShopOrderView = {
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
};

export type ShopOrderDetail = ShopOrderView & { messages: ThreadMessage[] };

type OrderRow = {
  id: string;
  order_number: string;
  thread_id: string | null;
  customer_name: string;
  order_json: unknown;
  payment_status: string;
  fulfillment_status: string;
  created_at: Date;
  updated_at: Date;
  paid_at: Date | null;
  fulfilled_at: Date | null;
};

const orderColumns = `id, order_number, thread_id, customer_name, order_json, payment_status, fulfillment_status, created_at, updated_at, paid_at, fulfilled_at`;

function money(order: Order): number | null {
  let sum = 0;
  for (const item of order.items) {
    if (item.qty === null || item.unit_price === null) return null;
    sum = Math.round((sum + item.qty * item.unit_price + Number.EPSILON) * 100) / 100;
  }
  return sum;
}

function readOrder(value: unknown): Order | null {
  const raw = typeof value === "string" ? safeJson(value) : value;
  const parsed = OrderSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toView(row: OrderRow): ShopOrderView | null {
  const order = readOrder(row.order_json);
  if (!order || !isPaymentStatus(row.payment_status) || !isFulfillmentStatus(row.fulfillment_status)) return null;
  return {
    id: row.id,
    orderNumber: row.order_number,
    threadId: row.thread_id,
    customerName: row.customer_name,
    paymentStatus: row.payment_status,
    fulfillmentStatus: row.fulfillment_status,
    paymentMethod: order.payment_method,
    currency: order.currency,
    total: money(order),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    paidAt: row.paid_at?.toISOString() ?? null,
    fulfilledAt: row.fulfilled_at?.toISOString() ?? null,
    order,
  };
}

export async function saveShopOrder(input: {
  sellerId: string;
  threadId: string;
  customerName: string;
  order: Order;
}): Promise<ShopOrderView | null> {
  const owned = await pool.query(`select id from threads where id = $1 and seller_id = $2`, [
    input.threadId,
    input.sellerId,
  ]);
  if (!owned.rows[0]) return null;
  const result = await pool.query<OrderRow>(
    `insert into shop_orders (seller_id, thread_id, customer_name, order_json, order_number)
     values ($1, $2, $3, $4::jsonb, 'SJ-' || nextval('shop_order_number_seq')::text)
     returning ${orderColumns}`,
    [input.sellerId, input.threadId, input.customerName, JSON.stringify(input.order)],
  );
  const row = result.rows[0];
  return row ? toView(row) : null;
}

export async function listShopOrders(sellerId: string): Promise<ShopOrderView[]> {
  const result = await pool.query<OrderRow>(
    `select ${orderColumns} from shop_orders where seller_id = $1 order by created_at desc`,
    [sellerId],
  );
  return result.rows.flatMap((row) => {
    const view = toView(row);
    return view ? [view] : [];
  });
}

export async function shopOrderForThread(sellerId: string, threadId: string): Promise<ShopOrderView | null> {
  const result = await pool.query<OrderRow>(
    `select ${orderColumns} from shop_orders where seller_id = $1 and thread_id = $2 order by created_at desc limit 1`,
    [sellerId, threadId],
  );
  const row = result.rows[0];
  return row ? toView(row) : null;
}

export async function getShopOrder(sellerId: string, orderId: string): Promise<ShopOrderDetail | null> {
  const result = await pool.query<OrderRow>(
    `select ${orderColumns} from shop_orders where id = $1 and seller_id = $2`,
    [orderId, sellerId],
  );
  const view = result.rows[0] ? toView(result.rows[0]) : null;
  if (!view) return null;
  const messages = view.threadId ? ((await listMessages(sellerId, view.threadId)) ?? []) : [];
  return { ...view, messages };
}

export async function updateShopOrder(input: {
  sellerId: string;
  orderId: string;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
}): Promise<{ kind: "ok"; order: ShopOrderDetail } | { kind: "missing" } | { kind: "rejected" }> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const current = await client.query<OrderRow>(
      `select ${orderColumns} from shop_orders where id = $1 and seller_id = $2 for update`,
      [input.orderId, input.sellerId],
    );
    const row = current.rows[0];
    if (!row || !isPaymentStatus(row.payment_status) || !isFulfillmentStatus(row.fulfillment_status)) {
      await client.query("rollback");
      return { kind: "missing" };
    }
    if (input.paymentStatus && !canSetPayment(row.payment_status, input.paymentStatus)) {
      await client.query("rollback");
      return { kind: "rejected" };
    }
    if (input.fulfillmentStatus && !canSetFulfillment(row.fulfillment_status, input.fulfillmentStatus)) {
      await client.query("rollback");
      return { kind: "rejected" };
    }
    const paymentStatus = input.paymentStatus ?? row.payment_status;
    const fulfillmentStatus = input.fulfillmentStatus ?? row.fulfillment_status;
    const paidAt = paymentStatus === "paid" && row.payment_status !== "paid" ? new Date() : row.paid_at;
    const fulfilledAt =
      fulfillmentStatus === "delivered" && row.fulfillment_status !== "delivered" ? new Date() : row.fulfilled_at;
    await client.query(
      `update shop_orders
       set payment_status = $3, fulfillment_status = $4, paid_at = $5, fulfilled_at = $6, updated_at = now()
       where id = $1 and seller_id = $2`,
      [input.orderId, input.sellerId, paymentStatus, fulfillmentStatus, paidAt, fulfilledAt],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  const order = await getShopOrder(input.sellerId, input.orderId);
  return order ? { kind: "ok", order } : { kind: "missing" };
}
