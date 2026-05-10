"use client";

import { useState } from "react";
import { IconCheck, IconCopy } from "./Icons";

export function CopyButton({ value, ariaLabel }: { value: string; ariaLabel?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard blocked, ignore */
        }
      }}
      aria-label={ariaLabel ?? "Скопировать"}
      title={copied ? "скопировано" : "скопировать"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        padding: 0,
        background: "transparent",
        border: 0,
        borderRadius: 6,
        color: copied ? "var(--brand-coral)" : "var(--on-dark-faint)",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      {copied ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
    </button>
  );
}
