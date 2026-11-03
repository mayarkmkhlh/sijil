export function MissingFieldRow({ label, missingLabel }: { label: string; missingLabel: string }) {
  return (
    <div className="field-row field-row-missing">
      <span className="field-label">{label}</span>
      <span className="field-missing">{missingLabel}</span>
    </div>
  );
}
