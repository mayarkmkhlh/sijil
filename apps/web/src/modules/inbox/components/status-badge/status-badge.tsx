import { Badge } from "../../../../components/badge/badge.js";
import { Icon } from "../../../../components/icon/icon.js";
import type { Copy } from "../../../../hooks/use-language/copy.js";
import type { ConversationStatus } from "../../libs/types/conversation.type.js";

export function StatusBadge({
  status,
  count,
  copy,
}: {
  status: ConversationStatus;
  count: number | null;
  copy: Copy;
}) {
  const label = copy.status[status];
  const text = status === "incomplete" && count ? `${count} ${label}` : label;
  const tone = status === "incomplete" ? "warn" : "ok";
  return (
    <Badge tone={tone}>
      {status === "approved" ? <Icon name="check" /> : null}
      {text}
    </Badge>
  );
}
