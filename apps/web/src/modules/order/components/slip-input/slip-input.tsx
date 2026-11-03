import { useEffect, useRef, useState } from "react";

export function SlipNumberInput({
  value,
  allowDecimal,
  label,
  onCommit,
}: {
  value: number | null;
  allowDecimal: boolean;
  label: string;
  onCommit: (next: number | null) => void;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(value === null ? "" : String(value));
  }, [value]);

  const pattern = allowDecimal ? /^\d*\.?\d{0,2}$/ : /^\d*$/;

  function commit(next: string) {
    if (next.trim() === "" || next === ".") {
      setText("");
      onCommit(null);
      return;
    }
    const parsed = Number(next);
    const valid = allowDecimal ? Number.isFinite(parsed) && parsed >= 0 : Number.isInteger(parsed) && parsed > 0;
    if (!valid) {
      setText(value === null ? "" : String(value));
      return;
    }
    setText(String(parsed));
    onCommit(parsed);
  }

  return (
    <input
      className="slip-input"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      aria-label={label}
      value={text}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        commit(text);
      }}
      onChange={(event) => {
        const next = event.target.value;
        if (next !== "" && !pattern.test(next)) return;
        setText(next);
      }}
    />
  );
}
