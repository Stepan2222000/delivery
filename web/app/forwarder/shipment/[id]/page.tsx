import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getShipment,
  patchShipment,
  addParcelToShipment,
  removeParcelFromShipment,
  sendShipment,
  deleteDraftShipment,
  uploadShipmentWaybill,
} from "@/lib/api/shipments";
import { listParcels } from "@/lib/api/parcels";
import { ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/derive";
import {
  IconArrowLeft, IconTrash, IconSend, IconCalendar, IconTruck, IconCamera,
} from "@/components/shared/Icons";
import { TransportSelect } from "@/components/shared/TransportSelect";
import { CopyTrack } from "@/components/shared/CopyTrack";
import { AvailableParcelsList } from "@/components/forwarder/AvailableParcelsList";

function parseDate(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  return new Date(t + "T08:00:00Z").toISOString();
}

async function saveDraft(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  await patchShipment(id, {
    transport: String(formData.get("transport") ?? "").trim() || null,
    plannedSentAt: parseDate(String(formData.get("planned_sent_at") ?? "")),
    plannedArrivalAt: parseDate(String(formData.get("planned_arrival_at") ?? "")),
    waybillNo: String(formData.get("waybill") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });
  const photoFile = formData.get("waybill_photo");
  if (photoFile instanceof File && photoFile.size > 0) {
    await uploadShipmentWaybill(id, photoFile);
  }
  revalidatePath(`/forwarder/shipment/${id}`);
}

async function addParcel(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const tn = String(formData.get("tn"));
  await addParcelToShipment(id, tn);
  revalidatePath(`/forwarder/shipment/${id}`);
  revalidatePath("/forwarder");
}

async function removeParcel(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const tn = String(formData.get("tn"));
  await removeParcelFromShipment(id, tn);
  revalidatePath(`/forwarder/shipment/${id}`);
  revalidatePath("/forwarder");
}

async function sendDraft(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  await sendShipment(id);
  revalidatePath("/forwarder");
  revalidatePath("/admin");
  redirect("/forwarder?tab=to_ru");
}

async function dropDraft(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  await deleteDraftShipment(id);
  revalidatePath("/forwarder");
  redirect("/forwarder");
}

const isoToInput = (iso: string | null): string => (iso ? iso.slice(0, 10) : "");

export default async function ShipmentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let sh;
  try {
    sh = await getShipment(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const [allInDraft, allAvailable] = await Promise.all([
    listParcels({ shipmentId: sh.id }),
    listParcels({ status: "arrived_kg" }),
  ]);
  const inDraft = allInDraft;
  const available = allAvailable.filter((p) => !p.shipmentKgToRuId);
  const isDraft = sh.status === "draft";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <Link href="/forwarder" className="btn btn-ghost btn-sm" style={{ marginLeft: -8, marginBottom: 12 }}>
        <IconArrowLeft width={18} height={18} /> Назад
      </Link>

      <header style={{ marginBottom: 18 }}>
        <p className="caption-up" style={{ marginBottom: 8 }}>
          Кыргызстан → Россия · {sh.id} · {isDraft ? "черновик" : sh.status === "in_transit" ? "в пути" : "доставлено"}
        </p>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 32, letterSpacing: "-0.5px", fontWeight: 400, margin: 0 }}>
          Отгрузка.
        </h1>
      </header>

      {isDraft ? (
        <form action={saveDraft} className="card fade-up" style={{ padding: 22, marginBottom: 16 }}>
          <input type="hidden" name="id" value={sh.id} />
          <label className="field">
            <span className="field-label">Транспорт</span>
            <TransportSelect name="transport" defaultValue={sh.transport ?? "Фура"} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className="field">
              <span className="field-label">Планируемая отправка (опционально)</span>
              <input className="input" name="planned_sent_at" type="date" defaultValue={isoToInput(sh.plannedSentAt)} />
            </label>
            <label className="field">
              <span className="field-label">Планируемое прибытие (опционально)</span>
              <input className="input" name="planned_arrival_at" type="date" defaultValue={isoToInput(sh.plannedArrivalAt)} />
            </label>
          </div>
          <label className="field">
            <span className="field-label">Накладная № (опционально)</span>
            <input className="input" name="waybill" defaultValue={sh.waybillNo ?? ""} placeholder="например, RU-PCB-7713" />
          </label>
          <label className="field">
            <span className="field-label">Фото накладной {sh.waybillPhotoUrl ? "(заменить)" : "(опционально)"}</span>
            <input className="input" name="waybill_photo" type="file" accept="image/*,application/pdf" style={{ paddingTop: 10 }} />
            {sh.waybillPhotoUrl && (
              <a href={sh.waybillPhotoUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8 }}>
                <img src={sh.waybillPhotoUrl} alt="накладная" style={{ maxHeight: 120, borderRadius: 8, border: "1px solid var(--product-stroke)" }} />
              </a>
            )}
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Заметка</span>
            <input className="input" name="notes" defaultValue={sh.notes ?? ""} />
          </label>
          <button className="btn btn-secondary" type="submit" style={{ marginTop: 12 }}>Сохранить</button>
        </form>
      ) : (
        <section className="card" style={{ padding: 22, marginBottom: 16 }}>
          <Row icon={<IconTruck width={14} height={14} />} label="Транспорт" value={sh.transport ?? "—"} />
          <Row icon={<IconCalendar width={14} height={14} />} label="Отправлено" value={sh.sentAt ? formatDate(sh.sentAt) : "—"} />
          {sh.plannedArrivalAt && <Row icon={<IconCalendar width={14} height={14} />} label="Ожидаемое прибытие" value={formatDate(sh.plannedArrivalAt)} />}
          {sh.waybillNo && <Row icon={null} label="Накладная №" value={sh.waybillNo} />}
          {sh.waybillPhotoUrl && (
            <div style={{ paddingTop: 10, borderTop: "1px solid var(--product-stroke)", marginTop: 10 }}>
              <div className="caption muted" style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <IconCamera width={14} height={14} /> Фото накладной
              </div>
              <a href={sh.waybillPhotoUrl} target="_blank" rel="noreferrer">
                <img src={sh.waybillPhotoUrl} alt="накладная" style={{ maxHeight: 200, borderRadius: 8, border: "1px solid var(--product-stroke)" }} />
              </a>
            </div>
          )}
          {sh.notes && <Row icon={null} label="Заметка" value={sh.notes} />}
        </section>
      )}

      <section className="card fade-up" style={{ padding: 22, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h2 className="title-md" style={{ color: "var(--on-dark-strong)", margin: 0 }}>В этой отгрузке</h2>
          <span className="caption">{inDraft.length} {inDraft.length === 1 ? "трек" : "треков"}</span>
        </div>
        {inDraft.length === 0 ? (
          <p className="body-sm muted" style={{ margin: 0 }}>Пока пусто. Добавьте треки из списка ниже или со страницы трека.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {inDraft.map((p) => (
              <li key={p.trackingNumber} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--product-stroke)" }}>
                <CopyTrack value={p.trackingNumber} />
                <span className="body-sm muted">{p.weightKg ?? "?"} кг</span>
                {isDraft && (
                  <form action={removeParcel}>
                    <input type="hidden" name="id" value={sh.id} />
                    <input type="hidden" name="tn" value={p.trackingNumber} />
                    <button className="btn btn-ghost btn-sm" type="submit" aria-label="Убрать"><IconTrash width={16} height={16} /></button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isDraft && available.length > 0 && (
        <section className="card fade-up" style={{ padding: 22, marginBottom: 16 }}>
          <h2 className="title-md" style={{ color: "var(--on-dark-strong)", margin: "0 0 12px" }}>Готовы к отправке в КГ</h2>
          <AvailableParcelsList parcels={available} shipmentId={sh.id} addAction={addParcel} />
        </section>
      )}

      {isDraft && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
          <form action={sendDraft}>
            <input type="hidden" name="id" value={sh.id} />
            <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={inDraft.length === 0}>
              <IconSend width={18} height={18} /> Отправить отгрузку
            </button>
          </form>
          <form action={dropDraft}>
            <input type="hidden" name="id" value={sh.id} />
            <button className="btn btn-secondary btn-lg" type="submit" aria-label="Удалить черновик"><IconTrash width={18} height={18} /></button>
          </form>
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--product-stroke)" }}>
      <span style={{ color: "var(--on-dark-faint)", display: "inline-flex" }}>{icon}</span>
      <span className="body-sm muted">{label}</span>
      <span className="body-sm" style={{ color: "var(--on-dark-strong)" }}>{value}</span>
    </div>
  );
}
