const amountFormat = new Intl.NumberFormat("en", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const unitPriceFormat = new Intl.NumberFormat("en", {
  maximumFractionDigits: 2,
});

export function formatAmount(amount: number): string {
  return amountFormat.format(amount);
}

export function formatUnitPrice(amount: number): string {
  return unitPriceFormat.format(amount);
}

export function formatMoney(amount: number, currency: string): string {
  return `${formatAmount(amount)} ${currency}`;
}
