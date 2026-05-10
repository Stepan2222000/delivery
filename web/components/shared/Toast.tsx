"use client";

import { useEffect, useState } from "react";
import { IconAlert, IconX } from "./Icons";

export function Toast({
  message,
  detail,
  tone = "error",
}: {
  message: string;
  detail?: string;
  tone?: "error" | "warning" | "success";
}) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setOpen(false), 8000);
    return () => clearTimeout(t);
  }, []);

  if (!open) return null;

  const palette =
    tone === "error"
      ? { bg: "rgba(198,69,69,0.14)", border: "var(--error-text)", color: "var(--error-text)" }
      : tone === "warning"
      ? { bg: "rgba(212,160,23,0.18)", border: "var(--warning)", color: "var(--warning)" }
      : { bg: "rgba(93,184,114,0.16)", border: "var(--success)", color: "var(--success)" };

  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 24,
        transform: "translateX(-50%)",
        maxWidth: "min(560px, calc(100vw - 32px))",
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 10,
        padding: "12px 16px",
        color: palette.color,
        boxShadow: "var(--shadow-2)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        fontFamily: "var(--font-sans)",
        fontSize: 14,
        lineHeight: 1.4,
      }}
    >
      <IconAlert width={18} height={18} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{message}</div>
        {detail && (
          <div style={{ marginTop: 4, opacity: 0.85, wordBreak: "break-all" }}>{detail}</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Закрыть"
        style={{
          background: "transparent",
          border: 0,
          color: palette.color,
          cursor: "pointer",
          padding: 0,
          flexShrink: 0,
        }}
      >
        <IconX width={16} height={16} />
      </button>
    </div>
  );
}
