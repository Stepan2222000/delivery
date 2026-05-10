"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useSelection } from "./Selection";
import {
  bulkChangeStatus,
  bulkAddToShipment,
  bulkRemoveFromShipment,
  bulkReceiveShipment,
  type BulkResult,
} from "@/lib/bulk-actions";

export type BulkRole = "admin" | "forwarder";

const STATUS_LABELS: { value: string; label: string }[] = [
  { value: "ordered", label: "заказано" },
  { value: "arrived_usa", label: "прибыл в США" },
  { value: "received_by_forwarder_usa", label: "получен в США" },
  { value: "in_shipment_usa_to_kg", label: "в пути в КГ" },
  { value: "arrived_kg", label: "прибыл в КГ" },
  { value: "in_shipment_kg_to_ru", label: "в пути в РФ" },
  { value: "delivered_ru", label: "доставлен в РФ" },
  { value: "not_received_ru", label: "не получено в РФ" },
];

// Forwarder may set only these three; the rest are either auto (arrived_usa,
// in_shipment_kg_to_ru) or admin-only (delivered_ru / not_received_ru).
const FORWARDER_ALLOWED = new Set([
  "received_by_forwarder_usa",
  "in_shipment_usa_to_kg",
  "arrived_kg",
]);

interface OpenDraft { id: string; transport: string | null; trackCount: number }

export interface BulkContextProps {
  role: BulkRole;
  shipmentId?: string; // when on a draft shipment page → "remove from shipment" available
  receiveMode?: { shipmentId: string }; // when on receive page → received/not_received
  openDrafts?: OpenDraft[];             // for forwarder home → "add to shipment"
}

export function BulkActionBar(props: BulkContextProps) {
  const { selected, count, clear } = useSelection();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<null | "status" | "addShip">(null);
  const [report, setReport] = useState<BulkResult | null>(null);

  if (count === 0) return null;
  const ids = Array.from(selected);

  const downloadXlsx = () => {
    const url = `/api/export.xlsx?ids=${encodeURIComponent(ids.join(","))}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    a.click();
  };

  const onStatus = (status: string) => {
    setOpen(null);
    startTransition(async () => {
      const r = await bulkChangeStatus(ids, status);
      setReport(r);
      if (r.errors.length === 0) clear();
      router.refresh();
    });
  };

  const onAddShip = (sid: string) => {
    setOpen(null);
    startTransition(async () => {
      const r = await bulkAddToShipment(ids, sid);
      setReport(r);
      if (r.errors.length === 0) clear();
      router.refresh();
    });
  };

  const onRemoveShip = () => {
    if (!props.shipmentId) return;
    startTransition(async () => {
      const r = await bulkRemoveFromShipment(ids, props.shipmentId!);
      setReport(r);
      if (r.errors.length === 0) clear();
      router.refresh();
    });
  };

  const onReceive = (received: boolean) => {
    if (!props.receiveMode) return;
    startTransition(async () => {
      await bulkReceiveShipment(props.receiveMode!.shipmentId, ids, received);
      clear();
      router.refresh();
    });
  };

  const allowedStatuses = props.role === "forwarder"
    ? STATUS_LABELS.filter((s) => FORWARDER_ALLOWED.has(s.value))
    : STATUS_LABELS;

  return (
    <>
      <div className="bulk-bar">
        <div className="bulk-count">Выбрано {count}</div>
        <div className="bulk-actions">
          <button className="btn btn-secondary btn-sm" onClick={downloadXlsx} disabled={pending}>
            Скачать xlsx
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setOpen("status")} disabled={pending}>
            Сменить статус
          </button>
          {props.role === "forwarder" && props.openDrafts && props.openDrafts.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={() => setOpen("addShip")} disabled={pending}>
              В отгрузку
            </button>
          )}
          {props.shipmentId && !props.receiveMode && (
            <button className="btn btn-secondary btn-sm" onClick={onRemoveShip} disabled={pending}>
              Убрать из отгрузки
            </button>
          )}
          {props.receiveMode && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => onReceive(true)} disabled={pending}>
                Получено
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => onReceive(false)} disabled={pending}>
                Не получено
              </button>
            </>
          )}
          <button className="btn btn-ghost btn-sm" onClick={clear} disabled={pending}>
            Снять
          </button>
        </div>
      </div>

      {open === "status" && (
        <Modal title="Сменить статус выбранных" onClose={() => setOpen(null)}>
          <div style={{ display: "grid", gap: 8 }}>
            {allowedStatuses.map((s) => (
              <button key={s.value} className="btn btn-secondary btn-block" onClick={() => onStatus(s.value)}>
                {s.label}
              </button>
            ))}
          </div>
          <p className="body-xs muted" style={{ marginTop: 12 }}>
            {props.role === "forwarder"
              ? "Доступны только переходы вперёд по конвейеру."
              : "Менеджер может выставить любой статус. Откаты назад применятся без вопросов."}
            {" "}Несовместимые переходы будут пропущены и показаны в отчёте.
          </p>
        </Modal>
      )}

      {open === "addShip" && props.openDrafts && (
        <Modal title="В какую отгрузку добавить?" onClose={() => setOpen(null)}>
          <div style={{ display: "grid", gap: 8 }}>
            {props.openDrafts.map((d) => (
              <button key={d.id} className="btn btn-secondary btn-block" onClick={() => onAddShip(d.id)} style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{d.transport ?? "без транспорта"}</span>
                <span className="caption">{d.trackCount} в драфте</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {report && (
        <Modal title={`Применено: ${report.applied} · Ошибок: ${report.errors.length}`} onClose={() => setReport(null)}>
          {report.errors.length === 0 ? (
            <p className="body-sm" style={{ margin: 0 }}>Всё применилось без ошибок.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6, maxHeight: 320, overflowY: "auto" }}>
              {report.errors.map((er) => (
                <li key={er.trackingNumber} className="body-xs" style={{ padding: "8px 10px", background: "rgba(198,69,69,0.1)", borderRadius: 6 }}>
                  <span className="mono">{er.trackingNumber}</span> — {er.reason}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      <style>{`
        .bulk-bar {
          position: sticky; bottom: 12px; z-index: 30;
          margin: 16px auto 0;
          display: flex; gap: 12px; align-items: center;
          padding: 10px 14px;
          background: var(--product-bg);
          border: 1px solid var(--brand-coral);
          border-radius: 999px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.18);
          max-width: max-content;
        }
        .bulk-count {
          font-weight: 600;
          color: var(--brand-coral);
          padding: 0 6px 0 4px;
          white-space: nowrap;
        }
        .bulk-actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
        @media (max-width: 640px) {
          .bulk-bar { flex-direction: column; align-items: stretch; border-radius: 12px; bottom: 8px; max-width: calc(100% - 24px); }
          .bulk-actions { justify-content: center; }
        }
      `}</style>
    </>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--product-bg)",
          border: "1px solid var(--product-stroke)",
          borderRadius: 12, padding: 20, maxWidth: 480, width: "100%",
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
