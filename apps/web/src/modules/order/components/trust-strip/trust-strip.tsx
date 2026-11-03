import { Icon } from "../../../../components/icon/icon.js";
import type { Copy } from "../../../../hooks/use-language/copy.js";
import type { ExtractMeta } from "../../libs/types/extract-state.type.js";

export function TrustStrip({
  meta,
  confidence,
  model,
  copy,
}: {
  meta: ExtractMeta;
  confidence: number | null;
  model: string | null;
  copy: Copy;
}) {
  const parts = [
    meta.attempts === null ? null : copy.attempt(meta.attempts),
    `${(meta.elapsedMs / 1000).toFixed(1)}s`,
    model,
    typeof confidence === "number" ? copy.confidence(confidence) : null,
  ].filter((part): part is string => Boolean(part));

  return (
    <footer className="trust">
      <p className="trust-line">
        <Icon name="check" />
        {copy.structure}: {copy.structurePassed}
      </p>
      {parts.length > 0 ? <p className="trust-meta">{parts.join(" · ")}</p> : null}
    </footer>
  );
}
