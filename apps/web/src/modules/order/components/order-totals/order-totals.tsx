export function OrderTotals({
  label,
  note,
  amount,
  currency,
}: {
  label: string;
  note: string;
  amount: string | null;
  currency: string | null;
}) {
  return (
    <div className="totals">
      <div>
        <p className="totals-label">{label}</p>
        <p className="totals-note">{note}</p>
      </div>
      <p className="totals-amount">
        {amount ?? "—"}
        {amount && currency ? <span className="totals-currency">{currency}</span> : null}
      </p>
    </div>
  );
}
