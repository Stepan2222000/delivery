import type { Parcel } from "@/lib/types";
import { formatDate } from "@/lib/derive";

export function TrackStages({ parcel }: { parcel: Parcel }) {
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
  );
}
