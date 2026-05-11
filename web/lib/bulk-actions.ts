"use server";

import { revalidatePath } from "next/cache";
import { patchParcel } from "@/lib/api/parcels";
import {
  addParcelToShipment,
  removeParcelFromShipment,
  receiveShipment as receiveShipmentApi,
} from "@/lib/api/shipments";
import { ApiError } from "@/lib/api/client";

export interface BulkResult {
  applied: number;
  errors: { trackingNumber: string; reason: string }[];
}

export async function bulkChangeStatus(
  trackingNumbers: string[],
  status: string,
  force = false,
): Promise<BulkResult> {
  const result: BulkResult = { applied: 0, errors: [] };
  for (const tn of trackingNumbers) {
    try {
      await patchParcel(tn, { status, force });
      result.applied += 1;
    } catch (e) {
      const reason = e instanceof ApiError ? e.detail : String(e);
      result.errors.push({ trackingNumber: tn, reason });
    }
  }
  revalidatePath("/admin");
  revalidatePath("/forwarder");
  return result;
}

export async function bulkAddToShipment(
  trackingNumbers: string[],
  shipmentId: string,
): Promise<BulkResult> {
  const result: BulkResult = { applied: 0, errors: [] };
  for (const tn of trackingNumbers) {
    try {
      await addParcelToShipment(shipmentId, tn);
      result.applied += 1;
    } catch (e) {
      const reason = e instanceof ApiError ? e.detail : String(e);
      result.errors.push({ trackingNumber: tn, reason });
    }
  }
  revalidatePath("/forwarder");
  revalidatePath(`/forwarder/shipment/${shipmentId}`);
  return result;
}

export async function bulkRemoveFromShipment(
  trackingNumbers: string[],
  shipmentId: string,
): Promise<BulkResult> {
  const result: BulkResult = { applied: 0, errors: [] };
  for (const tn of trackingNumbers) {
    try {
      await removeParcelFromShipment(shipmentId, tn);
      result.applied += 1;
    } catch (e) {
      const reason = e instanceof ApiError ? e.detail : String(e);
      result.errors.push({ trackingNumber: tn, reason });
    }
  }
  revalidatePath("/forwarder");
  revalidatePath(`/forwarder/shipment/${shipmentId}`);
  return result;
}

export async function bulkReceiveShipment(
  shipmentId: string,
  trackingNumbers: string[],
  received: boolean,
): Promise<{ applied: number }> {
  await receiveShipmentApi(
    shipmentId,
    trackingNumbers.map((tn) => ({ trackingNumber: tn, received })),
  );
  revalidatePath("/admin");
  return { applied: trackingNumbers.length };
}
