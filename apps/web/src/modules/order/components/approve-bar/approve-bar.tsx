import { useEffect, useState } from "react";
import { Button } from "../../../../components/button/button.js";
import { Icon } from "../../../../components/icon/icon.js";
import type { Copy } from "../../../../hooks/use-language/copy.js";

export function ApproveBar({
  approved,
  blocked = false,
  orderJson,
  copy,
  onApprove,
}: {
  approved: boolean;
  blocked?: boolean;
  orderJson: string;
  copy: Copy;
  onApprove: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(orderJson);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="approve-bar">
      <Button className="btn-block" disabled={approved || blocked} onClick={onApprove}>
        {approved ? copy.status.approved : copy.approve}
      </Button>
      {blocked && !approved ? <p className="approve-note">{copy.approveBlocked}</p> : null}
      <Button variant="quiet" onClick={() => void copyJson()}>
        <Icon name="copy" />
        {copied ? copy.copied : copy.copyJson}
      </Button>
    </div>
  );
}
