import type { ReactNode } from "react";

export function OrderFieldRow({
  label,
  missing = false,
  missingLabel,
  children,
}: {
  label: string;
  missing?: boolean;
  missingLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className={missing ? "field-row field-row-missing" : "field-row"}>
      <span className="field-label">{label}</span>
      <span className={missing ? "field-missing" : "field-value"}>
        {children}
        {missing && missingLabel ? <span className="missing-tag">{missingLabel}</span> : null}
      </span>
    </div>
  );
}
