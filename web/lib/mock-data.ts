import type { Parcel, Shipment, Settings, UntrackedOrder, User } from "./types";

// Today is 2026-05-09 (per project clock).
const today = (offset = 0) => {
  const d = new Date("2026-05-09T08:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString();
};

export const settings: Settings = {
  tariffUsdPerKg: 9.5,
  tariffEffectiveFrom: today(-30),
  thresholds: {
    usa: { days: 7, enabled: true },
    usaToKg: { days: 21, enabled: true },
    kgToRu: { days: 7, enabled: true },
  },
  cutoffDate: today(-14),
};

export const users: User[] = [
  { id: "u_admin", role: "admin", displayName: "Степан" },
  { id: "u_fwd", role: "forwarder", displayName: "Команда КГ" },
];

export const shipments: Shipment[] = [
  {
    id: "sh_001",
    direction: "usa_to_kg",
    status: "in_transit",
    trackingNumbers: ["1Z14V49EYW38817527", "TBA303512846847"],
    createdAt: today(-9), sentAt: today(-9), arrivedAt: null,
    waybillNo: "AWB-CDG-441", notes: "DHL air, transit ~10 дней",
    transport: "СДЭК",
    plannedSentAt: today(-9), plannedArrivalAt: today(1),
    waybillPhotoUrl: null,
  },
  {
    id: "sh_002",
    direction: "kg_to_ru",
    status: "in_transit",
    trackingNumbers: ["9400108106245118331553"],
    createdAt: today(-3), sentAt: today(-3), arrivedAt: null,
    waybillNo: "RU-PCB-7712", notes: null,
    transport: "фура",
    plannedSentAt: today(-3), plannedArrivalAt: today(4),
    waybillPhotoUrl: null,
  },
  {
    id: "sh_003",
    direction: "kg_to_ru",
    status: "received",
    trackingNumbers: ["9400108106245967587323", "9400108106245967576150"],
    createdAt: today(-20), sentAt: today(-20), arrivedAt: today(-12),
    waybillNo: "RU-PCB-7710", notes: null,
    transport: "фура",
    plannedSentAt: today(-20), plannedArrivalAt: today(-13),
    waybillPhotoUrl: null,
  },
  {
    id: "sh_004",
    direction: "kg_to_ru",
    status: "draft",
    trackingNumbers: [],
    createdAt: today(0), sentAt: null, arrivedAt: null,
    waybillNo: null, notes: "ждём ещё пару треков из США",
    transport: "фура",
    plannedSentAt: today(3), plannedArrivalAt: today(10),
    waybillPhotoUrl: null,
  },
];

export const untrackedOrders: UntrackedOrder[] = [
  { sourceOrderNumber: "27-14595-12001", itemTitle: "Brake pad set Toyota Camry 2018", orderedAt: today(-4), status: "Paid" },
  { sourceOrderNumber: "33-14571-88102", itemTitle: "Headlight assembly Lexus RX 2015", orderedAt: today(-2), status: "Tracking available" },
  { sourceOrderNumber: "11-14502-99201", itemTitle: "Air filter K&N", orderedAt: today(-1), status: "Paid" },
];

export const parcels: Parcel[] = [
  // 1. Just ordered, on the way to USA, ETA in future
  {
    trackingNumber: "9405511899223197123456",
    status: "ordered", problem: null,
    orderedAt: today(-3),
    etaUsa: today(4),
    arrivedUsaAt: null, receivedUsaAt: null,
    shipmentUsaToKgId: null,
    arrivedKgAt: null, weightKg: null,
    shipmentKgToRuId: null, deliveredRuAt: null,
    photos: [], notes: null,
    adminOnly: {
      sourceOrderNumber: "06-14597-95353",
      soldBy: "auto.parts.usa",
      itemTitle: "Brake disc rotor front pair Honda Civic",
      orderTotalUsd: 142.5,
      shippingCostUsdSnapshot: null, tariffSnapshotUsdPerKg: null,
    },
  },
  // 2. Just ordered, ETA tomorrow — fine
  {
    trackingNumber: "TBA303512846799",
    status: "ordered", problem: null,
    orderedAt: today(-5),
    etaUsa: today(1),
    arrivedUsaAt: null, receivedUsaAt: null,
    shipmentUsaToKgId: null,
    arrivedKgAt: null, weightKg: null,
    shipmentKgToRuId: null, deliveredRuAt: null,
    photos: [], notes: null,
    adminOnly: {
      sourceOrderNumber: "26-14566-99268", soldBy: "amazon.warehouse",
      itemTitle: "Oil filter Mann W712",
      orderTotalUsd: 18.2,
      shippingCostUsdSnapshot: null, tariffSnapshotUsdPerKg: null,
    },
  },
  // 3. OVERDUE — should have arrived 9 days ago, still no arrival
  {
    trackingNumber: "9400108106245999111222",
    status: "ordered", problem: "delayed",
    orderedAt: today(-22),
    etaUsa: today(-9),
    arrivedUsaAt: null, receivedUsaAt: null,
    shipmentUsaToKgId: null,
    arrivedKgAt: null, weightKg: null,
    shipmentKgToRuId: null, deliveredRuAt: null,
    photos: [], notes: "Forwarder писал поставщику, нет ответа",
    adminOnly: {
      sourceOrderNumber: "23-14562-38178", soldBy: "good.parts.shop",
      itemTitle: "Spark plug NGK BKR6E set of 4",
      orderTotalUsd: 24.0,
      shippingCostUsdSnapshot: null, tariffSnapshotUsdPerKg: null,
    },
  },
  // 4. OVERDUE 2
  {
    trackingNumber: "1ZA1B2C3D4E5F67890",
    status: "ordered", problem: "delayed",
    orderedAt: today(-18),
    etaUsa: today(-5),
    arrivedUsaAt: null, receivedUsaAt: null,
    shipmentUsaToKgId: null,
    arrivedKgAt: null, weightKg: null,
    shipmentKgToRuId: null, deliveredRuAt: null,
    photos: [], notes: null,
    adminOnly: {
      sourceOrderNumber: "02-14594-47833", soldBy: "ebay.seller.42",
      itemTitle: "Wheel bearing kit SKF",
      orderTotalUsd: 56.7,
      shippingCostUsdSnapshot: null, tariffSnapshotUsdPerKg: null,
    },
  },
  // 5-7. Arrived in USA, waiting for forwarder
  {
    trackingNumber: "9400108106245967587323",
    status: "arrived_usa", problem: null,
    orderedAt: today(-12),
    etaUsa: today(-5),
    arrivedUsaAt: today(-3),
    receivedUsaAt: null,
    shipmentUsaToKgId: null,
    arrivedKgAt: null, weightKg: null,
    shipmentKgToRuId: null, deliveredRuAt: null,
    photos: [], notes: null,
    adminOnly: {
      sourceOrderNumber: "12-14578-89467", soldBy: "us.parts.depot",
      itemTitle: "Cabin air filter premium",
      orderTotalUsd: 21.3,
      shippingCostUsdSnapshot: null, tariffSnapshotUsdPerKg: null,
    },
  },
  {
    trackingNumber: "9400108106245967576150",
    status: "arrived_usa", problem: null,
    orderedAt: today(-12),
    etaUsa: today(-4),
    arrivedUsaAt: today(-2),
    receivedUsaAt: null,
    shipmentUsaToKgId: null,
    arrivedKgAt: null, weightKg: null,
    shipmentKgToRuId: null, deliveredRuAt: null,
    photos: [], notes: null,
    adminOnly: {
      sourceOrderNumber: "22-14563-77240", soldBy: "us.parts.depot",
      itemTitle: "Brake pad set rear",
      orderTotalUsd: 38.0,
      shippingCostUsdSnapshot: null, tariffSnapshotUsdPerKg: null,
    },
  },
  {
    trackingNumber: "9405509898776655443322",
    status: "arrived_usa", problem: null,
    orderedAt: today(-15),
    etaUsa: today(-7),
    arrivedUsaAt: today(-1),
    receivedUsaAt: null,
    shipmentUsaToKgId: null,
    arrivedKgAt: null, weightKg: null,
    shipmentKgToRuId: null, deliveredRuAt: null,
    photos: [], notes: null,
    adminOnly: {
      sourceOrderNumber: "10-14581-67627", soldBy: "ny.parts.express",
      itemTitle: "Timing belt kit Gates",
      orderTotalUsd: 89.9,
      shippingCostUsdSnapshot: null, tariffSnapshotUsdPerKg: null,
    },
  },
  // 8. Forwarder confirmed received in USA
  {
    trackingNumber: "1Z9A8B7C6D5E4F3210",
    status: "received_by_forwarder_usa", problem: null,
    orderedAt: today(-14),
    etaUsa: today(-7),
    arrivedUsaAt: today(-5),
    receivedUsaAt: today(-2),
    shipmentUsaToKgId: null,
    arrivedKgAt: null, weightKg: null,
    shipmentKgToRuId: null, deliveredRuAt: null,
    photos: [], notes: null,
    adminOnly: {
      sourceOrderNumber: "06-14588-18168", soldBy: "auto.parts.usa",
      itemTitle: "Coolant hose upper",
      orderTotalUsd: 32.0,
      shippingCostUsdSnapshot: null, tariffSnapshotUsdPerKg: null,
    },
  },
  // 9-10. In shipment USA → KG (sh_001)
  {
    trackingNumber: "1Z14V49EYW38817527",
    status: "in_shipment_usa_to_kg", problem: null,
    orderedAt: today(-22),
    etaUsa: today(-15),
    arrivedUsaAt: today(-12),
    receivedUsaAt: today(-11),
    shipmentUsaToKgId: "sh_001",
    arrivedKgAt: null, weightKg: null,
    shipmentKgToRuId: null, deliveredRuAt: null,
    photos: [], notes: null,
    adminOnly: {
      sourceOrderNumber: "23-14562-38178", soldBy: "ebay.seller.42",
      itemTitle: "Strut assembly front Monroe",
      orderTotalUsd: 156.0,
      shippingCostUsdSnapshot: null, tariffSnapshotUsdPerKg: null,
    },
  },
  {
    trackingNumber: "TBA303512846847",
    status: "in_shipment_usa_to_kg", problem: null,
    orderedAt: today(-20),
    etaUsa: today(-13),
    arrivedUsaAt: today(-11),
    receivedUsaAt: today(-10),
    shipmentUsaToKgId: "sh_001",
    arrivedKgAt: null, weightKg: null,
    shipmentKgToRuId: null, deliveredRuAt: null,
    photos: [], notes: null,
    adminOnly: {
      sourceOrderNumber: "10-14581-67627", soldBy: "amazon.warehouse",
      itemTitle: "Wiper blade pair Bosch",
      orderTotalUsd: 27.5,
      shippingCostUsdSnapshot: null, tariffSnapshotUsdPerKg: null,
    },
  },
  // 11-12. Arrived KG, waiting for KG→RU shipment, with weight
  {
    trackingNumber: "1Z11AAAA22BBBB3344",
    status: "arrived_kg", problem: null,
    orderedAt: today(-30),
    etaUsa: today(-22),
    arrivedUsaAt: today(-19),
    receivedUsaAt: today(-18),
    shipmentUsaToKgId: "sh_003",
    arrivedKgAt: today(-6), weightKg: 1.85,
    shipmentKgToRuId: null, deliveredRuAt: null,
    photos: [
      "http://2.26.53.128:9000/delivery-photos/parcels/1Z11AAAA22BBBB3344/sample.jpg",
    ],
    notes: null,
    adminOnly: {
      sourceOrderNumber: "06-14597-95353", soldBy: "auto.parts.usa",
      itemTitle: "Headlight LED replacement",
      orderTotalUsd: 234.0,
      shippingCostUsdSnapshot: null, tariffSnapshotUsdPerKg: null,
    },
  },
  {
    trackingNumber: "9405519988776655443301",
    status: "arrived_kg", problem: null,
    orderedAt: today(-28),
    etaUsa: today(-21),
    arrivedUsaAt: today(-18),
    receivedUsaAt: null,
    shipmentUsaToKgId: "sh_003",
    arrivedKgAt: today(-5), weightKg: 0.42,
    shipmentKgToRuId: null, deliveredRuAt: null,
    photos: [], notes: null,
    adminOnly: {
      sourceOrderNumber: "11-14502-99201", soldBy: "ny.parts.express",
      itemTitle: "Engine mount rubber",
      orderTotalUsd: 48.0,
      shippingCostUsdSnapshot: null, tariffSnapshotUsdPerKg: null,
    },
  },
  // 13. In shipment KG → RU (sh_002)
  {
    trackingNumber: "9400108106245118331553",
    status: "in_shipment_kg_to_ru", problem: null,
    orderedAt: today(-35),
    etaUsa: today(-27),
    arrivedUsaAt: today(-23),
    receivedUsaAt: today(-22),
    shipmentUsaToKgId: "sh_003",
    arrivedKgAt: today(-7), weightKg: 2.34,
    shipmentKgToRuId: "sh_002", deliveredRuAt: null,
    photos: [], notes: null,
    adminOnly: {
      sourceOrderNumber: "12-14578-89467", soldBy: "us.parts.depot",
      itemTitle: "Suspension control arm",
      orderTotalUsd: 178.0,
      shippingCostUsdSnapshot: 22.23, tariffSnapshotUsdPerKg: 9.5,
    },
  },
  // 14. Delivered RU
  {
    trackingNumber: "1Z9888777666555444AA",
    status: "delivered_ru", problem: null,
    orderedAt: today(-50),
    etaUsa: today(-42),
    arrivedUsaAt: today(-38),
    receivedUsaAt: today(-36),
    shipmentUsaToKgId: "sh_003",
    arrivedKgAt: today(-25), weightKg: 1.10,
    shipmentKgToRuId: "sh_003", deliveredRuAt: today(-12),
    photos: [], notes: null,
    adminOnly: {
      sourceOrderNumber: "06-14597-95353", soldBy: "auto.parts.usa",
      itemTitle: "Brake fluid DOT4 1L",
      orderTotalUsd: 15.0,
      shippingCostUsdSnapshot: 10.45, tariffSnapshotUsdPerKg: 9.5,
    },
  },
  // 15. Cancelled
  {
    trackingNumber: "DD123456789CN",
    status: "cancelled", problem: null,
    orderedAt: today(-40),
    etaUsa: null,
    arrivedUsaAt: null, receivedUsaAt: null,
    shipmentUsaToKgId: null,
    arrivedKgAt: null, weightKg: null,
    shipmentKgToRuId: null, deliveredRuAt: null,
    photos: [], notes: "Отмена со стороны продавца",
    adminOnly: {
      sourceOrderNumber: "27-14501-00091", soldBy: "ny.parts.express",
      itemTitle: "Catalytic converter universal",
      orderTotalUsd: 198.0,
      shippingCostUsdSnapshot: null, tariffSnapshotUsdPerKg: null,
    },
  },
];

export function findParcel(tn: string): Parcel | undefined {
  return parcels.find((p) => p.trackingNumber === tn);
}

export function findShipment(id: string): Shipment | undefined {
  return shipments.find((s) => s.id === id);
}

export function mutateParcel(tn: string, fn: (p: Parcel) => Parcel): Parcel {
  const idx = parcels.findIndex((p) => p.trackingNumber === tn);
  if (idx < 0) throw new Error(`mutateParcel: tracking number not found: ${tn}`);
  parcels[idx] = fn(parcels[idx]);
  return parcels[idx];
}

export function mutateShipment(id: string, fn: (s: Shipment) => Shipment): Shipment {
  const idx = shipments.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error(`mutateShipment: shipment id not found: ${id}`);
  shipments[idx] = fn(shipments[idx]);
  return shipments[idx];
}

export function createShipment(input: Omit<Shipment, "id" | "createdAt">): Shipment {
  const id = `sh_${String(shipments.length + 1).padStart(3, "0")}`;
  const sh: Shipment = { ...input, id, createdAt: new Date("2026-05-09T08:00:00Z").toISOString() };
  shipments.push(sh);
  return sh;
}

export function setSettings(next: Settings): void {
  Object.assign(settings, next);
}

export function deleteShipment(id: string): void {
  const idx = shipments.findIndex((s) => s.id === id);
  if (idx < 0) throw new Error(`deleteShipment: shipment ${id} not found`);
  const sh = shipments[idx];
  if (sh.status !== "draft") throw new Error(`deleteShipment: only drafts can be deleted, ${id} is ${sh.status}`);
  shipments.splice(idx, 1);
}
