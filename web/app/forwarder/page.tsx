import Link from "next/link";
import { listParcels } from "@/lib/api/parcels";
import { listShipments } from "@/lib/api/shipments";
import { getSettings } from "@/lib/api/settings";
import { isOverdue, overdueReason, formatDate } from "@/lib/derive";
import { SelectionProvider } from "@/components/shared/Selection";
import { BulkActionBar } from "@/components/shared/BulkActionBar";
import { ImportXlsxButton } from "@/components/shared/ImportXlsxButton";
import { SelectAllToolbar } from "@/components/shared/SelectAllToolbar";
import { ParcelsList } from "@/components/forwarder/ParcelsList";
import { IconAlert, IconChevronRight, IconTruck, IconCalendar } from "@/components/shared/Icons";
import { CopyTrack } from "@/components/shared/CopyTrack";
import type { ParcelStatus } from "@/lib/types";

const TABS: { key: string; label: string; statuses: ParcelStatus[] }[] = [
  { key: "usa", label: "В США", statuses: ["ordered", "arrived_usa", "received_by_forwarder_usa"] },
  { key: "to_kg", label: "В пути в КГ", statuses: ["in_shipment_usa_to_kg"] },
  { key: "kg", label: "В КГ", statuses: ["arrived_kg"] },
  { key: "to_ru", label: "В РФ", statuses: ["in_shipment_kg_to_ru", "delivered_ru"] },
];

export default async function ForwarderHome({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab = "usa", q = "" } = await searchParams;
  const query = q.trim().toLowerCase();
  const active = TABS.find((t) => t.key === tab) ?? TABS[0];

  const [parcels, shipments, settings] = await Promise.all([
    listParcels(),
    listShipments(),
    getSettings(),
  ]);
  const today = new Date().toISOString();
  const visible = parcels.filter((p) => p.status !== "cancelled");
  const overdue = visible.filter((p) => isOverdue(p, settings, today));
  const drafts = shipments.filter((s) => s.status === "draft" && s.direction === "kg_to_ru");

  const filterByQ = (p: { trackingNumber: string }) => !query || p.trackingNumber.toLowerCase().includes(query);

  if (query) {
    const results = visible.filter(filterByQ);
    return (
      <SelectionProvider>
        <header style={{ marginBottom: 24 }}>
          <p className="caption-up" style={{ marginBottom: 8 }}>Поиск</p>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 32, letterSpacing: "-0.5px", fontWeight: 400, margin: 0 }}>
            «{q}» — {results.length} {results.length === 1 ? "трек" : "треков"}
          </h1>
        </header>
        {results.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: "center" }}>
            <p className="body-md" style={{ margin: 0 }}>Ничего не нашлось.</p>
          </div>
        ) : (
          <>
            <SelectAllToolbar ids={results.map((p) => p.trackingNumber)} label={`найдено ${results.length}`} />
            <ParcelsList parcels={results} settings={settings} today={today} />
          </>
        )}
        <BulkActionBar role="forwarder" openDrafts={drafts.map((d) => ({ id: d.id, transport: d.transport, trackCount: d.trackingNumbers.length }))} />
      </SelectionProvider>
    );
  }

  const inTab = visible.filter((p) => active.statuses.includes(p.status));
  const counts = Object.fromEntries(TABS.map((t) => [t.key, visible.filter((p) => t.statuses.includes(p.status)).length]));

  return (
    <SelectionProvider>
      <header style={{ marginBottom: 24 }}>
        <p className="caption-up" style={{ marginBottom: 8 }}>9 мая 2026 · сегодня</p>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 40, letterSpacing: "-0.6px", fontWeight: 400, margin: 0, lineHeight: 1 }}>
          Треки.
        </h1>
      </header>

      {overdue.length > 0 && (
        <section className="hot-panel fade-up" style={{ marginBottom: 22 }}>
          <div className="hot-title">
            <IconAlert width={16} height={16} />
            Долго не доезжает · {overdue.length}
          </div>
          {overdue.map((p) => (
            <Link key={p.trackingNumber} href={`/forwarder/track/${p.trackingNumber}`} className="hot-row">
              <div style={{ minWidth: 0, display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 14, alignItems: "center" }}>
                <CopyTrack value={p.trackingNumber} />
                <span className="body-sm" style={{ color: "var(--error-text)" }}>{overdueReason(p)}</span>
              </div>
              <IconChevronRight width={18} height={18} style={{ color: "var(--error-text)" }} />
            </Link>
          ))}
        </section>
      )}

      <section style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 22 }}>
        <ImportXlsxButton />
        <Link href="/forwarder/shipment/new" className="btn btn-primary">
          <IconTruck width={18} height={18} /> Новая отгрузка
        </Link>
      </section>

      {drafts.length > 0 && (
        <section className="fade-up" style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
            <div className="caption-up">Открытые отгрузки · {drafts.length}</div>
            <Link href="/forwarder/shipment/new" className="caption" style={{ color: "var(--brand-coral)" }}>+ ещё одну</Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
            {drafts.map((d) => (
              <Link key={d.id} href={`/forwarder/shipment/${d.id}`} className="card" style={{ padding: 16, display: "block" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <span className="title-sm" style={{ color: "var(--on-dark-strong)" }}>{d.transport ?? "Транспорт не указан"}</span>
                  <span className="caption">{d.trackingNumbers.length} {d.trackingNumbers.length === 1 ? "трек" : "треков"}</span>
                </div>
                {d.plannedSentAt && (
                  <div className="body-xs" style={{ color: "var(--on-dark-soft)", display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                    <IconCalendar width={12} height={12} /> отправка {formatDate(d.plannedSentAt)}{d.plannedArrivalAt ? ` → приход ${formatDate(d.plannedArrivalAt)}` : ""}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <nav className="tabs" style={{ marginBottom: 18 }} role="tablist">
        {TABS.map((t) => (
          <Link key={t.key} href={`/forwarder?tab=${t.key}`} scroll={false} className={`tab ${t.key === active.key ? "active" : ""}`} role="tab">
            {t.label}<span className="count">{counts[t.key]}</span>
          </Link>
        ))}
      </nav>

      {inTab.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p className="body-md" style={{ margin: 0 }}>В этой вкладке пока пусто.</p>
        </div>
      ) : (
        <>
          <SelectAllToolbar ids={inTab.map((p) => p.trackingNumber)} label={`всего ${inTab.length}`} />
          <ParcelsList parcels={inTab} settings={settings} today={today} />
        </>
      )}
      <BulkActionBar role="forwarder" openDrafts={drafts.map((d) => ({ id: d.id, transport: d.transport, trackCount: d.trackingNumbers.length }))} />
    </SelectionProvider>
  );
}
