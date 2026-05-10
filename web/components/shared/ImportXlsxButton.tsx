"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface PreviewItem {
  tracking_number: string;
  action: "update" | "skip" | "error";
  changes: Record<string, unknown>;
  reason: string | null;
}

interface PreviewResp {
  will_update: number;
  skipped: number;
  errors: number;
  items: PreviewItem[];
}

export function ImportXlsxButton() {
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewResp | null>(null);
  const [pending, startTransition] = useTransition();
  const [loadError, setLoadError] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLoadError(null);
    const fd = new FormData();
    fd.append("file", f);
    try {
      const res = await fetch("/api/import/preview", { method: "POST", body: fd });
      if (!res.ok) {
        setLoadError(`Не удалось разобрать файл (${res.status})`);
        return;
      }
      setPreview(await res.json());
    } catch (err) {
      setLoadError(String(err));
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const apply = () => {
    if (!preview) return;
    startTransition(async () => {
      const res = await fetch("/api/import/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: preview.items }),
      });
      if (res.ok) {
        setPreview(null);
        router.refresh();
      } else {
        setLoadError(`Применение не удалось (${res.status})`);
      }
    });
  };

  const updates = preview?.items.filter((i) => i.action === "update") ?? [];
  const errs = preview?.items.filter((i) => i.action === "error") ?? [];

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept=".xlsx"
        style={{ display: "none" }}
        onChange={onFile}
      />
      <button className="btn btn-secondary btn-sm" onClick={() => fileInput.current?.click()}>
        Импорт xlsx
      </button>

      {loadError && (
        <Modal title="Ошибка" onClose={() => setLoadError(null)}>
          <p className="body-sm" style={{ margin: 0 }}>{loadError}</p>
        </Modal>
      )}

      {preview && (
        <Modal title="Что изменится после импорта" onClose={() => setPreview(null)} wide>
          <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
            <Stat label="Обновится" n={preview.will_update} color="var(--brand-coral)" />
            <Stat label="Без изменений" n={preview.skipped} color="var(--on-dark-soft)" />
            <Stat label="Ошибок" n={preview.errors} color="var(--error-text)" />
          </div>

          {updates.length > 0 && (
            <Section title="Обновится">
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                {updates.map((u) => (
                  <li key={u.tracking_number} className="body-xs" style={{ padding: "8px 10px", background: "rgba(204,120,92,0.10)", borderRadius: 6 }}>
                    <span className="mono">{u.tracking_number}</span> — {Object.entries(u.changes).map(([k, v]) => `${labelOf(k)}: ${String(v)}`).join(", ")}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {errs.length > 0 && (
            <Section title="Ошибки (будут пропущены)">
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                {errs.map((er) => (
                  <li key={er.tracking_number || Math.random()} className="body-xs" style={{ padding: "8px 10px", background: "rgba(198,69,69,0.12)", borderRadius: 6 }}>
                    <span className="mono">{er.tracking_number || "—"}</span> — {er.reason}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={() => setPreview(null)} disabled={pending}>
              Отмена
            </button>
            <button className="btn btn-primary" onClick={apply} disabled={pending || updates.length === 0}>
              {pending ? "Применяю…" : `Применить ${updates.length}`}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function labelOf(k: string): string {
  switch (k) {
    case "weight_kg": return "вес, кг";
    case "status": return "статус";
    case "notes": return "заметка";
    default: return k;
  }
}

function Stat({ label, n, color }: { label: string; n: number; color: string }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: 28, color, lineHeight: 1 }}>{n}</div>
      <div className="caption muted" style={{ marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="caption-up" style={{ marginBottom: 6 }}>{title}</div>
      <div style={{ maxHeight: 220, overflowY: "auto" }}>{children}</div>
    </div>
  );
}

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div role="dialog" aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--product-bg)", border: "1px solid var(--product-stroke)",
          borderRadius: 12, padding: 20, maxWidth: wide ? 720 : 480, width: "100%",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h3 className="title-md" style={{ margin: 0, color: "var(--on-dark-strong)" }}>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
