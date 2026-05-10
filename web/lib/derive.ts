import type { Parcel, Settings, ParcelStatus } from "./types";

const MS_PER_DAY = 86_400_000;

export function parseDateInput(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  return new Date(t + "T08:00:00Z").toISOString();
}

export const isoToInput = (iso: string | null): string => (iso ? iso.slice(0, 10) : "");

const daysBetween = (a: string, b: string): number =>
  Math.floor((new Date(b).getTime() - new Date(a).getTime()) / MS_PER_DAY);

export interface ParcelTimings {
  inUsaTransit: number | null;
  dwellUsa: number | null;
  usaToKg: number | null;
  dwellKg: number | null;
  kgToRu: number | null;
  total: number | null;
}

export function computeTimings(p: Parcel, today: string): ParcelTimings {
  const usaArrived = p.arrivedUsaAt;
  const usaShipped = p.receivedUsaAt;
  const kgArrived = p.arrivedKgAt;
  const ruShipped = p.shipmentKgToRuId ? kgArrived : null;
  const ruDelivered = p.deliveredRuAt;
  return {
    inUsaTransit: usaArrived ? daysBetween(p.orderedAt, usaArrived) : null,
    dwellUsa: usaArrived && usaShipped ? daysBetween(usaArrived, usaShipped) : null,
    usaToKg: usaShipped && kgArrived ? daysBetween(usaShipped, kgArrived) : null,
    dwellKg: kgArrived && ruShipped ? daysBetween(kgArrived, ruShipped) : null,
    kgToRu: ruShipped && ruDelivered ? daysBetween(ruShipped, ruDelivered) : null,
    total: ruDelivered ? daysBetween(p.orderedAt, ruDelivered) : daysBetween(p.orderedAt, today),
  };
}

export function overdueReason(p: Parcel): string {
  if (p.problem === "lost") return "возможно потеряна";
  if (p.problem === "damaged") return "повреждена";
  if (p.status === "ordered") return "долго не доезжает в США";
  if (p.status === "in_shipment_usa_to_kg") return "долго едет в Кыргызстан";
  if (p.status === "in_shipment_kg_to_ru") return "долго едет в Россию";
  return "долго в пути";
}

export function isOverdue(p: Parcel, settings: Settings, today: string): boolean {
  const t = settings.thresholds;
  if (p.status === "ordered" && t.usa.enabled && p.etaUsa) {
    if (daysBetween(p.etaUsa, today) >= t.usa.days) return true;
  }
  if (p.status === "in_shipment_usa_to_kg" && t.usaToKg.enabled && p.receivedUsaAt) {
    if (daysBetween(p.receivedUsaAt, today) >= t.usaToKg.days) return true;
  }
  if (p.status === "in_shipment_kg_to_ru" && t.kgToRu.enabled && p.arrivedKgAt) {
    if (daysBetween(p.arrivedKgAt, today) >= t.kgToRu.days) return true;
  }
  if (p.problem === "delayed" || p.problem === "lost") return true;
  return false;
}

export const STATUS_LABELS: Record<ParcelStatus, string> = {
  ordered: "В пути в США",
  arrived_usa: "В США",
  received_by_forwarder_usa: "Получено в США",
  in_shipment_usa_to_kg: "В пути в КГ",
  arrived_kg: "В КГ",
  in_shipment_kg_to_ru: "В пути в РФ",
  delivered_ru: "Доставлено",
  not_received_ru: "Не получено в РФ",
  cancelled: "Отменено",
};

export const STATUS_PILL_CLASS: Record<ParcelStatus, string> = {
  ordered: "s-ordered",
  arrived_usa: "s-usa",
  received_by_forwarder_usa: "s-usa",
  in_shipment_usa_to_kg: "s-tokg",
  arrived_kg: "s-kg",
  in_shipment_kg_to_ru: "s-toru",
  delivered_ru: "s-done",
  not_received_ru: "s-late",
  cancelled: "s-ordered",
};

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const months = ["янв", "фев", "мар", "апр", "мая", "июня", "июля", "авг", "сен", "окт", "ноя", "дек"];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

export function formatDateFull(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

export function formatRelative(iso: string, today: string): string {
  const days = daysBetween(iso, today);
  if (days === 0) return "сегодня";
  if (days === 1) return "вчера";
  if (days > 0) return `${days} дн назад`;
  return `через ${Math.abs(days)} дн`;
}
