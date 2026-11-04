import { useEffect, useState } from "react";
import type { Order } from "@sijil/shared";
import { Button } from "../../../../components/button/button.js";
import { Icon } from "../../../../components/icon/icon.js";
import type { Copy } from "../../../../hooks/use-language/copy.js";
import { draftAsk } from "../../libs/helpers/missing-ask.helper.js";

export function AskDraft({ order, copy, onUse }: { order: Order; copy: Copy; onUse?: (text: string) => void }) {
  const draft = draftAsk(order);
  const [text, setText] = useState(draft ?? "");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setText(draft ?? "");
  }, [draft]);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  if (!draft) return null;

  async function copyReply() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="ask-draft">
      <div className="ask-head">
        <p className="ask-title">{copy.askTitle}</p>
        <span className="ask-actions">
          {onUse ? (
            <Button className="ask-copy" variant="ghost" onClick={() => onUse(text)}>
              {copy.askUse}
            </Button>
          ) : null}
          <Button className="ask-copy" variant="ghost" onClick={() => void copyReply()}>
            <Icon name="copy" />
            {copied ? copy.copied : copy.askCopy}
          </Button>
        </span>
      </div>
      <textarea
        className="ask-text"
        dir="auto"
        aria-label={copy.askTitle}
        rows={3}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <p className="ask-note">{copy.askNote}</p>
    </div>
  );
}