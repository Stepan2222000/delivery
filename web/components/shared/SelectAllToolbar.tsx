"use client";

import { HeaderCheckbox, useSelection } from "./Selection";

export function SelectAllToolbar({ ids, label }: { ids: string[]; label: string }) {
  const { count } = useSelection();
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "8px 12px", marginBottom: 8,
        borderBottom: "1px solid var(--product-stroke)",
      }}
    >
      <HeaderCheckbox ids={ids} />
      <span className="caption muted">
        {count > 0 ? `выбрано ${count} из ${ids.length}` : `выбрать всё · ${label}`}
      </span>
    </div>
  );
}
