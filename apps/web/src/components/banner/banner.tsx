import type { ReactNode } from "react";

export function Banner({ children }: { children: ReactNode }) {
  return <p className="banner">{children}</p>;
}
