import { useState } from "react";
import { reviewItems, type Order } from "@sijil/shared";
import { Banner } from "../components/banner/banner.js";
import { Logo } from "../components/logo/logo.js";
import { SegmentedControl } from "../components/segmented-control/segmented-control.js";
import { useLanguage } from "../hooks/use-language/use-language.hook.js";
import type { Language } from "../lib/types/language.type.js";
import { ChatPanel } from "../modules/chat/chat.js";
import { InboxPanel, inboxStatus, simulatedSource, type InboxFilter } from "../modules/inbox/inbox.js";
import { OrderSlip, useExtract } from "../modules/order/order.js";

export function App() {
  const { language, dir, setLanguage, copy } = useLanguage();
  const conversations = simulatedSource.list();
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [selectedId, setSelectedId] = useState(conversations[0]?.id ?? null);
  const [approvedIds, setApprovedIds] = useState<ReadonlySet<string>>(() => new Set());

  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null;
  const messages = selected ? simulatedSource.messagesOf(selected.id) : [];
  const extraction = useExtract({
    conversationId: selected?.id ?? "none",
    messages,
    chatDate: selected?.chatDate ?? "",
  });

  function statusFor(conversationId: string) {
    return inboxStatus(approvedIds.has(conversationId), extraction.settledOf(conversationId));
  }

  function missingFor(conversationId: string): number | null {
    const state = extraction.settledOf(conversationId);
    if (state.status !== "order" || approvedIds.has(conversationId)) return null;
    return state.order.missing_fields.length > 0 ? state.order.missing_fields.length : null;
  }

  function clearApproval(conversationId: string) {
    setApprovedIds((current) => {
      if (!current.has(conversationId)) return current;
      const next = new Set(current);
      next.delete(conversationId);
      return next;
    });
  }

  function onExtract() {
    if (!selected || messages.length === 0) return;
    clearApproval(selected.id);
    extraction.extract();
  }

  function onEdit(order: Order) {
    if (!selected) return;
    const state = extraction.settledOf(selected.id);
    if (state.status !== "order" || state.order === order) return;
    clearApproval(selected.id);
    extraction.revise(order);
  }

  const shownItems =
    extraction.state.status === "order"
      ? extraction.state.order.items
      : extraction.state.status === "error" && extraction.state.cached?.kind === "order"
        ? extraction.state.cached.order.items
        : null;
  const unknownItem = shownItems
    ? reviewItems(shownItems).some((review) => review.status === "unknown")
    : false;

  function approve() {
    const showingOrder =
      extraction.state.status === "order" ||
      (extraction.state.status === "error" && extraction.state.cached?.kind === "order");
    if (!selected || !showingOrder || unknownItem) return;
    setApprovedIds((current) => new Set(current).add(selected.id));
  }

  return (
    <div className="shell" dir={dir}>
      <header className="topbar">
        <div className="brand">
          <Logo />
          <p className="store">{copy.store}</p>
        </div>
        <div className="top-actions">
          <Banner>{copy.demo}</Banner>
          <SegmentedControl
            className="segments-fit"
            label={copy.languageLabel}
            value={language}
            onChange={(next: Language) => setLanguage(next)}
            options={[
              { value: "ar", label: "ع" },
              { value: "en", label: "EN" },
            ]}
          />
        </div>
      </header>
      <div className="workspace">
        <InboxPanel
          conversations={conversations}
          selectedId={selectedId}
          filter={filter}
          statusOf={statusFor}
          missingCount={missingFor}
          language={language}
          copy={copy}
          onFilter={setFilter}
          onSelect={setSelectedId}
        />
        <ChatPanel
          conversation={selected}
          messages={messages}
          extracting={extraction.state.status === "loading"}
          language={language}
          copy={copy}
          onExtract={onExtract}
        />
        <OrderSlip
          state={extraction.state}
          approved={selected ? approvedIds.has(selected.id) : false}
          model={extraction.model}
          copy={copy}
          onApprove={approve}
          onRetry={onExtract}
          onEdit={onEdit}
          approveBlocked={unknownItem}
        />
      </div>
    </div>
  );
}
