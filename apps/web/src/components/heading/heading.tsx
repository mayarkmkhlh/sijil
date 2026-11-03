import type { ReactNode } from "react";

export function Heading({
  level,
  children,
  className,
}: {
  level: 1 | 2 | 3;
  children: ReactNode;
  className?: string;
}) {
  const Tag = `h${level}` as const;
  return <Tag className={className}>{children}</Tag>;
}
