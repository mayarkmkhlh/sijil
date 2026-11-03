import type { ReactNode } from "react";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "ok" | "warn" | "neutral";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
