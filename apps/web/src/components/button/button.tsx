import type { ReactNode } from "react";

export function Button({
  children,
  variant = "primary",
  type = "button",
  disabled = false,
  onClick,
  className,
}: {
  children: ReactNode;
  variant?: "primary" | "ghost" | "quiet";
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const classes = ["btn", `btn-${variant}`, className].filter(Boolean).join(" ");
  return (
    <button type={type} className={classes} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
