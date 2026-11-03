import { Avatar } from "../../../../components/avatar/avatar.js";
import { Badge } from "../../../../components/badge/badge.js";
import { Heading } from "../../../../components/heading/heading.js";
import type { Copy } from "../../../../hooks/use-language/copy.js";
import { formatClock, formatLongDate } from "../../../../lib/helpers/format-date.js";
import type { Language } from "../../../../lib/types/language.type.js";
import type { Conversation } from "../../../inbox/libs/types/conversation.type.js";
import type { Message } from "../../../inbox/libs/types/message.type.js";
import { ExtractButton } from "../extract-button/extract-button.js";
import { MessageBubble } from "../message-bubble/message-bubble.js";

export function ChatPanel({
  conversation,
  messages,
  extracting,
  language,
  copy,
  onExtract,
}: {
  conversation: Conversation | null;
  messages: readonly Message[];
  extracting: boolean;
  language: Language;
  copy: Copy;
  onExtract: () => void;
}) {
  if (!conversation) return <section className="column chat-column" />;

  return (
    <section className="column chat-column">
      <header className="chat-head">
        <div className="chat-person">
          <Avatar name={conversation.customerName} />
          <div>
            <Heading level={2}>{conversation.customerName}</Heading>
            <p className="chat-sub">
              {copy.channels[conversation.channel]} ({copy.simulated}) ·{" "}
              {formatLongDate(conversation.chatDate, language)}
            </p>
          </div>
        </div>
        <Badge>{copy.dialects[conversation.chatLanguage]}</Badge>
      </header>
      <div className="chat-log">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            author={message.author}
            text={message.text}
            time={formatClock(message.sentAt, language)}
          />
        ))}
      </div>
      <ExtractButton
        busy={extracting}
        disabled={messages.length === 0}
        copy={copy}
        onExtract={onExtract}
      />
    </section>
  );
}
