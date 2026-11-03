import { useEffect, useRef, useState } from "react";
import { reviewItem, type Order } from "@sijil/shared";
import { getJson } from "../../../../lib/http/http.js";
import { toTranscript } from "../../../inbox/libs/helpers/to-transcript.helper.js";
import type { Message } from "../../../inbox/libs/types/message.type.js";
import { requestExtract, type ExtractCall } from "../../api/extract-api.js";
import { demoFallback } from "../../libs/constants/demo-cache.js";
import type { ExtractState } from "../../libs/types/extract-state.type.js";

const extractTimeoutMs = 30_000;

const idle: ExtractState = { status: "idle" };

export function useExtract(input: {
  conversationId: string;
  messages: readonly Message[];
  chatDate: string;
}): {
  state: ExtractState;
  settledOf: (conversationId: string) => ExtractState;
  extract: () => void;
  revise: (order: Order) => void;
  model: string | null;
} {
  const [settled, setSettled] = useState<Record<string, ExtractState>>({});
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const [model, setModel] = useState<string | null>(null);
  const tokens = useRef<Record<string, number>>({});
  const inFlight = useRef<Set<string>>(new Set());
  const timers = useRef<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    void getJson("/api/health")
      .then((payload) => {
        if (cancelled) return;
        const name = readModel(payload);
        if (name) setModel(name);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function settledOf(conversationId: string): ExtractState {
    return settled[conversationId] ?? idle;
  }

  function extract() {
    if (input.messages.length === 0) return;
    const conversationId = input.conversationId;
    if (inFlight.current.has(conversationId)) return;
    const chat = toTranscript(input.messages);
    if (!chat.trim()) return;
    const chatDate = input.chatDate;
    window.clearTimeout(timers.current[conversationId]);
    inFlight.current.add(conversationId);
    const token = (tokens.current[conversationId] ?? 0) + 1;
    tokens.current[conversationId] = token;
    setPending((current) => new Set(current).add(conversationId));
    const started = performance.now();

    timers.current[conversationId] = window.setTimeout(() => {
      if (tokens.current[conversationId] !== token) return;
      inFlight.current.delete(conversationId);
      setPending((current) => {
        const next = new Set(current);
        next.delete(conversationId);
        return next;
      });
      setSettled((current) => ({
        ...current,
        [conversationId]: { status: "error", httpStatus: 408, detail: null, cached: demoFallback(conversationId) },
      }));
    }, extractTimeoutMs);

    void requestExtract(chat, chatDate).then((result) => {
      if (tokens.current[conversationId] !== token) return;
      window.clearTimeout(timers.current[conversationId]);
      inFlight.current.delete(conversationId);
      setPending((current) => {
        const next = new Set(current);
        next.delete(conversationId);
        return next;
      });
      const elapsedMs = Math.round(performance.now() - started);
      setSettled((current) => ({ ...current, [conversationId]: toState(result, elapsedMs) }));
    });
  }

  function revise(order: Order) {
    const conversationId = input.conversationId;
    setSettled((current) => {
      const existing = current[conversationId];
      if (!existing || existing.status !== "order" || existing.order === order) return current;
      const reviews = order.items.map((item, index) => {
        const previous = existing.order.items[index];
        const previousReview = existing.reviews[index];
        if (previous && previousReview && previous.name === item.name && previous.unit_price === item.unit_price) {
          return previousReview;
        }
        return reviewItem(item.name, item.unit_price);
      });
      return { ...current, [conversationId]: { ...existing, order, reviews } };
    });
  }

  const state: ExtractState = pending.has(input.conversationId)
    ? { status: "loading" }
    : settledOf(input.conversationId);

  return { state, settledOf, extract, revise, model };
}

function toState(result: ExtractCall, elapsedMs: number): ExtractState {
  if (!result.ok) return { status: "error", httpStatus: result.status, detail: result.detail, cached: null };
  if (result.kind === "no_order") return { status: "no_order", reason: result.reason };
  return {
    status: "order",
    order: result.order,
    reviews: result.reviews,
    meta: { attempts: result.attempts, elapsedMs },
  };
}

function readModel(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const name = (payload as { museSparkModel?: unknown }).museSparkModel;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}
