import type { ReactNode } from "react";

export function Alert({
  title,
  children,
  tone = "danger",
}: {
  title: string;
  children?: ReactNode;
  tone?: "danger" | "warn";
}) {
  return (
    <div className={`alert alert-${tone}`} role="alert">
      <p className="alert-title">{title}</p>
      {children ? <p>{children}</p> : null}
    </div>
  );
}
