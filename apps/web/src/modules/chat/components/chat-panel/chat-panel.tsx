import { useEffect, useRef, type KeyboardEvent } from "react";
import { Avatar } from "../../../../components/avatar/avatar.js";
import { Badge } from "../../../../components/badge/badge.js";
import { Button } from "../../../../components/button/button.js";
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
  reply,
  onExtract,
}: {
  conversation: Conversation | null;
  messages: readonly Message[];
  extracting: boolean;
  language: Language;
  copy: Copy;
  reply?: { text: string; busy: boolean; onText: (value: string) => void; onSend: () => void };
  onExtract: () => void;
}) {
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);

  if (!conversation) return <section className="column chat-column" />;

  function onReplyKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!reply || event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    reply.onSend();
  }

  return (
    <section className="column chat-column">
      <header className="chat-head">
        <div className="chat-person">
          <Avatar name={conversation.customerName} />
          <div>
            <Heading level={2}>{conversation.customerName}</Heading>
            <p className="chat-sub">
              {copy.channels[conversation.channel]}
              {/^[0-9a-f-]{36}$/i.test(conversation.id) ? "" : ` (${copy.simulated})`} ·{" "}
              {formatLongDate(conversation.chatDate, language)}
            </p>
          </div>
        </div>
        <Badge>{copy.dialects[conversation.chatLanguage]}</Badge>
      </header>
      <div className="chat-log" ref={logRef}>
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            author={message.author}
            text={message.text}
            time={formatClock(message.sentAt, language)}
          />
        ))}
      </div>
      {reply ? (
        <form
          className="reply-box"
          onSubmit={(event) => {
            event.preventDefault();
            reply.onSend();
          }}
        >
          <textarea
            dir="auto"
            rows={2}
            placeholder={copy.replyPlaceholder}
            aria-label={copy.replyPlaceholder}
            value={reply.text}
            onChange={(event) => reply.onText(event.target.value)}
            onKeyDown={onReplyKey}
          />
          <Button type="submit" disabled={reply.busy || reply.text.trim().length === 0}>
            {copy.customerSend}
          </Button>
        </form>
      ) : null}
      <ExtractButton
        busy={extracting}
        disabled={messages.length === 0}
        copy={copy}
        onExtract={onExtract}
      />
    </section>
  );
}
