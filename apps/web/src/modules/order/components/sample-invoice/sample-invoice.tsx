import type { Order } from "@sijil/shared";
import type { Copy } from "../../../../hooks/use-language/copy.js";
import { formatMoney, formatUnitPrice } from "../../../../lib/helpers/format-money.js";
import { deriveTotal, lineTotal } from "../../libs/helpers/derive-total.helper.js";

export function SampleInvoice({ order, copy }: { order: Order; copy: Copy }) {
  const currency = order.currency ?? "SAR";
  const total = deriveTotal(order.items);

  return (
    <aside className="sample-invoice">
      <p className="sample-kicker">{copy.sampleKicker}</p>
      <h3>{copy.sampleInvoice}</h3>
      <p className="sample-note">{copy.sampleInvoiceNote}</p>
      <p className="sample-to">
        <span>{copy.sampleBillTo}</span> {order.customer_name ?? copy.missing}
      </p>
      <ul className="sample-lines">
        {order.items.map((item, index) => {
          const amount = lineTotal(item);
          return (
            <li key={`${item.name ?? "item"}-${index}`}>
              <span>{item.name ?? copy.missing}</span>
              <span>
                {item.qty ?? "—"} × {item.unit_price === null ? "—" : formatUnitPrice(item.unit_price)}
              </span>
              <span>{amount === null ? "—" : formatMoney(amount, currency)}</span>
            </li>
          );
        })}
      </ul>
      <p className="sample-total">
        <span>{copy.total}</span>
        <span>{total === null ? "—" : formatMoney(total, currency)}</span>
      </p>
      {order.payment_method ? <p className="sample-pay">{copy.payments[order.payment_method]}</p> : null}
    </aside>
  );
}
