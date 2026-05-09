import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getShipment, receiveShipment as receiveShipmentApi } from "@/lib/api/shipments";
import { getParcel } from "@/lib/api/parcels";
import { ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/derive";
import { IconArrowLeft, IconCheck } from "@/components/shared/Icons";
import { CopyTrack } from "@/components/shared/CopyTrack";

async function receiveShipmentAction(formData: FormData) {
  "use server";
  const id = String(formData.get("shipment_id"));
  const sh = await getShipment(id);
  if (sh.direction !== "kg_to_ru") throw new Error(`shipment ${id} is not KG→RU`);
  const items = sh.trackingNumbers.map((tn) => {
    const decision = String(formData.get(`decision_${tn}`) ?? "");
    if (decision !== "received" && decision !== "not_received") {
      throw new Error(`receive: missing decision for ${tn}`);
    }
    return { trackingNumber: tn, received: decision === "received" };
  });
  await receiveShipmentApi(id, items);
  revalidatePath("/admin");
  redirect("/admin");
}

export default async function ReceiveShipment({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let sh;
  try {
    sh = await getShipment(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  if (sh.direction !== "kg_to_ru") notFound();

  const items = (await Promise.all(sh.trackingNumbers.map((tn) =>
    getParcel(tn).catch(() => null)
  ))).filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <div>
      <Link href="/admin" className="btn btn-ghost btn-sm" style={{ marginLeft: -8, marginBottom: 12 }}>
        <IconArrowLeft width={18} height={18} /> Назад
      </Link>

      <header style={{ marginBottom: 24 }}>
        <p className="caption-up" style={{ color: "var(--on-dark-faint)", marginBottom: 8 }}>Кыргызстан → Россия · {sh.waybillNo ?? "без накладной"}</p>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 36, color: "var(--on-dark-strong)", letterSpacing: "-0.6px", fontWeight: 400, margin: 0 }}>
          Приём отгрузки.
        </h1>
        <p className="body-sm" style={{ color: "var(--on-dark-soft)", marginTop: 8 }}>
          Отправлено {formatDate(sh.sentAt)} · {items.length} треков. Отметьте по каждому: получено или нет.
        </p>
      </header>

      <form action={receiveShipmentAction}>
        <input type="hidden" name="shipment_id" value={sh.id} />

        <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
          {items.map((p) => (
            <div key={p.trackingNumber} className="card fade-up" style={{ padding: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ marginBottom: 4 }}><CopyTrack value={p.trackingNumber} size="lg" /></div>
                  <div className="body-sm" style={{ color: "var(--on-dark-soft)" }}>{p.adminOnly.itemTitle}</div>
                </div>
                <div className="body-sm mono" style={{ color: "var(--on-dark-strong)", textAlign: "right" }}>
                  {p.weightKg ?? 0} кг<br />
                  <span className="caption" style={{ color: "var(--on-dark-soft)" }}>${p.adminOnly.shippingCostUsdSnapshot?.toFixed(2) ?? "—"}</span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <label style={{ position: "relative" }}>
                  <input type="radio" name={`decision_${p.trackingNumber}`} value="received" required style={{ position: "absolute", opacity: 0, pointerEvents: "none" }} />
                  <span className="btn btn-secondary btn-block" data-decision="received" style={{ height: 48 }}>
                    <IconCheck width={16} height={16} /> Получено
                  </span>
                </label>
                <label style={{ position: "relative" }}>
                  <input type="radio" name={`decision_${p.trackingNumber}`} value="not_received" style={{ position: "absolute", opacity: 0, pointerEvents: "none" }} />
                  <span className="btn btn-secondary btn-block" data-decision="not_received" style={{ height: 48 }}>
                    Не получено
                  </span>
                </label>
              </div>
            </div>
          ))}
        </div>

        <button className="btn btn-primary btn-lg btn-block" type="submit" style={{ maxWidth: 480 }}>
          Завершить приём
        </button>
      </form>

      <style>{`
        label:has(input[value="received"]:checked) [data-decision="received"] {
          background: rgba(93,184,114,0.16); border-color: var(--success); color: #82d693;
        }
        label:has(input[value="not_received"]:checked) [data-decision="not_received"] {
          background: rgba(198,69,69,0.16); border-color: var(--error); color: var(--error-text);
        }
      `}</style>
    </div>
  );
}
