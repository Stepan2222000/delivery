import type { ParcelTimings } from "@/lib/derive";

export function TrackTimings({ timings }: { timings: ParcelTimings }) {
  return (
    <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "1fr auto", rowGap: 8, columnGap: 12 }}>
      <Row label="В пути в США" value={timings.inUsaTransit !== null ? `${timings.inUsaTransit} дн` : "—"} />
      <Row label="На складе США" value={timings.dwellUsa !== null ? `${timings.dwellUsa} дн` : "—"} />
      <Row label="США → КГ" value={timings.usaToKg !== null ? `${timings.usaToKg} дн` : "—"} />
      <Row label="На складе КГ" value={timings.dwellKg !== null ? `${timings.dwellKg} дн` : "—"} />
      <Row label="КГ → РФ" value={timings.kgToRu !== null ? `${timings.kgToRu} дн` : "—"} />
      <Row label="Всего" value={`${timings.total ?? 0} дн`} strong />
    </dl>
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
