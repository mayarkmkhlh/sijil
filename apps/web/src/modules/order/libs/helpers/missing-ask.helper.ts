import type { Order } from "@sijil/shared";

export const askFieldKeys = [
  "customer_name",
  "delivery_city",
  "delivery_district",
  "delivery_address",
  "delivery_date",
  "payment_method",
] as const satisfies readonly (keyof Order)[];

export type AskField = (typeof askFieldKeys)[number];
