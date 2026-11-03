import { Loader } from "../../../../components/loader/loader.js";
import type { Copy } from "../../../../hooks/use-language/copy.js";

export function LoadingState({ copy }: { copy: Copy }) {
  return (
    <div className="state-block">
      <Loader label={copy.loading} />
      <p>{copy.loading}</p>
    </div>
  );
}
