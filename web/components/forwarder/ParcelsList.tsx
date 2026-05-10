import Link from "next/link";
import type { Parcel, Settings } from "@/lib/types";
import { StatusPill } from "@/components/shared/StatusPill";
import { CopyTrack } from "@/components/shared/CopyTrack";
import { formatDate, formatRelative, isOverdue, overdueReason } from "@/lib/derive";
import { IconChevronRight } from "@/components/shared/Icons";
import { RowCheckbox } from "@/components/shared/Selection";

function rowSubtitle(p: Parcel, late: boolean, today: string): string {
  if (late) return overdueReason(p);
  switch (p.status) {
    case "ordered": return p.etaUsa ? `придёт ${formatDate(p.etaUsa)}` : "дата прибытия неизвестна";
    case "arrived_usa": return `прибыл ${formatRelative(p.arrivedUsaAt!, today)}`;
    case "received_by_forwarder_usa": return `на складе США с ${formatDate(p.receivedUsaAt!)}`;
    case "in_shipment_usa_to_kg": return `в КГ — отправлен ${formatRelative(p.receivedUsaAt!, today)}`;
    case "arrived_kg": return p.weightKg ? `${p.weightKg} кг` : "вес не указан";
    case "in_shipment_kg_to_ru": return `в РФ — отправлен ${formatRelative(p.arrivedKgAt!, today)}`;
    case "delivered_ru": return `доставлено ${formatDate(p.deliveredRuAt!)}`;
    case "not_received_ru": return "не получено в РФ";
    case "cancelled": return "отменено";
  }
}

export function ParcelsList({ parcels, settings, today }: { parcels: Parcel[]; settings: Settings; today: string }) {
  return (
    <div className="parcels-list fade-up">
      {parcels.map((p) => {
        const late = isOverdue(p, settings, today);
        return (
          <div key={p.trackingNumber} className={`pl-row ${late ? "pl-row-late" : ""}`}>
            <div className="pl-check"><RowCheckbox id={p.trackingNumber} ariaLabel={p.trackingNumber} /></div>
            <Link
              href={`/forwarder/track/${p.trackingNumber}`}
              className="pl-row-inner"
              style={{ display: "contents" }}
            >
              <div className="pl-track"><CopyTrack value={p.trackingNumber} truncate /></div>
              <div className="pl-status"><StatusPill status={p.status} /></div>
              <div className="pl-date">{rowSubtitle(p, late, today)}</div>
              <div className="pl-chevron"><IconChevronRight width={18} height={18} /></div>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
