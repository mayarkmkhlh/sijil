import type { ItemReview } from "@sijil/shared";
import type { Copy } from "../../../../hooks/use-language/copy.js";
import { formatUnitPrice } from "../../../../lib/helpers/format-money.js";

/** The code's decision for one extracted line. The model does not choose the catalog id. */
export function CatalogChip({
  review,
  copy,
}: {
  review: ItemReview;
  copy: Pick<Copy, "notInCatalog" | "catalogPrice" | "chatSaid">;
}) {
  if (review.status === "unknown") {
    return <span className="catalog-chip catalog-chip-unknown">{copy.notInCatalog}</span>;
  }
  if (review.catalogPrice === null) return null;
  const catalogLabel = copy.catalogPrice(formatUnitPrice(review.catalogPrice));
  if (review.status === "price_mismatch" && review.quotedPrice !== null) {
    return (
      <span className="catalog-chip catalog-chip-mismatch">
        {copy.chatSaid(formatUnitPrice(review.quotedPrice))}
        {" · "}
        {catalogLabel}
      </span>
    );
  }
  return <span className="catalog-chip">{catalogLabel}</span>;
}
