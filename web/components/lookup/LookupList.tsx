import Link from "next/link";
import { listLookups } from "@/lib/api/lookup";
import type { LookupStatus } from "@/lib/types";
import { NewLookupForm } from "./LookupClient";

const STATUS_LABEL: Record<LookupStatus, string> = {
  draft: "Черновик",
  searching: "В диалоге с AI",
  pending_admin: "Ждёт админа",
  linked: "Привязано",
  rejected: "Отклонено",
};

const STATUS_COLOR: Record<LookupStatus, string> = {
  draft: "var(--on-dark-faint)",
  searching: "var(--on-dark)",
  pending_admin: "var(--accent-coral)",
  linked: "var(--on-dark-soft)",
  rejected: "var(--on-dark-faint)",
};

function fmt(t: string): string {
  const d = new Date(t);
  return d.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

export async function LookupList({ basePath }: { basePath: string }) {
  const items = await listLookups();
  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <p className="caption-up" style={{ color: "var(--on-dark-faint)", marginBottom: 8 }}>
          Manual lookup
        </p>
        <h1 style={{
          fontFamily: "var(--font-serif)", fontSize: 44, color: "var(--on-dark-strong)",
          letterSpacing: "-0.8px", fontWeight: 400, margin: 0,
        }}>
          Незнакомые треки.
        </h1>
        <p className="body-sm" style={{ color: "var(--on-dark-soft)", marginTop: 8, maxWidth: 700 }}>
          Заявки на сопоставление посылок, чьи треки не пришли из eBay (или пришли с
          ошибкой). AI помогает подобрать заказ. После подтверждения админом трек
          дописывается к eBay-заказу как extra-track, и посылка появляется в обычном списке.
        </p>
      </header>

      <section style={{ display: "grid", gap: 24 }}>
        <NewLookupForm />

        {items.length === 0 ? (
          <div className="body-sm" style={{ color: "var(--on-dark-faint)" }}>
            Активных заявок нет.
          </div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Трек", "Статус", "Создал", "Обновлено", "Фото", "Сообщ."].map((h) => (
                    <th key={h} className="caption" style={{
                      textAlign: "left", padding: "16px 20px",
                      borderBottom: "1px solid var(--product-stroke)",
                      color: "var(--on-dark-faint)", fontWeight: 500,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td className="mono body-sm" style={{ padding: "14px 20px", borderBottom: "1px solid var(--product-stroke)" }}>
                      <Link href={`${basePath}/${r.id}`} style={{ color: "var(--on-dark-strong)" }}>
                        {r.trackingNumber ?? "(без трека)"}
                      </Link>
                    </td>
                    <td className="body-sm" style={{ padding: "14px 20px", borderBottom: "1px solid var(--product-stroke)", color: STATUS_COLOR[r.status] }}>
                      {STATUS_LABEL[r.status]}
                    </td>
                    <td className="body-sm" style={{ padding: "14px 20px", borderBottom: "1px solid var(--product-stroke)", color: "var(--on-dark-soft)" }}>
                      {r.createdBy}
                    </td>
                    <td className="body-sm" style={{ padding: "14px 20px", borderBottom: "1px solid var(--product-stroke)", color: "var(--on-dark-soft)" }}>
                      {fmt(r.updatedAt)}
                    </td>
                    <td className="body-sm" style={{ padding: "14px 20px", borderBottom: "1px solid var(--product-stroke)", color: "var(--on-dark-soft)" }}>
                      {r.photoCount}
                    </td>
                    <td className="body-sm" style={{ padding: "14px 20px", borderBottom: "1px solid var(--product-stroke)", color: "var(--on-dark-soft)" }}>
                      {r.messageCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
