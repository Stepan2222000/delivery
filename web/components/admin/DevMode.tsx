"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "delivery.devMode";

const Ctx = createContext<{ on: boolean; toggle: () => void }>({ on: false, toggle: () => {} });

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(false);
  // Hydrate from localStorage; ignore on server.
  useEffect(() => {
    try {
      setOn(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {}
  }, []);
  const toggle = () => {
    setOn((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  };
  return <Ctx.Provider value={{ on, toggle }}>{children}</Ctx.Provider>;
}

export function useDevMode() {
  return useContext(Ctx);
}

export function DevModeToggle() {
  const { on, toggle } = useDevMode();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      title={on ? "Режим разработчика включён" : "Включить режим разработчика"}
      className="btn btn-sm"
      style={{
        borderRadius: 999,
        padding: "4px 10px",
        background: on ? "var(--brand-coral)" : "transparent",
        color: on ? "var(--on-coral)" : "var(--on-dark-soft)",
        border: `1px solid ${on ? "var(--brand-coral)" : "var(--product-stroke)"}`,
        fontSize: 12,
        letterSpacing: 0.3,
        whiteSpace: "nowrap",
      }}
    >
      {on ? "DEV ON" : "DEV"}
    </button>
  );
}

export function DevModeBanner() {
  const { on } = useDevMode();
  if (!on) return null;
  return (
    <div
      style={{
        background: "rgba(204, 120, 92, 0.12)",
        borderBottom: "1px solid var(--brand-coral)",
        color: "var(--brand-coral)",
        textAlign: "center",
        padding: "6px 12px",
        fontSize: 12,
        letterSpacing: 0.3,
      }}
    >
      Режим разработчика: смена статуса применяется напрямую и снимает привязку к отгрузке
    </div>
  );
}
