import Link from "next/link";
import type { Parcel, Settings } from "@/lib/types";
import { StatusPill } from "@/components/shared/StatusPill";
import { CopyTrack } from "@/components/shared/CopyTrack";
import { formatDate, formatRelative, isOverdue, overdueReason } from "@/lib/derive";
import { IconChevronRight } from "@/components/shared/Icons";

export function ParcelCard({ parcel, settings, today }: { parcel: Parcel; settings: Settings; today: string }) {
  const late = isOverdue(parcel, settings, today);
  const subtitle = late
    ? overdueReason(parcel)
    : (() => {
        switch (parcel.status) {
          case "ordered": return parcel.etaUsa ? `придёт ${formatDate(parcel.etaUsa)} (${formatRelative(parcel.etaUsa, today)})` : "дата прибытия неизвестна";
          case "arrived_usa": return `Прибыл в США ${formatRelative(parcel.arrivedUsaAt!, today)}`;
          case "received_by_forwarder_usa": return `На складе США с ${formatDate(parcel.receivedUsaAt!)}`;
          case "in_shipment_usa_to_kg": return `Отправлен в КГ ${formatRelative(parcel.receivedUsaAt!, today)}`;
          case "arrived_kg": return parcel.weightKg ? `В КГ — ${parcel.weightKg} кг` : "В КГ — вес не указан";
          case "in_shipment_kg_to_ru": return `Отправлен в РФ ${formatRelative(parcel.arrivedKgAt!, today)}`;
          case "delivered_ru": return `Доставлено ${formatDate(parcel.deliveredRuAt!)}`;
          case "not_received_ru": return "Не получено в РФ";
          case "cancelled": return "Отменено в источнике";
        }
      })();

  return (
    <Link
      href={`/forwarder/track/${parcel.trackingNumber}`}
      className={`card fade-up ${late ? "parcel-card-late" : ""}`}
      style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 12, padding: 18, borderRadius: 14 }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
          <StatusPill status={parcel.status} />
          {parcel.notes && <span className="caption" style={{ color: "var(--on-dark-faint)" }}>заметка</span>}
        </div>
        <div style={{ marginBottom: 6 }}>
          <CopyTrack value={parcel.trackingNumber} size="lg" />
        </div>
        <div className="body-sm subtitle" style={{ color: "var(--on-dark-soft)" }}>{subtitle}</div>
      </div>
      <IconChevronRight width={20} height={20} style={{ color: "var(--on-dark-faint)" }} />
    </Link>
  );
}
