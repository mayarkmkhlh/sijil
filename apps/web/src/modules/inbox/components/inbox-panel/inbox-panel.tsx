import { Heading } from "../../../../components/heading/heading.js";
import { SegmentedControl } from "../../../../components/segmented-control/segmented-control.js";
import type { Copy } from "../../../../hooks/use-language/copy.js";
import type { Language } from "../../../../lib/types/language.type.js";
import { matchesInboxFilter, type InboxFilter } from "../../libs/helpers/inbox-status.helper.js";
import type { Conversation, ConversationStatus } from "../../libs/types/conversation.type.js";
import { ConnectChannelButton } from "../connect-channel-button/connect-channel-button.js";
import { ConversationRow } from "../conversation-row/conversation-row.js";

export type { InboxFilter };

export function InboxPanel({
  conversations,
  selectedId,
  filter,
  statusOf,
  missingCount,
  countLabel,
  language,
  copy,
  onFilter,
  onSelect,
}: {
  conversations: readonly Conversation[];
  selectedId: string | null;
  filter: InboxFilter;
  statusOf: (conversationId: string) => ConversationStatus | null;
  missingCount: (conversationId: string) => number | null;
  countLabel?: string;
  language: Language;
  copy: Copy;
  onFilter: (filter: InboxFilter) => void;
  onSelect: (conversationId: string) => void;
}) {
  const visible = conversations.filter((conversation) =>
    matchesInboxFilter(filter, statusOf(conversation.id)),
  );

  return (
    <section className="column inbox-column">
      <header className="inbox-head">
        <Heading level={2}>{copy.inbox}</Heading>
        <p className="inbox-count">{countLabel ?? copy.chatCount(conversations.length)}</p>
        <SegmentedControl
          label={copy.filterLabel}
          value={filter}
          onChange={onFilter}
          options={[
            { value: "all", label: copy.filters.all },
            { value: "new", label: copy.filters.new },
            { value: "incomplete", label: copy.filters.incomplete },
          ]}
        />
      </header>
      <ul className="conversation-list">
        {visible.map((conversation) => (
          <ConversationRow
            key={conversation.id}
            conversation={conversation}
            selected={conversation.id === selectedId}
            status={statusOf(conversation.id)}
            missingCount={missingCount(conversation.id)}
            language={language}
            copy={copy}
            onSelect={() => onSelect(conversation.id)}
          />
        ))}
      </ul>
      <footer className="inbox-foot">
        <ConnectChannelButton label={copy.connect} />
        <p className="connect-note">{countLabel ? copy.customerLinkHint : copy.connectNote}</p>
      </footer>
    </section>
  );
}
