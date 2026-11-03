export type PricedLine = {
  qty: number | null;
  unit_price: number | null;
};

export function lineTotal(line: PricedLine): number | null {
  if (line.qty === null || line.unit_price === null) return null;
  return roundMoney(line.qty * line.unit_price);
}

/** Null when any line is missing a quantity or a price, so a gap is not shown as zero. */
export function deriveTotal(lines: readonly PricedLine[]): number | null {
  let sum = 0;
  for (const line of lines) {
    const total = lineTotal(line);
    if (total === null) return null;
    sum = roundMoney(sum + total);
  }
  return sum;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
