"use client";

import { useState } from "react";
import { CopyTrack } from "@/components/shared/CopyTrack";
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
                gridTemplateColumns: "1fr auto auto",
                gap: 12,
                alignItems: "center",
                padding: "10px 0",
                borderTop: "1px solid var(--product-stroke)",
              }}
            >
              <CopyTrack value={p.trackingNumber} />
              <span className="body-sm muted">{p.weightKg ?? "?"} кг</span>
              <form action={addAction}>
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
