import { currencySchema, paymentMethodSchema, type ItemReview, type Order } from "@sijil/shared";
import { Button } from "../../../../components/button/button.js";
import { Heading } from "../../../../components/heading/heading.js";
import type { Copy } from "../../../../hooks/use-language/copy.js";
import { formatAmount } from "../../../../lib/helpers/format-money.js";
import { deriveTotal } from "../../libs/helpers/derive-total.helper.js";
import { editOrder } from "../../libs/helpers/edit-order.helper.js";
import { askFieldKeys, type AskField } from "../../libs/helpers/missing-ask.helper.js";
import { missingFieldLabel } from "../../libs/helpers/missing-field-label.helper.js";
import type { ExtractState } from "../../libs/types/extract-state.type.js";
import { AskDraft } from "../ask-draft/ask-draft.js";
import { ApproveBar } from "../approve-bar/approve-bar.js";
import { SampleInvoice } from "../sample-invoice/sample-invoice.js";
import { EmptyState } from "../extract-states/empty-state.js";
import { ErrorState } from "../extract-states/error-state.js";
import { LoadingState } from "../extract-states/loading-state.js";
import { NotAnOrderState } from "../extract-states/not-an-order-state.js";
import { MissingFieldRow } from "../missing-field-row/missing-field-row.js";
import { OrderFieldRow } from "../order-field-row/order-field-row.js";
import { OrderItemsTable } from "../order-items-table/order-items-table.js";
import { OrderStamp } from "../order-stamp/order-stamp.js";
import { OrderTotals } from "../order-totals/order-totals.js";
import { SlipNumberInput } from "../slip-input/slip-input.js";
import { TrustStrip } from "../trust-strip/trust-strip.js";

const itemPath =
  /^items\.(\d+)\.(name|qty|unit_price|variant|variant\.size|variant\.colour|variant\.text)$/;

export function OrderSlip({
  state,
  approved,
  model,
  copy,
  onApprove,
  onRetry,
  onEdit,
  onUseReply,
  savedOrder,
  onViewOrder,
  approveBlocked = false,
}: {
  state: ExtractState;
  approved: boolean;
  model: string | null;
  copy: Copy;
  onApprove: () => void;
  onRetry: () => void;
  onEdit: (order: Order) => void;
  onUseReply?: (text: string) => void;
  savedOrder?: { orderNumber: string } | null;
  onViewOrder?: () => void;
  approveBlocked?: boolean;
}) {
  const live = state.status === "order" ? state : null;
  const cachedOrder = state.status === "error" && state.cached?.kind === "order" ? state.cached : null;
  const cachedReason = state.status === "error" && state.cached?.kind === "no_order" ? state.cached.reason : null;
  const order = live?.order ?? cachedOrder?.order ?? null;
  const reviews = live?.reviews ?? cachedOrder?.reviews ?? [];

  return (
    <section className="column order-column" aria-live="polite">
      <article className="slip">
        {state.status === "error" ? (
          <ErrorState httpStatus={state.httpStatus} detail={state.detail} copy={copy} onRetry={onRetry} />
        ) : null}
        {state.status === "error" && state.cached ? <p className="cache-note">{copy.cachedReply}</p> : null}
        {order ? (
          <OrderBody
            order={order}
            reviews={reviews}
            approved={approved}
            copy={copy}
            onEdit={onEdit}
            onUseReply={onUseReply}
          />
        ) : null}
        {state.status === "idle" ? <EmptyState copy={copy} /> : null}
        {state.status === "loading" ? <LoadingState copy={copy} /> : null}
        {state.status === "no_order" || cachedReason ? (
          <NotAnOrderState reason={state.status === "no_order" ? state.reason : (cachedReason ?? "")} copy={copy} />
        ) : null}
      </article>
      {live ? (
        <>
          <TrustStrip meta={live.meta} confidence={live.order.confidence} model={model} copy={copy} />
          <ApproveBar
            approved={approved}
            blocked={approveBlocked}
            orderJson={JSON.stringify({ ...live.order, item_reviews: live.reviews }, null, 2)}
            copy={copy}
            onApprove={onApprove}
          />
        </>
      ) : null}
      {cachedOrder ? (
        <ApproveBar
          approved={approved}
          blocked={approveBlocked}
          orderJson={JSON.stringify({ ...cachedOrder.order, item_reviews: cachedOrder.reviews, cached: true }, null, 2)}
          copy={copy}
          onApprove={onApprove}
        />
      ) : null}
      {savedOrder ? (
        <div className="order-created no-print">
          <p className="order-created-number">{copy.orderCreated(savedOrder.orderNumber)}</p>
          <p>{copy.orderSaved}</p>
          <div className="order-created-actions">
            <Button onClick={onViewOrder}>{copy.viewOrder}</Button>
            <Button variant="ghost" onClick={onViewOrder}>
              {copy.viewConfirmation}
            </Button>
          </div>
        </div>
      ) : null}
      {approved && order && !savedOrder ? <SampleInvoice order={order} copy={copy} /> : null}
    </section>
  );
}

function OrderBody({
  order,
  reviews,
  approved,
  copy,
  onEdit,
  onUseReply,
}: {
  order: Order;
  reviews: readonly ItemReview[];
  approved: boolean;
  copy: Copy;
  onEdit: (order: Order) => void;
  onUseReply?: (text: string) => void;
}) {
  const total = deriveTotal(order.items);
  const stamp = approved
    ? copy.status.approved
    : order.missing_fields.length > 0
      ? copy.waiting
      : copy.ready;

  function commit(path: string, value: string | number | null) {
    onEdit(editOrder(order, path, value));
  }

  return (
    <>
      <header className="slip-head">
        <Heading level={2}>{copy.slipTitle}</Heading>
        <OrderStamp>{stamp}</OrderStamp>
      </header>
      <div className="slip-fields">
        {askFieldKeys.map((key) => (
          <OrderFieldRow
            key={key}
            label={copy.fields[key]}
            missing={isMissing(order, key)}
            missingLabel={copy.missing}
          >
            <AskControl order={order} field={key} copy={copy} onCommit={commit} />
          </OrderFieldRow>
        ))}
        <OrderFieldRow
          label={copy.currency}
          missing={isMissing(order, "currency")}
          missingLabel={copy.missing}
        >
          <select
            className="slip-select"
            aria-label={copy.currency}
            value={order.currency ?? ""}
            onChange={(event) => commit("currency", event.target.value)}
          >
            <option value="">{copy.missing}</option>
            {currencySchema.options.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </OrderFieldRow>
        {extraPaths(order).map((path) =>
          path === "items" ? (
            <MissingFieldRow key={path} label={copy.itemsMissing} missingLabel={copy.missing} />
          ) : (
            <OrderFieldRow
              key={path}
              label={missingFieldLabel(path, copy)}
              missing={isMissing(order, path)}
              missingLabel={copy.missing}
            >
              <ExtraControl order={order} path={path} copy={copy} onCommit={commit} />
            </OrderFieldRow>
          ),
        )}
      </div>
      <OrderItemsTable
        items={order.items}
        columns={copy.columns}
        missingLabel={copy.missing}
        copy={copy}
        reviews={reviews}
        isMissing={(path) => isMissing(order, path)}
        onEdit={commit}
      />
      <OrderTotals
        label={copy.total}
        note={copy.totalNote}
        amount={total === null ? null : formatAmount(total)}
        currency={order.currency}
      />
      <AskDraft order={order} copy={copy} onUse={onUseReply} />
    </>
  );
}

function AskControl({
  order,
  field,
  copy,
  onCommit,
}: {
  order: Order;
  field: AskField;
  copy: Copy;
  onCommit: (path: string, value: string | number | null) => void;
}) {
  if (field === "payment_method") {
    return (
      <select
        className="slip-select"
        aria-label={copy.fields.payment_method}
        value={order.payment_method ?? ""}
        onChange={(event) => onCommit(field, event.target.value)}
      >
        <option value="">{copy.missing}</option>
        {paymentMethodSchema.options.map((method) => (
          <option key={method} value={method}>
            {copy.payments[method]}
          </option>
        ))}
      </select>
    );
  }
  if (field === "delivery_date") {
    return (
      <input
        className="slip-input"
        type="date"
        aria-label={copy.fields.delivery_date}
        value={order.delivery_date ?? ""}
        onChange={(event) => onCommit(field, event.target.value)}
      />
    );
  }
  return (
    <input
      className="slip-input"
      dir="auto"
      aria-label={copy.fields[field]}
      value={order[field] ?? ""}
      onChange={(event) => onCommit(field, event.target.value)}
    />
  );
}

function ExtraControl({
  order,
  path,
  copy,
  onCommit,
}: {
  order: Order;
  path: string;
  copy: Copy;
  onCommit: (path: string, value: string | number | null) => void;
}) {
  const match = itemPath.exec(path);
  const label = missingFieldLabel(path, copy);
  if (!match) return null;
  const index = Number(match[1]);
  const suffix = match[2];
  const item = order.items[index];
  if (!item) return null;
  if (suffix === "qty") {
    return (
      <SlipNumberInput
        value={item.qty}
        allowDecimal={false}
        label={label}
        onCommit={(next) => onCommit(path, next)}
      />
    );
  }
  if (suffix === "unit_price") {
    return (
      <SlipNumberInput
        value={item.unit_price}
        allowDecimal
        label={label}
        onCommit={(next) => onCommit(path, next)}
      />
    );
  }
  const text =
    suffix === "name"
      ? (item.name ?? "")
      : suffix === "variant"
        ? (item.variant?.text ?? "")
        : suffix === "variant.size"
          ? (item.variant?.size ?? "")
          : suffix === "variant.colour"
            ? (item.variant?.colour ?? "")
            : (item.variant?.text ?? "");
  return (
    <input
      className="slip-input"
      dir="auto"
      aria-label={label}
      value={text}
      onChange={(event) => onCommit(path, event.target.value)}
    />
  );
}

function extraPaths(order: Order): string[] {
  const paths: string[] = [];
  if (isMissing(order, "items")) paths.push("items");
  order.items.forEach((item, index) => {
    const parent = `items.${index}.variant`;
    const parts = [
      ["size", item.variant?.size ?? null],
      ["colour", item.variant?.colour ?? null],
      ["text", item.variant?.text ?? null],
    ] as const;
    const anySubListed = parts.some(([part]) => isMissing(order, `items.${index}.variant.${part}`));
    if (anySubListed || (item.variant !== null && (item.variant.size || item.variant.colour))) {
      for (const [part, value] of parts) {
        const path = `items.${index}.variant.${part}`;
        if (isMissing(order, path) || value) paths.push(path);
      }
      return;
    }
    if (isMissing(order, parent) || item.variant?.text) paths.push(parent);
  });
  for (const path of order.missing_fields) {
    if (path === "items" || path.startsWith("items.")) continue;
    if ((askFieldKeys as readonly string[]).includes(path) || path === "currency") continue;
    paths.push(path);
  }
  return paths;
}

function isMissing(order: Order, path: string): boolean {
  return order.missing_fields.some((field) => field === path);
}
