import { apiGet, apiSend, apiUpload } from "./client";
import type { Parcel, ParcelStatus, ProblemFlag } from "../types";

interface ApiParcel {
  tracking_number: string;
  status: ParcelStatus;
  problem: ProblemFlag | null;
  ordered_at: string;
  eta_usa: string | null;
  arrived_usa_at: string | null;
  received_usa_at: string | null;
  shipment_usa_to_kg_id: string | null;
  arrived_kg_at: string | null;
  weight_kg: string | number | null;
  shipment_kg_to_ru_id: string | null;
  delivered_ru_at: string | null;
  notes: string | null;
  photos: string[];
  admin_only: {
    source_order_number: string;
    sold_by: string | null;
    item_title: string | null;
    order_total_usd: string | number | null;
    shipping_cost_usd_snapshot: string | number | null;
    tariff_snapshot_usd_per_kg: string | number | null;
  } | null;
}

function fromApi(p: ApiParcel): Parcel {
  return {
    trackingNumber: p.tracking_number,
    status: p.status,
    problem: p.problem,
    orderedAt: p.ordered_at,
    etaUsa: p.eta_usa,
    arrivedUsaAt: p.arrived_usa_at,
    receivedUsaAt: p.received_usa_at,
    shipmentUsaToKgId: p.shipment_usa_to_kg_id,
    arrivedKgAt: p.arrived_kg_at,
    weightKg: p.weight_kg !== null ? Number(p.weight_kg) : null,
    shipmentKgToRuId: p.shipment_kg_to_ru_id,
    deliveredRuAt: p.delivered_ru_at,
    notes: p.notes,
    photos: p.photos ?? [],
    adminOnly: p.admin_only
      ? {
          sourceOrderNumber: p.admin_only.source_order_number,
          soldBy: p.admin_only.sold_by ?? "",
          itemTitle: p.admin_only.item_title ?? "",
          orderTotalUsd: p.admin_only.order_total_usd !== null ? Number(p.admin_only.order_total_usd) : 0,
          shippingCostUsdSnapshot:
            p.admin_only.shipping_cost_usd_snapshot !== null
              ? Number(p.admin_only.shipping_cost_usd_snapshot)
              : null,
          tariffSnapshotUsdPerKg:
            p.admin_only.tariff_snapshot_usd_per_kg !== null
              ? Number(p.admin_only.tariff_snapshot_usd_per_kg)
              : null,
        }
      : {
          sourceOrderNumber: "",
          soldBy: "",
          itemTitle: "",
          orderTotalUsd: 0,
          shippingCostUsdSnapshot: null,
          tariffSnapshotUsdPerKg: null,
        },
  };
}

export async function listParcels(opts?: { q?: string; status?: string; shipmentId?: string }): Promise<Parcel[]> {
  const qs = new URLSearchParams();
  if (opts?.q) qs.set("q", opts.q);
  if (opts?.status) qs.set("status", opts.status);
  if (opts?.shipmentId) qs.set("shipment_id", opts.shipmentId);
  const q = qs.toString();
  const data = await apiGet<ApiParcel[]>(`/parcels${q ? `?${q}` : ""}`);
  return data.map(fromApi);
}

export async function getParcel(tn: string): Promise<Parcel> {
  const data = await apiGet<ApiParcel>(`/parcels/${encodeURIComponent(tn)}`);
  return fromApi(data);
}

export async function patchParcel(
  tn: string,
  patch: { status?: string; weightKg?: number; notes?: string; problem?: ProblemFlag | null; force?: boolean },
): Promise<Parcel> {
  const body: Record<string, unknown> = {};
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.weightKg !== undefined) body.weight_kg = patch.weightKg;
  if (patch.notes !== undefined) body.notes = patch.notes;
  if (patch.problem !== undefined) body.problem = patch.problem;
  if (patch.force) body.force = true;
  const data = await apiSend<ApiParcel>(`/parcels/${encodeURIComponent(tn)}`, "PATCH", body);
  return fromApi(data);
}

export async function uploadParcelPhoto(tn: string, file: File): Promise<{ public_url: string }> {
  return apiUpload<{ public_url: string }>(`/parcels/${encodeURIComponent(tn)}/photos`, file);
}

