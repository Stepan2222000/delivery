import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createShipment, uploadShipmentWaybill } from "@/lib/api/shipments";
import { IconArrowLeft } from "@/components/shared/Icons";
import { TransportSelect } from "@/components/shared/TransportSelect";

function parseDateInput(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  return new Date(t + "T08:00:00Z").toISOString();
}

async function createDraftShipment(formData: FormData) {
  "use server";
  const sh = await createShipment({
    direction: "kg_to_ru",
    transport: String(formData.get("transport") ?? "").trim() || null,
    plannedSentAt: parseDateInput(String(formData.get("planned_sent_at") ?? "")),
    plannedArrivalAt: parseDateInput(String(formData.get("planned_arrival_at") ?? "")),
    waybillNo: String(formData.get("waybill") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });
  const photoFile = formData.get("waybill_photo");
  if (photoFile instanceof File && photoFile.size > 0) {
    await uploadShipmentWaybill(sh.id, photoFile);
  }
  revalidatePath("/forwarder");
  redirect(`/forwarder/shipment/${sh.id}`);
}

export default function NewShipment() {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <Link href="/forwarder" className="btn btn-ghost btn-sm" style={{ marginLeft: -8, marginBottom: 12 }}>
        <IconArrowLeft width={18} height={18} /> Назад
      </Link>

      <header style={{ marginBottom: 24 }}>
        <p className="caption-up" style={{ marginBottom: 8 }}>Кыргызстан → Россия</p>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 32, letterSpacing: "-0.5px", fontWeight: 400, margin: 0 }}>
          Новая отгрузка.
        </h1>
        <p className="body-sm muted" style={{ marginTop: 8 }}>
          Сначала заведите карточку отгрузки. Треки добавите позже из списка «В КГ» или со страницы трека.
        </p>
      </header>

      <form action={createDraftShipment} className="card fade-up" style={{ padding: 24 }}>
        <label className="field">
          <span className="field-label">Транспорт</span>
          <TransportSelect name="transport" defaultValue="Фура" />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label className="field">
            <span className="field-label">Планируемая отправка (опционально)</span>
            <input className="input" name="planned_sent_at" type="date" />
          </label>
          <label className="field">
            <span className="field-label">Планируемое прибытие (опционально)</span>
            <input className="input" name="planned_arrival_at" type="date" />
          </label>
        </div>

        <label className="field">
          <span className="field-label">Накладная № (опционально)</span>
          <input className="input" name="waybill" type="text" placeholder="например, RU-PCB-7713" />
        </label>

        <label className="field">
          <span className="field-label">Фото накладной (опционально)</span>
          <input className="input" name="waybill_photo" type="file" accept="image/*,application/pdf" style={{ paddingTop: 10 }} />
        </label>

        <label className="field">
          <span className="field-label">Заметка</span>
          <input className="input" name="notes" type="text" placeholder="комментарий" />
        </label>

        <button className="btn btn-primary btn-lg btn-block" type="submit" style={{ marginTop: 8 }}>
          Создать отгрузку
        </button>
        <p className="body-xs muted" style={{ marginTop: 10, marginBottom: 0, textAlign: "center" }}>
          После создания — добавите треки и отправите, когда машина выезжает.
        </p>
      </form>
    </div>
  );
}
