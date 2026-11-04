import { Avatar } from "../../../../components/avatar/avatar.js";
import type { Copy } from "../../../../hooks/use-language/copy.js";
import type { Language } from "../../../../lib/types/language.type.js";
import { formatConversationTime } from "../../../../lib/helpers/format-date.js";
import type { Conversation, ConversationStatus } from "../../libs/types/conversation.type.js";
import { ChannelTag } from "../channel-tag/channel-tag.js";
import { StatusBadge } from "../status-badge/status-badge.js";

export function ConversationRow({
  conversation,
  selected,
  status,
  missingCount,
  language,
  copy,
  onSelect,
}: {
  conversation: Conversation;
  selected: boolean;
  status: ConversationStatus | null;
  missingCount: number | null;
  language: Language;
  copy: Copy;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={[
          "conversation",
          selected ? "is-selected" : "",
          conversation.unread && !selected ? "is-unread" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
      >
        <Avatar name={conversation.customerName} />
        <span className="conversation-body">
          <span className="conversation-top">
            <span className="conversation-name" dir="auto">
              {conversation.customerName}
            </span>
            <span className="conversation-time">
              {formatConversationTime(conversation.updatedAt, language)}
            </span>
          </span>
          <span className="conversation-preview" dir="auto">
            {conversation.preview}
          </span>
          <span className="conversation-meta">
            <ChannelTag channel={conversation.channel} copy={copy} />
            {status ? <StatusBadge status={status} count={missingCount} copy={copy} /> : null}
          </span>
        </span>
      </button>
    </li>
  );
}
