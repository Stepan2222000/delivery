"use client";

import {
  createContext, useCallback, useContext, useMemo, useState,
  type ReactNode,
} from "react";

interface SelectionState {
  selected: Set<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  setMany: (ids: string[], on: boolean) => void;
  clear: () => void;
  count: number;
}

const Ctx = createContext<SelectionState | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const setMany = useCallback((ids: string[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) ids.forEach((id) => next.add(id));
      else ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const value = useMemo<SelectionState>(
    () => ({ selected, isSelected, toggle, setMany, clear, count: selected.size }),
    [selected, isSelected, toggle, setMany, clear],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSelection(): SelectionState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSelection must be used inside SelectionProvider");
  return v;
}

export function RowCheckbox({ id, ariaLabel }: { id: string; ariaLabel?: string }) {
  const { isSelected, toggle } = useSelection();
  const checked = isSelected(id);
  return (
    <label
      onClick={(e) => e.stopPropagation()}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 28, height: 28, cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        aria-label={ariaLabel ?? "Выбрать"}
        checked={checked}
        onChange={() => toggle(id)}
        style={{ width: 18, height: 18, accentColor: "var(--brand-coral)", cursor: "pointer" }}
      />
    </label>
  );
}

export function HeaderCheckbox({ ids }: { ids: string[] }) {
  const { selected, setMany } = useSelection();
  const allChecked = ids.length > 0 && ids.every((id) => selected.has(id));
  const indeterminate = !allChecked && ids.some((id) => selected.has(id));
  return (
    <label style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, cursor: "pointer" }}>
      <input
        type="checkbox"
        aria-label="Выбрать всё"
        checked={allChecked}
        ref={(el) => { if (el) el.indeterminate = indeterminate; }}
        onChange={() => setMany(ids, !allChecked)}
        style={{ width: 18, height: 18, accentColor: "var(--brand-coral)", cursor: "pointer" }}
      />
    </label>
  );
}
