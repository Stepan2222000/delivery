"use client";

import { useState } from "react";

export function CopyTrack({ value, size, className }: { value: string; size?: "lg" | "xl"; className?: string }) {
  const [copied, setCopied] = useState(false);

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const sizeClass = size === "xl" ? "xl" : size === "lg" ? "lg" : "";

  return (
    <span style={{ position: "relative", display: "inline-block", lineHeight: 1 }}>
      <button
        type="button"
        onClick={onClick}
        className={`copy-track-btn ${className ?? ""}`}
        aria-label="Скопировать трек-номер"
        title="Кликните чтобы скопировать"
      >
        <span className={`track-no ${sizeClass}`}>{value}</span>
      </button>
      {copied && <span className="copy-toast">скопировано</span>}
    </span>
  );
}
