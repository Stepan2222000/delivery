import Link from "next/link";
import { listParcels } from "@/lib/api/parcels";
import { listShipments } from "@/lib/api/shipments";
import { getSettings } from "@/lib/api/settings";
import { isOverdue, overdueReason, formatDate } from "@/lib/derive";
import { SelectionProvider } from "@/components/shared/Selection";
import { BulkActionBar } from "@/components/shared/BulkActionBar";
import { ImportXlsxButton } from "@/components/shared/ImportXlsxButton";
import { IconAlert, IconChevronRight } from "@/components/shared/Icons";
import { CopyTrack } from "@/components/shared/CopyTrack";
import type { ParcelStatus } from "@/lib/types";
import { ParcelsTable } from "@/components/admin/ParcelsTable";

const STAGE_GROUPS: { key: string; label: string; statuses: ParcelStatus[] }[] = [
  { key: "ordered",     label: "В пути в США",  statuses: ["ordered"] },
  { key: "arrived_usa", label: "На складе США", statuses: ["arrived_usa", "received_by_forwarder_usa"] },
  { key: "to_kg",       label: "В пути в КГ",   statuses: ["in_shipment_usa_to_kg"] },
  { key: "kg",          label: "На складе КГ",  statuses: ["arrived_kg"] },
  { key: "to_ru",       label: "В пути в РФ",   statuses: ["in_shipment_kg_to_ru"] },
  { key: "delivered",   label: "Доставлено",    statuses: ["delivered_ru"] },
];

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string }> }) {
  const { q = "", filter = "all" } = await searchParams;
  const [parcels, shipments, settings] = await Promise.all([
    listParcels(),
    listShipments(),
    getSettings(),
  ]);
  const today = new Date().toISOString();
  const overdue = parcels.filter((p) => p.status !== "cancelled" && isOverdue(p, settings, today));
  const inTransitShipments = shipments.filter((s) => s.status === "in_transit");
  const totalOwed = parcels
    .filter((p) => p.status === "in_shipment_kg_to_ru")
    .reduce((sum, p) => sum + (p.adminOnly.shippingCostUsdSnapshot ?? 0), 0);

  // Search mode — when query is present, hide dashboard chrome and show
  // only the parcels table (which already filters by q internally).
  if (q) {
    return (
      <SelectionProvider>
        <div>
          <header style={{ marginBottom: 24 }}>
            <p className="caption-up" style={{ marginBottom: 8 }}>Поиск</p>
            <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 36, letterSpacing: "-0.6px", fontWeight: 400, margin: 0 }}>
              «{q}»
            </h1>
          </header>
          <ParcelsTable parcels={parcels} q={q} filter={filter} settings={settings} today={today} />
          <BulkActionBar role="admin" />
        </div>
      </SelectionProvider>
    );
  }

  return (
    <SelectionProvider>
    <div>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <p className="caption-up" style={{ marginBottom: 8 }}>9 мая 2026 · сегодня</p>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 44, letterSpacing: "-0.8px", fontWeight: 400, margin: 0 }}>
            Главная.
          </h1>
        </div>
        <div className="caption muted">Тариф {settings.tariffUsdPerKg}$/кг · с {formatDate(settings.tariffEffectiveFrom)}</div>
      </header>

      {overdue.length > 0 && (
        <section className="hot-panel fade-up" style={{ marginBottom: 20 }}>
          <div className="hot-title">
            <IconAlert width={16} height={16} />
            Долго не доезжает · {overdue.length}
          </div>
          {overdue.map((p) => (
            <Link key={p.trackingNumber} href={`/admin/track/${p.trackingNumber}`} className="hot-row">
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 14, alignItems: "center", minWidth: 0 }}>
                <CopyTrack value={p.trackingNumber} />
                <span className="body-sm" style={{ color: "var(--error-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {overdueReason(p)} · {p.adminOnly.itemTitle}
                </span>
              </div>
              <IconChevronRight width={18} height={18} style={{ color: "var(--error-text)" }} />
            </Link>
          ))}
        </section>
      )}

      <section style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 20 }}>
        <ImportXlsxButton />
      </section>

      <section className="stat-grid" style={{ marginBottom: 20 }}>
        {STAGE_GROUPS.map((g) => {
          const count = parcels.filter((p) => g.statuses.includes(p.status)).length;
          return (
            <div key={g.key} className="card fade-up" style={{ padding: 22 }}>
              <div className="caption muted" style={{ marginBottom: 8 }}>{g.label}</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 44, lineHeight: 1, fontWeight: 400, color: "var(--on-dark-strong)" }}>{count}</div>
            </div>
          );
        })}
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginBottom: 24 }} className="dash-row">
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 className="title-lg" style={{ color: "var(--on-dark-strong)", margin: 0 }}>Активные отгрузки</h2>
            <span className="caption">{inTransitShipments.length} в пути</span>
          </div>
          {inTransitShipments.length === 0 ? (
            <p className="body-sm muted" style={{ margin: 0 }}>Сейчас отгрузок в пути нет.</p>
          ) : (
            <div>
              {inTransitShipments.map((s) => (
                <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center", padding: "14px 0", borderTop: "1px solid var(--product-stroke)" }}>
                  <div>
                    <div className="title-sm" style={{ color: "var(--on-dark-strong)" }}>
                      {s.direction === "usa_to_kg" ? "США → КГ" : "КГ → РФ"}
                      {s.transport && <span className="caption muted" style={{ marginLeft: 8 }}>· {s.transport}</span>}
                      {s.waybillNo && <span className="caption muted" style={{ marginLeft: 8 }}>· {s.waybillNo}</span>}
                    </div>
                    <div className="caption muted">{s.trackingNumbers.length} треков · отправлено {s.sentAt ? formatDate(s.sentAt) : "—"}</div>
                  </div>
                  {s.direction === "kg_to_ru" ? (
                    <Link href={`/admin/shipment/${s.id}/receive`} className="btn btn-primary btn-sm">Принять</Link>
                  ) : <span />}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h2 className="title-md" style={{ color: "var(--on-dark-strong)", margin: "0 0 12px" }}>К оплате</h2>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 44, lineHeight: 1, fontWeight: 400, color: "var(--on-dark-strong)", marginBottom: 6 }}>
            ${totalOwed.toFixed(2)}
          </div>
          <p className="body-sm muted" style={{ margin: 0 }}>
            Сумма за треки в активных отгрузках КГ → РФ по текущему тарифу.
          </p>
          <p className="body-xs muted" style={{ marginTop: 12 }}>Перевозчики этой суммы не видят.</p>
        </div>
      </section>

      <ParcelsTable parcels={parcels} q={q} filter={filter} settings={settings} today={today} />
      <BulkActionBar role="admin" />

      <style>{`@media (max-width: 900px) { .dash-row { grid-template-columns: 1fr !important; } }`}</style>
    </div>
    </SelectionProvider>
  );
}
