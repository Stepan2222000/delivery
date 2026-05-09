import Link from "next/link";
import type { Parcel, ParcelStatus, Settings } from "@/lib/types";
import { isOverdue, overdueReason, formatDate } from "@/lib/derive";
import { StatusPill } from "@/components/shared/StatusPill";
import { CopyTrack } from "@/components/shared/CopyTrack";

const FILTERS: { key: string; label: string; statuses: ParcelStatus[] | "all" | "late" }[] = [
  { key: "all",          label: "Все",          statuses: "all" },
  { key: "ordered",      label: "В пути в США", statuses: ["ordered"] },
  { key: "arrived_usa",  label: "На складе США", statuses: ["arrived_usa", "received_by_forwarder_usa"] },
  { key: "to_kg",        label: "В пути в КГ",  statuses: ["in_shipment_usa_to_kg"] },
  { key: "arrived_kg",   label: "На складе КГ", statuses: ["arrived_kg"] },
  { key: "to_ru",        label: "В пути в РФ",  statuses: ["in_shipment_kg_to_ru"] },
  { key: "delivered",    label: "Доставлено",   statuses: ["delivered_ru"] },
  { key: "late",         label: "Долго не доезжает", statuses: "late" },
];

function rowDate(p: Parcel, late: boolean): string {
  if (late) return overdueReason(p);
  switch (p.status) {
    case "ordered": return p.etaUsa ? `придёт ${formatDate(p.etaUsa)}` : "—";
    case "arrived_usa": return p.arrivedUsaAt ? `прибыл ${formatDate(p.arrivedUsaAt)}` : "—";
    case "received_by_forwarder_usa": return p.receivedUsaAt ? `на складе США ${formatDate(p.receivedUsaAt)}` : "—";
    case "in_shipment_usa_to_kg": return p.receivedUsaAt ? `отправлен ${formatDate(p.receivedUsaAt)}` : "—";
    case "arrived_kg": return p.arrivedKgAt ? `в КГ ${formatDate(p.arrivedKgAt)}` : "—";
    case "in_shipment_kg_to_ru": return p.arrivedKgAt ? `отправлен ${formatDate(p.arrivedKgAt)}` : "—";
    case "delivered_ru": return p.deliveredRuAt ? `доставлен ${formatDate(p.deliveredRuAt)}` : "—";
    case "not_received_ru": return "не получено";
    case "cancelled": return "отменено";
  }
}

export function ParcelsTable({
  parcels, q, filter, settings, today,
}: {
  parcels: Parcel[];
  q: string;
  filter: string;
  settings: Settings;
  today: string;
}) {
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];

  const counts = Object.fromEntries(FILTERS.map((f) => {
    if (f.statuses === "all") return [f.key, parcels.filter((p) => p.status !== "cancelled").length];
    if (f.statuses === "late") return [f.key, parcels.filter((p) => p.status !== "cancelled" && isOverdue(p, settings, today)).length];
    return [f.key, parcels.filter((p) => (f.statuses as ParcelStatus[]).includes(p.status)).length];
  }));

  let rows = parcels.filter((p) => p.status !== "cancelled");
  if (active.statuses !== "all") {
    if (active.statuses === "late") rows = rows.filter((p) => isOverdue(p, settings, today));
    else rows = rows.filter((p) => (active.statuses as ParcelStatus[]).includes(p.status));
  }
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter((p) =>
      p.trackingNumber.toLowerCase().includes(needle) ||
      (p.adminOnly?.itemTitle ?? "").toLowerCase().includes(needle) ||
      (p.adminOnly?.sourceOrderNumber ?? "").toLowerCase().includes(needle)
    );
  }

  return (
    <section className="card" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
        <h2 className="title-lg" style={{ color: "var(--on-dark-strong)", margin: 0 }}>Все треки</h2>
        <span className="caption">{rows.length} из {parcels.filter(p => p.status !== "cancelled").length}</span>
      </div>

      <div className="chip-row" style={{ marginBottom: 16 }}>
        {FILTERS.map((f) => {
          const params = new URLSearchParams();
          if (f.key !== "all") params.set("filter", f.key);
          if (q) params.set("q", q);
          const qs = params.toString();
          return (
            <Link key={f.key} href={qs ? `/admin?${qs}` : "/admin"} scroll={false} className={`chip ${f.key === active.key ? "on" : ""}`}>
              {f.label}<span className="ct">{counts[f.key]}</span>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="body-sm muted" style={{ margin: 0, padding: "24px 0", textAlign: "center" }}>Ничего не нашлось.</p>
      ) : (
        <div className="at-list">
          <div className="at-row at-head">
            <div className="at-c at-track caption">Трек</div>
            <div className="at-c at-item caption">Содержимое</div>
            <div className="at-c at-status caption">Статус</div>
            <div className="at-c at-date caption">Дата</div>
            <div className="at-c at-pay caption" style={{ textAlign: "right" }}>Оплата</div>
          </div>
          {rows.map((p) => {
            const late = isOverdue(p, settings, today);
            const cost = p.adminOnly?.shippingCostUsdSnapshot ?? null;
            return (
              <Link key={p.trackingNumber} href={`/admin/track/${p.trackingNumber}`} className={`at-row ${late ? "at-row-late" : ""}`}>
                <div className="at-c at-track"><CopyTrack value={p.trackingNumber} /></div>
                <div className="at-c at-item">
                  <span className="body-sm muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{p.adminOnly?.itemTitle ?? ""}</span>
                </div>
                <div className="at-c at-status"><StatusPill status={p.status} /></div>
                <div className="at-c at-date">
                  <span className="body-sm" style={{ color: late ? "var(--error-text)" : "var(--on-dark-soft)", whiteSpace: "nowrap" }}>{rowDate(p, late)}</span>
                </div>
                <div className="at-c at-pay" style={{ textAlign: "right" }}>
                  <span className="body-sm mono" style={{ color: cost ? "var(--on-dark-strong)" : "var(--on-dark-faint)", whiteSpace: "nowrap" }}>
                    {cost ? `$${cost.toFixed(2)}` : "—"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
