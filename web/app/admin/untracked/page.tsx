import { listUntracked } from "@/lib/api/untracked";
import { formatDate } from "@/lib/derive";

export default async function UntrackedPage() {
  const untrackedOrders = await listUntracked();
  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <p className="caption-up" style={{ color: "var(--on-dark-faint)", marginBottom: 8 }}>Из ebay_orders</p>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 44, color: "var(--on-dark-strong)", letterSpacing: "-0.8px", fontWeight: 400, margin: 0 }}>
          Без трек-номера.
        </h1>
        <p className="body-sm" style={{ color: "var(--on-dark-soft)", marginTop: 8, maxWidth: 640 }}>
          Заказы из источника, у которых ещё не появился трек. В пайплайне доставки не участвуют — перевозчики их не видят.
          Как только трек появится в источнике, заказ автоматически уйдёт в основной список.
        </p>
      </header>

      <section className="card" style={{ padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th className="caption" style={{ textAlign: "left", padding: "16px 20px", borderBottom: "1px solid var(--product-stroke)", color: "var(--on-dark-faint)", fontWeight: 500 }}>Заказ</th>
              <th className="caption" style={{ textAlign: "left", padding: "16px 20px", borderBottom: "1px solid var(--product-stroke)", color: "var(--on-dark-faint)", fontWeight: 500 }}>Содержимое</th>
              <th className="caption" style={{ textAlign: "left", padding: "16px 20px", borderBottom: "1px solid var(--product-stroke)", color: "var(--on-dark-faint)", fontWeight: 500 }}>Заказан</th>
              <th className="caption" style={{ textAlign: "left", padding: "16px 20px", borderBottom: "1px solid var(--product-stroke)", color: "var(--on-dark-faint)", fontWeight: 500 }}>Статус источника</th>
            </tr>
          </thead>
          <tbody>
            {untrackedOrders.map((o) => (
              <tr key={o.sourceOrderNumber}>
                <td className="mono body-sm" style={{ padding: "14px 20px", borderBottom: "1px solid var(--product-stroke)", color: "var(--on-dark-strong)" }}>{o.sourceOrderNumber}</td>
                <td className="body-sm" style={{ padding: "14px 20px", borderBottom: "1px solid var(--product-stroke)", color: "var(--on-dark)" }}>{o.itemTitle}</td>
                <td className="body-sm" style={{ padding: "14px 20px", borderBottom: "1px solid var(--product-stroke)", color: "var(--on-dark-soft)" }}>{formatDate(o.orderedAt)}</td>
                <td className="body-sm" style={{ padding: "14px 20px", borderBottom: "1px solid var(--product-stroke)", color: "var(--on-dark-soft)" }}>{o.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
