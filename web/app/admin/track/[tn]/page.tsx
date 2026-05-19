import Link from "next/link";
import { notFound } from "next/navigation";
import { getParcel } from "@/lib/api/parcels";
import { getShipment } from "@/lib/api/shipments";
import { ApiError } from "@/lib/api/client";
import { formatDate, formatDateFull, computeTimings } from "@/lib/derive";
import type { Shipment } from "@/lib/types";
import { StatusPill } from "@/components/shared/StatusPill";
import { IconArrowLeft, IconTruck, IconCalendar } from "@/components/shared/Icons";
import { CopyTrack } from "@/components/shared/CopyTrack";
import { TrackStages } from "@/components/shared/TrackStages";
import { TrackTimings } from "@/components/shared/TrackTimings";
import { ForceStatusButton } from "@/components/admin/ForceStatusButton";

export default async function AdminTrackDetail({ params }: { params: Promise<{ tn: string }> }) {
  const { tn } = await params;
  let parcel;
  try {
    parcel = await getParcel(decodeURIComponent(tn));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const today = new Date().toISOString();
  const timings = computeTimings(parcel, today);
  const [shipUsaToKg, shipKgToRu] = await Promise.all([
    parcel.shipmentUsaToKgId ? getShipment(parcel.shipmentUsaToKgId).catch(() => null) : Promise.resolve(null),
    parcel.shipmentKgToRuId ? getShipment(parcel.shipmentKgToRuId).catch(() => null) : Promise.resolve(null),
  ]);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <Link href="/admin" className="btn btn-ghost btn-sm" style={{ marginLeft: -8, marginBottom: 8 }}>
        <IconArrowLeft width={18} height={18} /> Дашборд
      </Link>

      <header style={{ marginBottom: 18 }}>
        <div style={{ marginBottom: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <StatusPill status={parcel.status} />
          <ForceStatusButton trackingNumber={parcel.trackingNumber} currentStatus={parcel.status} />
          {parcel.isManual ? (
            <span className="caption-up" style={{
              padding: "4px 8px", borderRadius: 4,
              background: "rgba(255,140,90,0.15)", color: "var(--accent-coral)",
            }}>Незнакомый трек</span>
          ) : null}
        </div>
        <div style={{ marginBottom: 8 }}><CopyTrack value={parcel.trackingNumber} size="xl" /></div>
        <div className="body-sm muted" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span>eBay <CopyTrack value={parcel.adminOnly.sourceOrderNumber} /></span>
          <span>·</span>
          <span>Заказан {formatDate(parcel.orderedAt)}</span>
          <span>·</span>
          <span>в системе {timings.total ?? 0} дн</span>
        </div>
      </header>

      {(shipUsaToKg || shipKgToRu) && (
        <section className="card fade-up" style={{ padding: 18, marginBottom: 14 }}>
          <div className="caption-up" style={{ marginBottom: 10 }}>Отгрузки</div>
          {shipUsaToKg && <ShipmentRow label="США → КГ" sh={shipUsaToKg} />}
          {shipKgToRu && <ShipmentRow label="КГ → РФ" sh={shipKgToRu} />}
        </section>
      )}

      <section className="card fade-up" style={{ padding: 0, marginBottom: 14 }}>
        <div style={{ padding: "16px 18px 8px" }}>
          <div className="caption-up">Этапы</div>
        </div>
        <TrackStages parcel={parcel} />
      </section>

      <section className="card fade-up" style={{ padding: 18, marginBottom: 14 }}>
        <div className="caption-up" style={{ marginBottom: 10 }}>Сроки</div>
        <TrackTimings timings={timings} />
      </section>

      <p className="body-xs muted" style={{ textAlign: "center", marginTop: 24 }}>
        Полный путь зафиксирован {formatDateFull(parcel.orderedAt)} → сегодня
      </p>
    </div>
  );
}

function ShipmentRow({ label, sh }: { label: string; sh: Shipment | null }) {
  if (!sh) return null;
  return (
    <Link href={`/forwarder/shipment/${sh.id}`} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, padding: "10px 0", borderTop: "1px solid var(--product-stroke)", alignItems: "center" }}>
      <span className="caption" style={{ minWidth: 70 }}>{label}</span>
      <div className="body-sm" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        {sh.transport && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><IconTruck width={12} height={12} /> {sh.transport}</span>}
        {sh.sentAt && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><IconCalendar width={12} height={12} /> отправлено {formatDate(sh.sentAt)}</span>}
        {!sh.sentAt && sh.plannedSentAt && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><IconCalendar width={12} height={12} /> план: {formatDate(sh.plannedSentAt)}</span>}
        {sh.waybillNo && <span className="mono caption">{sh.waybillNo}</span>}
      </div>
      <span className="caption">{sh.id}</span>
    </Link>
  );
}
