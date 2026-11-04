import { useEffect, useState } from "react";
import { reviewItems, type Order } from "@sijil/shared";
import { Banner } from "../components/banner/banner.js";
import { Button } from "../components/button/button.js";
import { Logo } from "../components/logo/logo.js";
import { SegmentedControl } from "../components/segmented-control/segmented-control.js";
import { useLanguage } from "../hooks/use-language/use-language.hook.js";
import type { Language } from "../lib/types/language.type.js";
import { ChatPanel } from "../modules/chat/chat.js";
import { InboxPanel, inboxStatus, simulatedSource, type InboxFilter } from "../modules/inbox/inbox.js";
import type { Message } from "../modules/inbox/libs/types/message.type.js";
import type { Conversation } from "../modules/inbox/libs/types/conversation.type.js";
import { OrderSlip, useExtract } from "../modules/order/order.js";
import { riyadhDay } from "../lib/helpers/format-date.js";
import { loadSeller, logout, type SellerAccount } from "../modules/shop/account-api.js";
import {
  loadThreadMessages,
  loadThreads,
  saveApprovedOrder,
  sendSellerReply,
  type LiveThread,
  type ShopOrder,
} from "../modules/shop/customer-api.js";
import { OrdersScreen } from "../modules/shop/orders-screen.js";
import { AuthScreen } from "../modules/shop/auth-screen.js";
import { ShopScreen } from "../modules/shop/shop-screen.js";

type Gate =
  | { status: "loading" }
  | { status: "auth" }
  | { status: "demo" }
  | { status: "seller"; seller: SellerAccount };

export function App() {
  const { language, dir, setLanguage, copy } = useLanguage();
  const [gate, setGate] = useState<Gate>({ status: "loading" });
  const [area, setArea] = useState<"inbox" | "shop" | "orders">("shop");
  const [ordersFocusId, setOrdersFocusId] = useState<string | null>(null);
  const [shopOrdersByThread, setShopOrdersByThread] = useState<Record<string, ShopOrder>>({});
  const [liveThreads, setLiveThreads] = useState<Conversation[] | null>(null);
  const [liveMessages, setLiveMessages] = useState<Record<string, Message[]>>({});
  const [savedOrders, setSavedOrders] = useState<Record<string, Order>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyBusy, setReplyBusy] = useState(false);
  const sellerId = gate.status === "seller" ? gate.seller.id : null;
  const simulated = simulatedSource.list();
  const conversations = sellerId && liveThreads ? liveThreads : simulated;
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [selectedId, setSelectedId] = useState(simulated[0]?.id ?? null);
  const [approvedIds, setApprovedIds] = useState<ReadonlySet<string>>(() => new Set());
  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null;
  const messages =
    sellerId && selected
      ? (liveMessages[selected.id] ?? [])
      : selected
        ? simulatedSource.messagesOf(selected.id)
        : [];
  const extraction = useExtract({
    conversationId: selected?.id ?? "none",
    messages,
    chatDate: selected?.chatDate ?? "",
  });

  useEffect(() => {
    void loadSeller()
      .then((seller) => setGate(seller ? { status: "seller", seller } : { status: "auth" }))
      .catch(() => setGate({ status: "auth" }));
  }, []);

  useEffect(() => {
    if (!sellerId) return;
    let stop = false;
    async function pull() {
      try {
        const threads = await loadThreads();
        if (stop) return;
        setLiveThreads(threads.map(toConversation));
        setApprovedIds((current) => {
          const next = new Set(current);
          for (const thread of threads) if (thread.approved) next.add(thread.id);
          return next;
        });
      } catch {
        if (!stop) setLiveThreads([]);
      }
    }
    void pull();
    const timer = window.setInterval(() => void pull(), 4000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [sellerId]);

  useEffect(() => {
    if (!sellerId || !selectedId || !/^[0-9a-f-]{36}$/i.test(selectedId)) return;
    let stop = false;
    async function pull() {
      try {
        const next = await loadThreadMessages(selectedId as string, area === "inbox");
        if (!stop) {
          setLiveMessages((current) => ({
            ...current,
            [selectedId as string]: next.messages.map((message) => ({
              id: message.id,
              conversationId: selectedId as string,
              author: message.author,
              text: message.text,
              sentAt: message.sentAt,
            })),
          }));
          if (next.order) {
            setSavedOrders((current) => ({ ...current, [selectedId as string]: next.order as Order }));
          }
          if (next.shopOrder) {
            setShopOrdersByThread((current) => ({ ...current, [selectedId as string]: next.shopOrder as ShopOrder }));
          }
          if (area === "inbox") {
            setLiveThreads((current) =>
              current?.map((thread) => (thread.id === selectedId ? { ...thread, unread: false } : thread)) ?? current,
            );
          }
        }
      } catch {
        /* Keep the messages already on screen. */
      }
    }
    void pull();
    const timer = window.setInterval(() => void pull(), 4000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [sellerId, selectedId, area]);

  useEffect(() => {
    if (!sellerId || !liveThreads) return;
    if (liveThreads.some((thread) => thread.id === selectedId)) return;
    setSelectedId(liveThreads[0]?.id ?? null);
  }, [sellerId, liveThreads, selectedId]);

  if (gate.status === "loading") {
    return (
      <div className="shell auth-shell" dir={dir}>
        <p>{copy.loading}</p>
      </div>
    );
  }

  if (gate.status === "auth") {
    return (
      <div className="shell auth-shell" dir={dir}>
        <AuthScreen
          copy={copy}
          onSeller={(seller) => {
            setArea("shop");
            setGate({ status: "seller", seller });
          }}
          onDemo={
            window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
              ? () => setGate({ status: "demo" })
              : undefined
          }
        />
      </div>
    );
  }

  const seller = gate.status === "seller" ? gate.seller : null;

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

  const savedOrder = selected ? savedOrders[selected.id] : undefined;
  const slipState =
    extraction.state.status === "idle" && savedOrder
      ? {
          status: "order" as const,
          order: savedOrder,
          reviews: reviewItems(savedOrder.items),
          meta: { attempts: null, elapsedMs: 0 },
        }
      : extraction.state;
  const shownItems =
    slipState.status === "order"
      ? slipState.order.items
      : slipState.status === "error" && slipState.cached?.kind === "order"
        ? slipState.cached.order.items
        : null;
  const shownReviews =
    slipState.status === "order"
      ? slipState.reviews
      : slipState.status === "error" && slipState.cached?.kind === "order"
        ? slipState.cached.reviews
        : null;
  const unknownItem = (shownReviews ?? (shownItems ? reviewItems(shownItems) : [])).some(
    (review) => review.status === "unknown",
  );

  async function sendReply() {
    if (!selected || (selected.channel !== "shop_link" && selected.channel !== "whatsapp")) return;
    const text = (replyDrafts[selected.id] ?? "").trim();
    if (!text) return;
    setReplyBusy(true);
    try {
      const next = await sendSellerReply(selected.id, text);
      setLiveMessages((current) => ({
        ...current,
        [selected.id]: next.map((message) => ({
          id: message.id,
          conversationId: selected.id,
          author: message.author,
          text: message.text,
          sentAt: message.sentAt,
        })),
      }));
      setReplyDrafts((current) => ({ ...current, [selected.id]: "" }));
      setLiveThreads((current) =>
        current?.map((thread) =>
          thread.id === selected.id ? { ...thread, preview: text, unread: false, updatedAt: new Date().toISOString() } : thread,
        ) ?? current,
      );
    } catch {
      /* Leave the reply in the box. */
    } finally {
      setReplyBusy(false);
    }
  }

  async function approve() {
    const order =
      extraction.state.status === "order"
        ? extraction.state.order
        : extraction.state.status === "error" && extraction.state.cached?.kind === "order"
          ? extraction.state.cached.order
          : null;
    if (!selected || !order || unknownItem) return;
    if (seller && liveThreads?.some((thread) => thread.id === selected.id)) {
      try {
        const saved = await saveApprovedOrder({
          threadId: selected.id,
          customerName: selected.customerName,
          order,
        });
        setSavedOrders((current) => ({ ...current, [selected.id]: order }));
        setShopOrdersByThread((current) => ({ ...current, [selected.id]: saved }));
      } catch {
        return;
      }
    }
    setApprovedIds((current) => new Set(current).add(selected.id));
  }

  return (
    <div className="shell" dir={dir}>
      <header className="topbar no-print">
        <div className="brand">
          <Logo />
          <p className="store">{seller ? seller.shopName : copy.store}</p>
        </div>
        <div className="top-actions">
          {seller ? (
            <SegmentedControl
              className="segments-fit"
              label={copy.sections}
              value={area}
              onChange={setArea}
              options={[
                { value: "shop", label: copy.shopNav },
                { value: "orders", label: copy.ordersNav },
                {
                  value: "inbox",
                  label: conversations.some((item) => item.unread)
                    ? copy.inboxUnread(conversations.filter((item) => item.unread).length)
                    : copy.inboxNav,
                },
              ]}
            />
          ) : null}
          <Banner>{seller ? copy.customerLinkHint : copy.demo}</Banner>
          <Button
            variant="quiet"
            onClick={() => {
              if (!seller) {
                setGate({ status: "auth" });
                return;
              }
              void logout().finally(() => setGate({ status: "auth" }));
            }}
          >
            {seller ? copy.authLogout : copy.authLogin}
          </Button>
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
      {seller && area === "orders" ? (
        <OrdersScreen
          shopName={seller.shopName}
          copy={copy}
          language={language}
          focusId={ordersFocusId}
          onFocus={setOrdersFocusId}
          onOpenChat={(threadId) => {
            setSelectedId(threadId);
            setArea("inbox");
          }}
        />
      ) : seller && area === "shop" ? (
        <ShopScreen
          fields={seller.extractFields}
          shopLink={`${window.location.origin}${window.location.pathname}#/s/${seller.id}`}
          copy={copy}
          onFields={(extractFields) => setGate({ status: "seller", seller: { ...seller, extractFields } })}
        />
      ) : (
      <div className="workspace">
        <InboxPanel
          conversations={conversations}
          selectedId={selectedId}
          filter={filter}
          statusOf={statusFor}
          missingCount={missingFor}
          countLabel={seller ? copy.customerChatCount(conversations.length) : undefined}
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
          reply={
            seller && (selected?.channel === "shop_link" || selected?.channel === "whatsapp")
              ? {
                  text: replyDrafts[selected.id] ?? "",
                  busy: replyBusy,
                  onText: (value) => setReplyDrafts((current) => ({ ...current, [selected.id]: value })),
                  onSend: () => void sendReply(),
                }
              : undefined
          }
          onExtract={onExtract}
        />
        <OrderSlip
          state={slipState}
          approved={selected ? approvedIds.has(selected.id) : false}
          model={extraction.model}
          copy={copy}
          onApprove={() => void approve()}
          onRetry={onExtract}
          onEdit={onEdit}
          onUseReply={
            seller && (selected?.channel === "shop_link" || selected?.channel === "whatsapp")
              ? (text) => setReplyDrafts((current) => ({ ...current, [selected.id]: text }))
              : undefined
          }
          savedOrder={selected ? shopOrdersByThread[selected.id] : null}
          onViewOrder={() => {
            const saved = selected ? shopOrdersByThread[selected.id] : null;
            if (!saved) return;
            setOrdersFocusId(saved.id);
            setArea("orders");
          }}
          approveBlocked={unknownItem}
        />
      </div>
      )}
    </div>
  );
}

function toConversation(thread: LiveThread): Conversation {
  return {
    id: thread.id,
    customerName: thread.customerName,
    channel: thread.channel === "whatsapp" ? "whatsapp" : "shop_link",
    chatLanguage: "en",
    preview: thread.preview,
    updatedAt: thread.updatedAt,
    chatDate: riyadhDay(new Date(thread.updatedAt)),
    unread: thread.unread,
  };
}
