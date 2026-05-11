"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useDevMode } from "./DevMode";
import { bulkChangeStatus } from "@/lib/bulk-actions";

const STATUS_LABELS: { value: string; label: string }[] = [
  { value: "ordered", label: "заказано" },
  { value: "arrived_usa", label: "прибыл в США" },
  { value: "received_by_forwarder_usa", label: "получен в США" },
  { value: "in_shipment_usa_to_kg", label: "в пути в КГ" },
  { value: "arrived_kg", label: "прибыл в КГ" },
  { value: "in_shipment_kg_to_ru", label: "в пути в РФ" },
  { value: "delivered_ru", label: "доставлен в РФ" },
  { value: "not_received_ru", label: "не получено в РФ" },
  { value: "cancelled", label: "отменено" },
];

export function ForceStatusButton({ trackingNumber, currentStatus }: { trackingNumber: string; currentStatus: string }) {
  const dev = useDevMode();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!dev.on) return null;

  const apply = (status: string) => {
    setError(null);
    startTransition(async () => {
      const r = await bulkChangeStatus([trackingNumber], status, true);
      if (r.errors.length > 0) {
        setError(r.errors[0].reason);
        return;
      }
      setOpen(false);
      setPick(null);
      router.refresh();
    });
  };

  return (
    <>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen(true)}
        style={{ borderColor: "var(--brand-coral)", color: "var(--brand-coral)" }}
      >
        Force смена статуса
      </button>

      {open && (
        <Modal title={pick ? "Подтвердите перенос" : "Force смена статуса"} onClose={() => { setOpen(false); setPick(null); }}>
          {!pick && (
            <>
              <p className="body-xs muted" style={{ marginTop: 0, marginBottom: 10 }}>
                Текущий статус: <b>{STATUS_LABELS.find((s) => s.value === currentStatus)?.label ?? currentStatus}</b>
              </p>
              <div style={{ display: "grid", gap: 6 }}>
                {STATUS_LABELS.map((s) => (
                  <button
                    key={s.value}
                    className="btn btn-secondary btn-block"
                    disabled={s.value === currentStatus}
                    onClick={() => setPick(s.value)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {pick && (
            <>
              <p className="body-sm" style={{ marginTop: 0 }}>
                Перенести трек <span className="mono">{trackingNumber}</span> в статус{" "}
                <b>«{STATUS_LABELS.find((s) => s.value === pick)?.label}»</b>.
              </p>
              <ul className="body-xs muted" style={{ margin: "0 0 12px 18px", padding: 0 }}>
                <li>Текущий статус и порядок этапов не проверяется.</li>
                <li>Привязка к любым отгрузкам будет снята.</li>
                <li>Действие фиксируется в истории трека с пометкой «admin force».</li>
              </ul>
              {error && (
                <p className="body-xs" style={{ color: "var(--error-text)", marginBottom: 10 }}>
                  Ошибка: {error}
                </p>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setPick(null)} disabled={pending}>
                  Назад
                </button>
                <button className="btn btn-primary" onClick={() => apply(pick)} disabled={pending}>
                  {pending ? "Применяю…" : "Подтвердить"}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true"
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--product-bg)", border: "1px solid var(--product-stroke)", borderRadius: 12, padding: 20, maxWidth: 480, width: "100%" }}
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
