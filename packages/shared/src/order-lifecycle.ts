export const paymentStatuses = ["unpaid", "paid", "refunded"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export const fulfillmentStatuses = ["confirmed", "preparing", "shipped", "delivered", "cancelled"] as const;
export type FulfillmentStatus = (typeof fulfillmentStatuses)[number];

const paymentNext: Record<PaymentStatus, readonly PaymentStatus[]> = {
  unpaid: ["paid"],
  paid: ["refunded"],
  refunded: [],
};

const fulfillmentNext: Record<FulfillmentStatus, readonly FulfillmentStatus[]> = {
  confirmed: ["preparing", "cancelled"],
  preparing: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function isPaymentStatus(value: string): value is PaymentStatus {
  return (paymentStatuses as readonly string[]).includes(value);
}

export function isFulfillmentStatus(value: string): value is FulfillmentStatus {
  return (fulfillmentStatuses as readonly string[]).includes(value);
}

export function nextPayment(status: PaymentStatus): readonly PaymentStatus[] {
  return paymentNext[status];
}

export function nextFulfillment(status: FulfillmentStatus): readonly FulfillmentStatus[] {
  return fulfillmentNext[status];
}

export function canSetPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return paymentNext[from].includes(to);
}

export function canSetFulfillment(from: FulfillmentStatus, to: FulfillmentStatus): boolean {
  return fulfillmentNext[from].includes(to);
}
