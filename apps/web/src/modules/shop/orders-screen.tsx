import { useEffect, useState } from "react";
import type { FulfillmentStatus, PaymentStatus } from "@sijil/shared";
import { nextFulfillment, nextPayment } from "@sijil/shared";
import { Button } from "../../components/button/button.js";
import { Heading } from "../../components/heading/heading.js";
import { SegmentedControl } from "../../components/segmented-control/segmented-control.js";
import type { Copy } from "../../hooks/use-language/copy.js";
import { formatConversationTime } from "../../lib/helpers/format-date.js";
import { formatMoney } from "../../lib/helpers/format-money.js";
import { HttpError } from "../../lib/http/http.js";
import type { Language } from "../../lib/types/language.type.js";
import { accountError } from "./account-api.js";
import { loadShopOrder, loadShopOrders, updateShopOrderStatus, type ShopOrder } from "./customer-api.js";

type OrderFilter = "active" | "ship" | "delivered" | "all";

function matches(filter: OrderFilter, status: FulfillmentStatus): boolean {
  if (filter === "all") return true;
  if (filter === "delivered") return status === "delivered";
  if (filter === "ship") return status === "confirmed" || status === "preparing";
  return status === "confirmed" || status === "preparing" || status === "shipped";
}

export function OrdersScreen({
  shopName,
  copy,
  language,
  focusId,
  onFocus,
  onOpenChat,
}: {
  shopName: string;
  copy: Copy;
  language: Language;
  focusId: string | null;
  onFocus: (orderId: string | null) => void;
  onOpenChat: (threadId: string) => void;
}) {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [detail, setDetail] = useState<ShopOrder | null>(null);
  const [detailMissing, setDetailMissing] = useState(false);
  const [filter, setFilter] = useState<OrderFilter>("active");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stop = false;
    void loadShopOrders()
      .then((next) => {
        if (!stop) setOrders(next);
      })
      .catch((caught) => {
        if (!stop) setError(accountError(caught));
      });
    return () => {
      stop = true;
    };
  }, [focusId]);

  useEffect(() => {
    if (!focusId) {
      setDetail(null);
      setDetailMissing(false);
      return;
    }
    setDetailMissing(false);
    let stop = false;
    void loadShopOrder(focusId)
      .then((next) => {
        if (stop) return;
        setDetail(next);
        setDetailMissing(next === null);
      })
      .catch((caught) => {
        if (!stop) setError(accountError(caught));
      });
    return () => {
      stop = true;
    };
  }, [focusId]);

  async function change(update: { paymentStatus?: PaymentStatus; fulfillmentStatus?: FulfillmentStatus }) {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      const next = await updateShopOrderStatus(detail.id, update);
      setDetail(next);
      setOrders((current) => current.map((order) => (order.id === next.id ? { ...order, ...next } : order)));
    } catch (caught) {
      setError(caught instanceof HttpError && caught.status === 409 ? copy.statusRejected : accountError(caught));
    } finally {
      setBusy(false);
    }
  }

  const activeCount = orders.filter((order) => matches("active", order.fulfillmentStatus)).length;
  const shipCount = orders.filter((order) => matches("ship", order.fulfillmentStatus)).length;
  const deliveredCount = orders.filter((order) => matches("delivered", order.fulfillmentStatus)).length;
  const visible = orders.filter((order) => matches(filter, order.fulfillmentStatus));

  if (focusId) {
    return (
      <div className="orders-page">
        <div className="orders-toolbar no-print">
          <Button variant="ghost" onClick={() => onFocus(null)}>
            {copy.backToOrders}
          </Button>
          {detail?.threadId ? (
            <Button variant="ghost" onClick={() => onOpenChat(detail.threadId as string)}>
              {copy.backToChat}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => window.print()}>
            {copy.printConfirmation}
          </Button>
        </div>
        {error ? <p className="auth-error no-print">{error}</p> : null}
        {detailMissing ? <p className="no-print">{copy.orderNotFound}</p> : null}
        {detail ? (
          <>
            <OrderConfirmation shopName={shopName} order={detail} copy={copy} />
            <div className="order-actions no-print">
              {nextFulfillment(detail.fulfillmentStatus).map((status) => (
                <Button key={status} disabled={busy} onClick={() => void change({ fulfillmentStatus: status })}>
                  {copy.fulfillmentAction[status]}
                </Button>
              ))}
              {nextPayment(detail.paymentStatus).map((status) => (
                <Button key={status} variant="ghost" disabled={busy} onClick={() => void change({ paymentStatus: status })}>
                  {status === "paid" ? copy.markPaid : copy.markRefunded}
                </Button>
              ))}
            </div>
            {detail.messages && detail.messages.length > 0 ? (
              <section className="order-chat no-print">
                <Heading level={2}>{copy.originalChat}</Heading>
                <ul>
                  {detail.messages.map((message) => (
                    <li key={message.id} dir="auto">
                      {message.text}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="orders-page">
      <header className="orders-head">
        <Heading level={1}>{copy.ordersTitle}</Heading>
        <p>{copy.ordersLead}</p>
      </header>
      <div className="order-counts">
        <p>
          <strong>{activeCount}</strong> {copy.ordersActive}
        </p>
        <p>
          <strong>{shipCount}</strong> {copy.ordersToShip}
        </p>
        <p>
          <strong>{deliveredCount}</strong> {copy.ordersDelivered}
        </p>
      </div>
      <SegmentedControl
        label={copy.ordersTitle}
        value={filter}
        onChange={setFilter}
        options={[
          { value: "active", label: copy.ordersActive },
          { value: "ship", label: copy.ordersToShip },
          { value: "delivered", label: copy.ordersDelivered },
          { value: "all", label: copy.ordersAll },
        ]}
      />
      {error ? <p className="auth-error">{error}</p> : null}
      {visible.length === 0 ? <p className="shop-note">{copy.ordersEmpty}</p> : null}
      {visible.length > 0 ? (
        <table className="orders-table">
          <thead>
            <tr>
              <th>{copy.ordersColOrder}</th>
              <th>{copy.ordersColTotal}</th>
              <th>{copy.ordersColPayment}</th>
              <th>{copy.ordersColFulfillment}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((order) => (
              <tr key={order.id} onClick={() => onFocus(order.id)}>
                <td>
                  <button type="button" className="order-link" onClick={() => onFocus(order.id)}>
                    {order.orderNumber} {order.customerName}
                  </button>
                  <span className="order-when">{formatConversationTime(order.createdAt, language)}</span>
                </td>
                <td>{order.total === null || !order.currency ? "—" : formatMoney(order.total, order.currency)}</td>
                <td>{copy.paymentState[order.paymentStatus]}</td>
                <td>{copy.fulfillmentState[order.fulfillmentStatus]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

function OrderConfirmation({ shopName, order, copy }: { shopName: string; order: ShopOrder; copy: Copy }) {
  const place = [order.order.delivery_city, order.order.delivery_district, order.order.delivery_address]
    .filter((part): part is string => Boolean(part))
    .join("، ");
  const method = order.paymentMethod ? copy.payments[order.paymentMethod] : null;

  return (
    <article className="order-sheet">
      <p className="order-sheet-shop">{shopName}</p>
      <p className="order-sheet-kicker">{copy.orderConfirmation}</p>
      <h2>
        {copy.orderNumberLabel} {order.orderNumber}
      </h2>
      <p>{order.customerName}</p>
      {place ? <p>{place}</p> : null}
      <ul className="order-sheet-lines">
        {order.order.items.map((item, index) => (
          <li key={`${item.name ?? "item"}-${index}`}>
            <span>{item.name ?? copy.missing}</span>
            <span>
              {item.qty ?? "—"} × {item.unit_price ?? "—"}
            </span>
          </li>
        ))}
      </ul>
      <p className="order-sheet-total">
        <span>{copy.total}</span>
        <span>{order.total === null || !order.currency ? "—" : formatMoney(order.total, order.currency)}</span>
      </p>
      <p>
        {copy.paymentStatusLabel}: {method ? `${method} · ` : ""}
        {copy.paymentState[order.paymentStatus]}
      </p>
      <p>
        {copy.fulfillmentStatusLabel}: {copy.fulfillmentState[order.fulfillmentStatus]}
      </p>
      <p className="order-sheet-note">{copy.confirmationNote}</p>
    </article>
  );
}
