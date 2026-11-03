import type { ItemReview, Order } from "@sijil/shared";
import type { ExtractStatus } from "../../../../lib/enums/extract-status.js";
import type { CachedExtract } from "../constants/demo-cache.js";

export type ExtractMeta = {
  attempts: number | null;
  elapsedMs: number;
};

type ExtractStateByStatus = {
  idle: { status: "idle" };
  loading: { status: "loading" };
  order: { status: "order"; order: Order; reviews: ItemReview[]; meta: ExtractMeta };
  no_order: { status: "no_order"; reason: string };
  error: { status: "error"; httpStatus: number; detail: string | null; cached: CachedExtract | null };
};

export type ExtractState = ExtractStateByStatus[ExtractStatus];
