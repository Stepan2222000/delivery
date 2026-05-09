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

  const stages = [
    { key: "ordered", label: "Заказано", date: parcel.orderedAt, done: true, current: parcel.status === "ordered" },
    { key: "arrived_usa", label: "Прибыл в США", date: parcel.arrivedUsaAt, done: !!parcel.arrivedUsaAt, current: parcel.status === "arrived_usa" },
    { key: "received_usa", label: "На складе США", date: parcel.receivedUsaAt, done: !!parcel.receivedUsaAt, current: parcel.status === "received_by_forwarder_usa" },
    { key: "to_kg", label: "В пути в КГ", date: parcel.shipmentUsaToKgId ? parcel.receivedUsaAt : null, done: !!parcel.shipmentUsaToKgId, current: parcel.status === "in_shipment_usa_to_kg" },
    { key: "arrived_kg", label: "Прибыл в КГ", date: parcel.arrivedKgAt, done: !!parcel.arrivedKgAt, current: parcel.status === "arrived_kg" },
    { key: "to_ru", label: "В пути в РФ", date: parcel.shipmentKgToRuId ? parcel.arrivedKgAt : null, done: parcel.status === "in_shipment_kg_to_ru" || parcel.status === "delivered_ru", current: parcel.status === "in_shipment_kg_to_ru" },
    { key: "delivered_ru", label: "Доставлено в РФ", date: parcel.deliveredRuAt, done: !!parcel.deliveredRuAt, current: parcel.status === "delivered_ru" },
  ];

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <Link href="/admin" className="btn btn-ghost btn-sm" style={{ marginLeft: -8, marginBottom: 8 }}>
        <IconArrowLeft width={18} height={18} /> Дашборд
      </Link>

      <header style={{ marginBottom: 18 }}>
        <div style={{ marginBottom: 10 }}><StatusPill status={parcel.status} /></div>
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
        <ol style={{ listStyle: "none", padding: "0 18px 16px", margin: 0 }}>
          {stages.map((s, i) => (
            <li key={s.key} style={{ display: "grid", gridTemplateColumns: "20px 1fr auto", columnGap: 12, alignItems: "start", paddingTop: 10, paddingBottom: 10 }}>
              <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
                <div style={{
                  width: 12, height: 12, borderRadius: "50%", marginTop: 4,
                  background: s.done ? (s.current ? "var(--brand-coral)" : "var(--accent-teal)") : "transparent",
                  border: s.done ? "0" : `2px solid ${s.current ? "var(--brand-coral)" : "var(--product-stroke)"}`,
                }} />
                {i < stages.length - 1 && (<div style={{ position: "absolute", top: 18, bottom: -10, width: 2, background: "var(--product-stroke)" }} />)}
              </div>
              <div>
                <div className="title-sm" style={{ color: s.done ? "var(--on-dark-strong)" : "var(--on-dark-faint)", fontWeight: s.current ? 600 : 500 }}>{s.label}</div>
                {s.key === "arrived_kg" && parcel.weightKg && (<div className="body-xs muted">{parcel.weightKg} кг</div>)}
              </div>
              <div className="body-xs mono muted" style={{ whiteSpace: "nowrap" }}>{s.date ? formatDate(s.date) : "—"}</div>
            </li>
          ))}
        </ol>
      </section>

      <section className="card fade-up" style={{ padding: 18, marginBottom: 14 }}>
        <div className="caption-up" style={{ marginBottom: 10 }}>Сроки</div>
        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "1fr auto", rowGap: 8, columnGap: 12 }}>
          <Row label="В пути в США" value={timings.inUsaTransit !== null ? `${timings.inUsaTransit} дн` : "—"} />
          <Row label="На складе США" value={timings.dwellUsa !== null ? `${timings.dwellUsa} дн` : "—"} />
          <Row label="США → КГ" value={timings.usaToKg !== null ? `${timings.usaToKg} дн` : "—"} />
          <Row label="На складе КГ" value={timings.dwellKg !== null ? `${timings.dwellKg} дн` : "—"} />
          <Row label="КГ → РФ" value={timings.kgToRu !== null ? `${timings.kgToRu} дн` : "—"} />
          <Row label="Всего" value={`${timings.total ?? 0} дн`} strong />
        </dl>
      </section>

      <p className="body-xs muted" style={{ textAlign: "center", marginTop: 24 }}>
        Полный путь зафиксирован {formatDateFull(parcel.orderedAt)} → сегодня
      </p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <>
      <dt className="body-sm muted" style={{ margin: 0 }}>{label}</dt>
      <dd className="body-sm mono" style={{ margin: 0, fontWeight: strong ? 600 : 400, textAlign: "right", color: strong ? "var(--on-dark-strong)" : undefined }}>{value}</dd>
    </>
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
