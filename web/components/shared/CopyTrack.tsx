"use client";

import { useState } from "react";

export function CopyTrack({ value, size, className, truncate }: { value: string; size?: "lg" | "xl"; className?: string; truncate?: boolean }) {
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
    <span
      className={truncate ? "copy-track-wrap copy-track-wrap--trunc" : "copy-track-wrap"}
      style={{ position: "relative", lineHeight: 1 }}
    >
      <button
        type="button"
        onClick={onClick}
        className={`copy-track-btn ${truncate ? "copy-track-btn--trunc" : ""} ${className ?? ""}`}
        aria-label="Скопировать трек-номер"
        title="Кликните чтобы скопировать"
      >
        <span className={`track-no ${sizeClass}`}>{value}</span>
      </button>
      {copied && <span className="copy-toast">скопировано</span>}
    </span>
  );
}
