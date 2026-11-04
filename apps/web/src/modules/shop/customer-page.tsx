import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "../../components/button/button.js";
import { Heading } from "../../components/heading/heading.js";
import { Input } from "../../components/input/input.js";
import { useLanguage } from "../../hooks/use-language/use-language.hook.js";
import { formatClock } from "../../lib/helpers/format-date.js";
import { MessageBubble } from "../chat/components/message-bubble/message-bubble.js";
import { accountError } from "./account-api.js";
import { loadShop, loadShopMessages, sendShopMessage } from "./customer-api.js";

function storageKey(sellerId: string): string {
  return `sijil-shop-${sellerId}`;
}

export function CustomerPage({ sellerId }: { sellerId: string }) {
  const { language, dir, copy } = useLanguage();
  const [shopName, setShopName] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [body, setBody] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ id: string; author: "customer" | "seller"; text: string; sentAt: string }[]>([]);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey(sellerId));
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { threadId?: string; customerName?: string };
      if (parsed.threadId) setThreadId(parsed.threadId);
      if (parsed.customerName) setCustomerName(parsed.customerName);
    } catch {
      localStorage.removeItem(storageKey(sellerId));
    }
  }, [sellerId]);

  useEffect(() => {
    void loadShop(sellerId)
      .then((name) => {
        if (!name) setMissing(true);
        else setShopName(name);
      })
      .catch(() => setMissing(true));
  }, [sellerId]);

  useEffect(() => {
    if (!threadId) return;
    let stop = false;
    async function pull() {
      const next = await loadShopMessages(sellerId, threadId as string);
      if (!stop && next) {
        setMessages(next.messages);
        setApproved(next.approved);
      }
    }
    void pull();
    const timer = window.setInterval(() => void pull(), 4000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [sellerId, threadId]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    if (!customerName.trim() || !body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await sendShopMessage(sellerId, { customerName, body, threadId });
      setThreadId(saved.threadId);
      setMessages(saved.messages);
      setBody("");
      localStorage.setItem(storageKey(sellerId), JSON.stringify({ threadId: saved.threadId, customerName }));
    } catch (caught) {
      setError(accountError(caught));
    } finally {
      setBusy(false);
    }
  }

  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void send();
  }

  if (missing) {
    return (
      <div className="shell auth-shell" dir={dir}>
        <p>{copy.customerShopMissing}</p>
      </div>
    );
  }

  const known = Boolean(threadId && customerName.trim());

  return (
    <div className="shell customer-shell" dir={dir}>
      <header className="customer-head">
        <Heading level={1}>{shopName ?? "…"}</Heading>
        <p>{approved ? copy.customerApproved : messages.length > 0 ? copy.customerWaiting : copy.customerGreeting}</p>
      </header>
      <div className="chat-log customer-log" ref={logRef}>
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            author={message.author}
            text={message.text}
            time={formatClock(message.sentAt, language)}
          />
        ))}
      </div>
      <form className="customer-form" onSubmit={(event) => void send(event)}>
        {known ? (
          <p className="customer-as">{copy.customerAs(customerName)}</p>
        ) : (
          <Input label={copy.customerName} value={customerName} onChange={(event) => setCustomerName(event.target.value)} required />
        )}
        <textarea
          dir="auto"
          rows={2}
          placeholder={copy.customerMessage}
          aria-label={copy.customerMessage}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={onKey}
          required
        />
        {error ? <p className="auth-error">{error}</p> : null}
        <Button className="btn-block" disabled={busy || body.trim().length === 0} type="submit">
          {copy.customerSend}
        </Button>
      </form>
    </div>
  );
}
