import { Heading } from "../../../../components/heading/heading.js";
import type { Copy } from "../../../../hooks/use-language/copy.js";

export function NotAnOrderState({ reason, copy }: { reason: string; copy: Copy }) {
  return (
    <div className="state-block">
      <Heading level={3}>{copy.notAnOrder}</Heading>
      <p dir="auto">{reason}</p>
    </div>
  );
}
