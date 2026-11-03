import { useId, type SelectHTMLAttributes } from "react";
import { Icon } from "../icon/icon.js";

export function Select({
  label,
  children,
  ...props
}: { label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <span className="select-wrap">
        <select id={id} {...props}>
          {children}
        </select>
        <Icon name="chevron" />
      </span>
    </label>
  );
}
