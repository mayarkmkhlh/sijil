import { reviewItem, type Item, type ItemReview } from "@sijil/shared";
import type { Copy } from "../../../../hooks/use-language/copy.js";
import { formatAmount } from "../../../../lib/helpers/format-money.js";
import { CatalogChip } from "../../../catalog/components/catalog-chip/catalog-chip.js";
import { lineTotal } from "../../libs/helpers/derive-total.helper.js";
import { SlipNumberInput } from "../slip-input/slip-input.js";

export function OrderItemsTable({
  items,
  columns,
  missingLabel,
  copy,
  reviews,
  isMissing,
  onEdit,
}: {
  items: readonly Item[];
  columns: Copy["columns"];
  missingLabel: string;
  copy: Pick<Copy, "notInCatalog" | "catalogPrice" | "chatSaid">;
  reviews: readonly ItemReview[];
  isMissing: (path: string) => boolean;
  onEdit: (path: string, value: string | number | null) => void;
}) {
  return (
    <table className="items-table">
      <thead>
        <tr>
          <th>{columns.item}</th>
          <th className="num">{columns.qty}</th>
          <th className="num">{columns.price}</th>
          <th className="num">{columns.amount}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, index) => {
          const total = lineTotal(item);
          const namePath = `items.${index}.name`;
          const qtyPath = `items.${index}.qty`;
          const pricePath = `items.${index}.unit_price`;
          return (
            <tr key={index}>
              <td className={isMissing(namePath) ? "cell-missing" : undefined}>
                <span className="cell-edit">
                  <input
                    className="slip-input"
                    dir="auto"
                    aria-label={columns.item}
                    value={item.name ?? ""}
                    onChange={(event) => onEdit(namePath, event.target.value)}
                  />
                  {variantSuffix(item)}
                  <CatalogChip review={reviews[index] ?? reviewItem(item.name, item.unit_price)} copy={copy} />
                  {isMissing(namePath) ? <span className="missing-tag">{missingLabel}</span> : null}
                </span>
              </td>
              <td className={isMissing(qtyPath) ? "num cell-missing" : "num"}>
                <span className="cell-edit">
                  <SlipNumberInput
                    value={item.qty}
                    allowDecimal={false}
                    label={columns.qty}
                    onCommit={(next) => onEdit(qtyPath, next)}
                  />
                  {isMissing(qtyPath) ? <span className="missing-tag">{missingLabel}</span> : null}
                </span>
              </td>
              <td className={isMissing(pricePath) ? "num cell-missing" : "num"}>
                <span className="cell-edit">
                  <SlipNumberInput
                    value={item.unit_price}
                    allowDecimal
                    label={columns.price}
                    onCommit={(next) => onEdit(pricePath, next)}
                  />
                  {isMissing(pricePath) ? <span className="missing-tag">{missingLabel}</span> : null}
                </span>
              </td>
              <td className="num">{total === null ? "—" : formatAmount(total)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function variantSuffix(item: Item): string {
  if (!item.variant) return "";
  const extra = [item.variant.size, item.variant.colour, item.variant.text].filter(
    (part): part is string => Boolean(part),
  );
  return extra.length ? ` · ${extra.join(" · ")}` : "";
}
