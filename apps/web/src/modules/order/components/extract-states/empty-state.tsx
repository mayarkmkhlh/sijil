import { Heading } from "../../../../components/heading/heading.js";
import type { Copy } from "../../../../hooks/use-language/copy.js";

export function EmptyState({ copy }: { copy: Copy }) {
  return (
    <div className="state-block">
      <Heading level={3}>{copy.emptyTitle}</Heading>
      <p>{copy.emptyBody}</p>
    </div>
  );
}
