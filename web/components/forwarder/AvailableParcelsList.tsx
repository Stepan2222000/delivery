"use client";

import Link from "next/link";
import { useState } from "react";
import { CopyButton } from "@/components/shared/CopyButton";
import { IconPlus, IconSearch } from "@/components/shared/Icons";
import type { Parcel } from "@/lib/types";

export function AvailableParcelsList({
  parcels,
  shipmentId,
  addAction,
}: {
  parcels: Parcel[];
  shipmentId: string;
  addAction: (formData: FormData) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const filtered = needle ? parcels.filter((p) => p.trackingNumber.toLowerCase().includes(needle)) : parcels;

  return (
    <>
      <div className="search-bar" style={{ marginBottom: 12, minWidth: 0, width: "100%" }}>
        <IconSearch width={16} height={16} className="search-icon" aria-hidden />
        <input
          type="search"
          className="search-input"
          placeholder="Поиск по треку"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="body-sm muted" style={{ margin: 0, padding: "12px 0" }}>Ничего не нашлось.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {filtered.map((p) => (
            <li
              key={p.trackingNumber}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto auto auto",
                gap: 8,
                alignItems: "center",
                padding: "10px 0",
                borderTop: "1px solid var(--product-stroke)",
                minWidth: 0,
              }}
            >
              <Link
                href={`/forwarder/track/${p.trackingNumber}`}
                style={{
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "var(--on-dark-strong)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 14,
                  textDecoration: "none",
                  display: "block",
                }}
                title="Открыть трек"
              >
                {p.trackingNumber}
              </Link>
              <CopyButton value={p.trackingNumber} ariaLabel="Скопировать трек" />
              <span className="body-sm muted" style={{ flexShrink: 0, whiteSpace: "nowrap" }}>{p.weightKg ?? "?"} кг</span>
              <form action={addAction} style={{ flexShrink: 0 }}>
                <input type="hidden" name="id" value={shipmentId} />
                <input type="hidden" name="tn" value={p.trackingNumber} />
                <button className="btn btn-secondary btn-sm" type="submit">
                  <IconPlus width={14} height={14} /> Добавить
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <p className="body-xs muted" style={{ margin: "10px 0 0", textAlign: "right" }}>
        {filtered.length} из {parcels.length}
      </p>
    </>
  );
}
