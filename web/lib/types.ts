export type Role = "admin" | "forwarder";

export type ParcelStatus =
  | "ordered"
  | "arrived_usa"
  | "received_by_forwarder_usa"
  | "in_shipment_usa_to_kg"
  | "arrived_kg"
  | "in_shipment_kg_to_ru"
  | "delivered_ru"
  | "not_received_ru"
  | "cancelled";

export type ProblemFlag = "lost" | "damaged" | "delayed" | null;

export type ShipmentDirection = "usa_to_kg" | "kg_to_ru";

export type ShipmentStatus = "draft" | "in_transit" | "received";

export interface Parcel {
  trackingNumber: string;
  status: ParcelStatus;
  problem: ProblemFlag;
  orderedAt: string;
  etaUsa: string | null;
  arrivedUsaAt: string | null;
  receivedUsaAt: string | null;
  shipmentUsaToKgId: string | null;
  arrivedKgAt: string | null;
  weightKg: number | null;
  shipmentKgToRuId: string | null;
  deliveredRuAt: string | null;
  photos: string[];
  notes: string | null;
  // Admin-only fields — must NOT be sent to forwarder DTO
  adminOnly: {
    sourceOrderNumber: string;
    soldBy: string;
    itemTitle: string;
    orderTotalUsd: number;
    shippingCostUsdSnapshot: number | null;
    tariffSnapshotUsdPerKg: number | null;
  };
}

export interface Shipment {
  id: string;
  direction: ShipmentDirection;
  status: ShipmentStatus;
  trackingNumbers: string[];
  createdAt: string;
  sentAt: string | null;
  arrivedAt: string | null;
  waybillNo: string | null;
  notes: string | null;
  transport: string | null;
  plannedSentAt: string | null;
  plannedArrivalAt: string | null;
  waybillPhotoUrl: string | null;
}

export interface Settings {
  tariffUsdPerKg: number;
  tariffEffectiveFrom: string;
  thresholds: {
    usa: { days: number; enabled: boolean };
    usaToKg: { days: number; enabled: boolean };
    kgToRu: { days: number; enabled: boolean };
  };
  cutoffDate: string;
}

export interface UntrackedOrder {
  sourceOrderNumber: string;
  itemTitle: string;
  orderedAt: string;
  status: string;
}

export interface User {
  id: string;
  role: Role;
  displayName: string;
}
