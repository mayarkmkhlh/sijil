export const extractStatuses = ["idle", "loading", "order", "no_order", "error"] as const;

export type ExtractStatus = (typeof extractStatuses)[number];
