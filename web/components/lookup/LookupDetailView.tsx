import Link from "next/link";
import { getLookup } from "@/lib/api/lookup";
import type { Role } from "@/lib/types";
import { LookupChat, LookupPhotoUpload } from "./LookupClient";

function fmt(t: string | null): string {
  if (!t) return "—";
  return new Date(t).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

export async function LookupDetailView({
  id, role, backHref,
}: { id: string; role: Role; backHref: string }) {
  const { request, photos, messages, linkedOrder } = await getLookup(id);
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div>
        <Link href={backHref} className="body-sm" style={{ color: "var(--on-dark-faint)" }}>← К списку заявок</Link>
        <h1 style={{
          fontFamily: "var(--font-serif)", fontSize: 36, marginTop: 8, marginBottom: 8,
          color: "var(--on-dark-strong)", letterSpacing: "-0.4px", fontWeight: 400,
        }}>
          {request.trackingNumber ?? "(без трека)"}
        </h1>
        <div className="body-sm" style={{ color: "var(--on-dark-soft)" }}>
          <span>Статус: <b style={{ color: "var(--on-dark)" }}>{request.status}</b></span>
          {" · "}
          <span>Создал: {request.createdBy}</span>
          {" · "}
          <span>{fmt(request.createdAt)}</span>
        </div>
        {request.note ? (
          <div className="body-sm" style={{ marginTop: 8, color: "var(--on-dark)", maxWidth: 700 }}>
            <span style={{ color: "var(--on-dark-faint)" }}>Комментарий: </span>{request.note}
          </div>
        ) : null}
        {linkedOrder ? (
          <div className="card" style={{ marginTop: 12, padding: 12 }}>
            <div className="caption-up" style={{ color: "var(--on-dark-faint)" }}>Привязан к заказу</div>
            <div className="body-sm" style={{ marginTop: 4 }}>
              #{linkedOrder.order_id} · {linkedOrder.order_number} · {linkedOrder.sold_by}
            </div>
            {linkedOrder.items ? (
              <div className="body-sm" style={{ marginTop: 4, color: "var(--on-dark-soft)" }}>{linkedOrder.items}</div>
            ) : null}
          </div>
        ) : null}
      </div>

      <section>
        <div className="caption-up" style={{ color: "var(--on-dark-faint)", marginBottom: 8 }}>Фото</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          {photos.map((p) => (
            <a key={p.id} href={p.publicUrl} target="_blank" rel="noreferrer">
              <img src={p.publicUrl} alt="" style={{
                width: 120, height: 120, objectFit: "cover", borderRadius: 6,
                border: "1px solid var(--product-stroke)",
              }} />
            </a>
          ))}
          {photos.length === 0 ? (
            <div className="body-sm" style={{ color: "var(--on-dark-faint)" }}>Пока ни одного фото.</div>
          ) : null}
        </div>
        <LookupPhotoUpload id={id} />
      </section>

      <section>
        <div className="caption-up" style={{ color: "var(--on-dark-faint)", marginBottom: 8 }}>AI-диалог</div>
        <LookupChat
          id={id}
          role={role}
          initialMessages={messages}
          requestStatus={request.status}
        />
      </section>
    </div>
  );
}
