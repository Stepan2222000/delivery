"use client";

import { useState } from "react";

const PRESETS = ["Фура", "СДЭК"] as const;

export function TransportSelect({ name, defaultValue }: { name: string; defaultValue?: string | null }) {
  const initial = defaultValue ?? "";
  const [value, setValue] = useState(initial);
  return (
    <>
      <div className="chip-row" style={{ marginBottom: 8 }}>
        {PRESETS.map((p) => (
          <button
            type="button"
            key={p}
            className={`chip ${value.toLowerCase() === p.toLowerCase() ? "on" : ""}`}
            onClick={() => setValue(p)}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          className={`chip ${value && !PRESETS.some(p => p.toLowerCase() === value.toLowerCase()) ? "on" : ""}`}
          onClick={() => setValue("")}
        >
          Своё
        </button>
      </div>
      <input
        type="text"
        name={name}
        className="input"
        placeholder="Транспорт"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </>
  );
}
