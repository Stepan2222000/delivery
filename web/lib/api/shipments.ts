import { apiGet, apiSend, apiUpload } from "./client";
import type { Shipment, ShipmentDirection, ShipmentStatus } from "../types";

interface ApiShipment {
  id: string;
  direction: ShipmentDirection;
  status: ShipmentStatus;
  transport: string | null;
  waybill_no: string | null;
  notes: string | null;
  waybill_photo_url: string | null;
  planned_sent_at: string | null;
  planned_arrival_at: string | null;
  sent_at: string | null;
  arrived_at: string | null;
  created_at: string;
  tracking_numbers: string[];
}

function fromApi(s: ApiShipment): Shipment {
  return {
    id: s.id,
    direction: s.direction,
    status: s.status,
    transport: s.transport,
    waybillNo: s.waybill_no,
    notes: s.notes,
    waybillPhotoUrl: s.waybill_photo_url,
    plannedSentAt: s.planned_sent_at,
    plannedArrivalAt: s.planned_arrival_at,
    sentAt: s.sent_at,
    arrivedAt: s.arrived_at,
    createdAt: s.created_at,
    trackingNumbers: s.tracking_numbers ?? [],
  };
}

export async function listShipments(): Promise<Shipment[]> {
  const data = await apiGet<ApiShipment[]>(`/shipments`);
  return data.map(fromApi);
}

export async function getShipment(id: string): Promise<Shipment> {
  const data = await apiGet<ApiShipment>(`/shipments/${encodeURIComponent(id)}`);
  return fromApi(data);
}

export async function createShipment(input: {
  direction?: ShipmentDirection;
  transport?: string | null;
  waybillNo?: string | null;
  notes?: string | null;
  plannedSentAt?: string | null;
  plannedArrivalAt?: string | null;
}): Promise<Shipment> {
  const body: Record<string, unknown> = {
    direction: input.direction ?? "kg_to_ru",
  };
  if (input.transport !== undefined) body.transport = input.transport;
  if (input.waybillNo !== undefined) body.waybill_no = input.waybillNo;
  if (input.notes !== undefined) body.notes = input.notes;
  if (input.plannedSentAt !== undefined) body.planned_sent_at = input.plannedSentAt;
  if (input.plannedArrivalAt !== undefined) body.planned_arrival_at = input.plannedArrivalAt;
  const data = await apiSend<ApiShipment>(`/shipments`, "POST", body);
  return fromApi(data);
}

export async function patchShipment(
  id: string,
  patch: {
    transport?: string | null;
    waybillNo?: string | null;
    notes?: string | null;
    plannedSentAt?: string | null;
    plannedArrivalAt?: string | null;
  },
): Promise<Shipment> {
  const body: Record<string, unknown> = {};
  if (patch.transport !== undefined) body.transport = patch.transport;
  if (patch.waybillNo !== undefined) body.waybill_no = patch.waybillNo;
  if (patch.notes !== undefined) body.notes = patch.notes;
  if (patch.plannedSentAt !== undefined) body.planned_sent_at = patch.plannedSentAt;
  if (patch.plannedArrivalAt !== undefined) body.planned_arrival_at = patch.plannedArrivalAt;
  const data = await apiSend<ApiShipment>(`/shipments/${encodeURIComponent(id)}`, "PATCH", body);
  return fromApi(data);
}

export async function addParcelToShipment(id: string, tn: string): Promise<Shipment> {
  const data = await apiSend<ApiShipment>(
    `/shipments/${encodeURIComponent(id)}/parcels`,
    "POST",
    { tracking_number: tn },
  );
  return fromApi(data);
}

export async function removeParcelFromShipment(id: string, tn: string): Promise<Shipment> {
  const data = await apiSend<ApiShipment>(
    `/shipments/${encodeURIComponent(id)}/parcels/${encodeURIComponent(tn)}`,
    "DELETE",
  );
  return fromApi(data);
}

export async function deleteDraftShipment(id: string): Promise<void> {
  await apiSend<void>(`/shipments/${encodeURIComponent(id)}`, "DELETE");
}

export async function sendShipment(id: string): Promise<Shipment> {
  const data = await apiSend<ApiShipment>(`/shipments/${encodeURIComponent(id)}/send`, "POST");
  return fromApi(data);
}

export async function receiveShipment(
  id: string,
  items: { trackingNumber: string; received: boolean }[],
): Promise<Shipment> {
  const data = await apiSend<ApiShipment>(
    `/shipments/${encodeURIComponent(id)}/receive`,
    "POST",
    { items: items.map((i) => ({ tracking_number: i.trackingNumber, received: i.received })) },
  );
  return fromApi(data);
}

export async function uploadShipmentWaybill(id: string, file: File): Promise<{ public_url: string }> {
  return apiUpload<{ public_url: string }>(`/shipments/${encodeURIComponent(id)}/waybill`, file);
}
