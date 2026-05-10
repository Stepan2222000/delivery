"use client";

import { useState, useTransition } from "react";

export function InlineWeightInput({
  tn,
  weight,
  action,
  highlight,
  disabled,
}: {
  tn: string;
  weight: number | null;
  action: (formData: FormData) => Promise<void>;
  highlight?: boolean;
  disabled?: boolean;
}) {
  const initial = weight !== null ? String(weight) : "";
  const [val, setVal] = useState<string>(initial);
  const [last, setLast] = useState<string>(initial);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const cur = val.trim().replace(",", ".");
    if (cur === last) return;
    if (cur === "") return;
    const num = Number(cur);
    if (!Number.isFinite(num) || num <= 0) return;
    const fd = new FormData();
    fd.set("tn", tn);
    fd.set("weight", String(num));
    setLast(cur);
    startTransition(async () => {
      await action(fd);
    });
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        pattern="[0-9]*[.,]?[0-9]*"
        placeholder="?"
        value={val}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "" || /^[0-9]*[.,]?[0-9]*$/.test(v)) setVal(v);
        }}
        onBlur={submit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        disabled={disabled || pending}
        aria-label={`Вес ${tn}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 56,
          height: 28,
          padding: "0 6px",
          background: "var(--product-input)",
          border: `1px solid ${highlight ? "var(--error-text)" : "var(--product-input-border)"}`,
          borderRadius: 6,
          color: "var(--on-dark-strong)",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          textAlign: "right",
          opacity: pending ? 0.5 : 1,
        }}
      />
      <span className="body-sm muted" style={{ fontSize: 12 }}>кг</span>
    </span>
  );
}
