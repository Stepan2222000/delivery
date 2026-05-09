import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getParcel, patchParcel } from "@/lib/api/parcels";
import { listShipments, addParcelToShipment, removeParcelFromShipment } from "@/lib/api/shipments";
import { ApiError } from "@/lib/api/client";
import { formatDate, formatDateFull, computeTimings } from "@/lib/derive";
import { StatusPill } from "@/components/shared/StatusPill";
import { IconArrowLeft, IconCamera, IconCheck, IconScale, IconTruck, IconPlus, IconChevronRight, IconCalendar } from "@/components/shared/Icons";
import { CopyTrack } from "@/components/shared/CopyTrack";

async function markReceivedUsa(formData: FormData) {
  "use server";
  const tn = String(formData.get("tn"));
  await patchParcel(tn, { status: "received_by_forwarder_usa" });
  revalidatePath(`/forwarder/track/${tn}`);
  revalidatePath("/forwarder");
}

async function markArrivedKg(formData: FormData) {
  "use server";
  const tn = String(formData.get("tn"));
  const weightStr = String(formData.get("weight") ?? "").trim();
  const patch: { status: string; weightKg?: number } = { status: "arrived_kg" };
  if (weightStr !== "") {
    const w = Number(weightStr);
    if (Number.isNaN(w) || w <= 0) throw new Error(`markArrivedKg: invalid weight "${weightStr}"`);
    patch.weightKg = w;
  }
  await patchParcel(tn, patch);
  revalidatePath(`/forwarder/track/${tn}`);
  revalidatePath("/forwarder");
}

async function updateWeight(formData: FormData) {
  "use server";
  const tn = String(formData.get("tn"));
  const weight = Number(String(formData.get("weight")));
  if (Number.isNaN(weight) || weight <= 0) throw new Error(`updateWeight: invalid weight`);
  await patchParcel(tn, { weightKg: weight });
  revalidatePath(`/forwarder/track/${tn}`);
}

async function addToShipment(formData: FormData) {
  "use server";
  const tn = String(formData.get("tn"));
  const id = String(formData.get("shipment_id"));
  await addParcelToShipment(id, tn);
  revalidatePath(`/forwarder/track/${tn}`);
  revalidatePath(`/forwarder/shipment/${id}`);
  revalidatePath("/forwarder");
}

async function removeFromShipment(formData: FormData) {
  "use server";
  const tn = String(formData.get("tn"));
  const id = String(formData.get("shipment_id"));
  await removeParcelFromShipment(id, tn);
  revalidatePath(`/forwarder/track/${tn}`);
  revalidatePath(`/forwarder/shipment/${id}`);
  revalidatePath("/forwarder");
}

export default async function TrackDetail({ params }: { params: Promise<{ tn: string }> }) {
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
  const allShipments = await listShipments();
  const inDraftShipmentId = parcel.status === "arrived_kg" ? parcel.shipmentKgToRuId : null;
  const inDraftShipment = inDraftShipmentId ? allShipments.find((s) => s.id === inDraftShipmentId) : null;
  const openDrafts = allShipments.filter((s) => s.status === "draft" && s.direction === "kg_to_ru");

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
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <Link href="/forwarder" className="btn btn-ghost btn-sm" style={{ marginLeft: -8, marginBottom: 8 }}>
        <IconArrowLeft width={18} height={18} /> Все треки
      </Link>

      <header style={{ marginBottom: 18 }}>
        <div style={{ marginBottom: 10 }}><StatusPill status={parcel.status} /></div>
        <div style={{ marginBottom: 10 }}><CopyTrack value={parcel.trackingNumber} size="xl" /></div>
        <p className="body-sm muted" style={{ margin: 0 }}>
          Заказан {formatDate(parcel.orderedAt)} · в системе {timings.total ?? 0} дн
        </p>
      </header>

      {parcel.status === "arrived_usa" && (
        <form action={markReceivedUsa} style={{ marginBottom: 14 }}>
          <input type="hidden" name="tn" value={parcel.trackingNumber} />
          <button className="btn btn-primary btn-lg btn-block" type="submit">
            <IconCheck width={18} height={18} /> Подтвердить получение в США
          </button>
        </form>
      )}

      {parcel.status === "in_shipment_usa_to_kg" && (
        <form action={markArrivedKg} className="card fade-up" style={{ marginBottom: 14, padding: 18 }}>
          <input type="hidden" name="tn" value={parcel.trackingNumber} />
          <div className="title-md" style={{ marginBottom: 12 }}>Прибыл в Кыргызстан</div>
          <label className="field">
            <span className="field-label">Вес посылки, кг (опционально)</span>
            <input className="input" name="weight" type="number" step="0.001" min="0.001" placeholder="например, 1.234" inputMode="decimal" />
          </label>
          <button className="btn btn-primary btn-lg btn-block" type="submit" style={{ marginTop: 8 }}>
            <IconCheck width={18} height={18} /> Отметить как прибывший
          </button>
          <p className="body-xs muted" style={{ marginTop: 10, marginBottom: 0 }}>
            Вес можно добавить позже. Без веса не получится отправить в РФ.
          </p>
        </form>
      )}

      {parcel.status === "arrived_kg" && (
        <>
          <form action={updateWeight} className="card fade-up" style={{ marginBottom: 14, padding: 18 }}>
            <input type="hidden" name="tn" value={parcel.trackingNumber} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
              <label className="field" style={{ marginBottom: 0 }}>
                <span className="field-label">
                  <IconScale width={14} height={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Вес посылки, кг
                </span>
                <input className="input" name="weight" type="number" step="0.001" min="0.001" defaultValue={parcel.weightKg ?? ""} placeholder="0.000" inputMode="decimal" required />
              </label>
              <button className="btn btn-secondary" type="submit">Сохранить</button>
            </div>
          </form>

          {inDraftShipment ? (
            <section className="card fade-up" style={{ marginBottom: 14, padding: 18 }}>
              <div className="caption-up" style={{ marginBottom: 10 }}>В отгрузке</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center", marginBottom: 10 }}>
                <Link href={`/forwarder/shipment/${inDraftShipment.id}`} className="title-md" style={{ color: "var(--on-dark-strong)" }}>
                  {inDraftShipment.transport ?? "Транспорт не указан"} · {inDraftShipment.id}
                </Link>
                <IconChevronRight width={18} height={18} style={{ color: "var(--on-dark-faint)" }} />
              </div>
              {inDraftShipment.plannedSentAt && <div className="body-xs muted" style={{ display: "flex", gap: 6, alignItems: "center" }}><IconCalendar width={12} height={12} /> отправка {formatDate(inDraftShipment.plannedSentAt)}</div>}
              <form action={removeFromShipment} style={{ marginTop: 12 }}>
                <input type="hidden" name="tn" value={parcel.trackingNumber} />
                <input type="hidden" name="shipment_id" value={inDraftShipment.id} />
                <button className="btn btn-secondary btn-sm" type="submit">Убрать из отгрузки</button>
              </form>
            </section>
          ) : (
            <section className="card fade-up" style={{ marginBottom: 14, padding: 18 }}>
              <div className="title-md" style={{ marginBottom: 4 }}>Добавить в отгрузку</div>
              <p className="body-sm muted" style={{ margin: "0 0 14px" }}>Выберите открытую отгрузку или создайте новую.</p>
              {openDrafts.length === 0 ? (
                <Link href="/forwarder/shipment/new" className="btn btn-primary btn-block btn-lg">
                  <IconTruck width={18} height={18} /> Создать первую отгрузку
                </Link>
              ) : (
                <>
                  <div style={{ display: "grid", gap: 8 }}>
                    {openDrafts.map((d) => (
                      <form key={d.id} action={addToShipment}>
                        <input type="hidden" name="tn" value={parcel.trackingNumber} />
                        <input type="hidden" name="shipment_id" value={d.id} />
                        <button type="submit" className="card" style={{ width: "100%", padding: 14, display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 12, cursor: "pointer", border: "1px solid var(--product-stroke)", textAlign: "left" }}>
                          <div style={{ minWidth: 0 }}>
                            <div className="title-sm" style={{ color: "var(--on-dark-strong)", marginBottom: 4 }}>
                              {d.transport ?? "Транспорт не указан"}
                            </div>
                            <div className="body-xs muted">
                              {d.trackingNumbers.length} {d.trackingNumbers.length === 1 ? "трек" : "треков"}
                              {d.plannedSentAt ? ` · отправка ${formatDate(d.plannedSentAt)}` : ""}
                            </div>
                          </div>
                          <span className="btn btn-primary btn-sm" style={{ pointerEvents: "none" }}><IconPlus width={14} height={14} /> Добавить</span>
                        </button>
                      </form>
                    ))}
                  </div>
                  <Link href="/forwarder/shipment/new" className="btn btn-secondary btn-block" style={{ marginTop: 10 }}>
                    + Создать новую отгрузку
                  </Link>
                </>
              )}
            </section>
          )}
        </>
      )}

      <section className="card fade-up" style={{ marginBottom: 14, padding: 0 }}>
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

      <section className="card fade-up" style={{ marginBottom: 14, padding: 18 }}>
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

      <section className="card fade-up" style={{ padding: 18 }}>
        <div className="caption-up" style={{ marginBottom: 10 }}>Фото</div>
        {parcel.photos.length === 0 ? (
          <button className="btn btn-secondary btn-block" type="button" disabled>
            <IconCamera width={18} height={18} /> Добавить фото (скоро)
          </button>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            {parcel.photos.map((url) => (<div key={url} style={{ aspectRatio: "1/1", background: "var(--slate-700)", borderRadius: 6 }} />))}
          </div>
        )}
      </section>

      {parcel.notes && (
        <section className="card fade-up" style={{ marginTop: 14, padding: 18 }}>
          <div className="caption-up" style={{ marginBottom: 6 }}>Заметка</div>
          <p className="body-sm" style={{ margin: 0 }}>{parcel.notes}</p>
        </section>
      )}

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
