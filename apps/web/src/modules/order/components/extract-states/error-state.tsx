import { Alert } from "../../../../components/alert/alert.js";
import { Button } from "../../../../components/button/button.js";
import type { Copy } from "../../../../hooks/use-language/copy.js";
import { extractErrorMessage } from "../../libs/helpers/extract-error.helper.js";

export function ErrorState({
  httpStatus,
  detail,
  copy,
  onRetry,
}: {
  httpStatus: number;
  detail: string | null;
  copy: Copy;
  onRetry: () => void;
}) {
  const body = extractErrorMessage(httpStatus, detail, {
    schema: copy.errorSchema,
    model: copy.errorModel,
    timeout: copy.errorTimeout,
  });
  return (
    <div className="state-block state-block-start">
      <Alert title={copy.errorTitle}>{body}</Alert>
      <Button onClick={onRetry}>{copy.retry}</Button>
    </div>
  );
}
