"""Pydantic models for API request/response."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

ParcelStatus = Literal[
    "ordered",
    "arrived_usa",
    "received_by_forwarder_usa",
    "in_shipment_usa_to_kg",
    "arrived_kg",
    "in_shipment_kg_to_ru",
    "delivered_ru",
    "not_received_ru",
    "cancelled",
]

ProblemFlag = Literal["lost", "damaged", "delayed"]
ShipmentDirection = Literal["usa_to_kg", "kg_to_ru"]
ShipmentStatus = Literal["draft", "in_transit", "received"]


class AdminOnlyFields(BaseModel):
    source_order_number: str
    sold_by: str | None
    item_title: str | None
    order_total_usd: Decimal | None
    shipping_cost_usd_snapshot: Decimal | None
    tariff_snapshot_usd_per_kg: Decimal | None


class ParcelOut(BaseModel):
    """Forwarder DTO. Admin response includes `admin_only` extra block."""
    tracking_number: str
    status: ParcelStatus
    problem: ProblemFlag | None
    ordered_at: datetime
    eta_usa: datetime | None
    arrived_usa_at: datetime | None
    received_usa_at: datetime | None
    shipment_usa_to_kg_id: str | None
    arrived_kg_at: datetime | None
    weight_kg: Decimal | None
    shipment_kg_to_ru_id: str | None
    delivered_ru_at: datetime | None
    notes: str | None
    photos: list[str] = Field(default_factory=list)
    is_manual: bool = False
    admin_only: AdminOnlyFields | None = None


class ParcelPatch(BaseModel):
    status: ParcelStatus | None = None
    weight_kg: Decimal | None = None
    notes: str | None = None
    problem: ProblemFlag | None = None
    # Admin "режим разработчика": накатить status напрямую без авто-простановки
    # дат и без проверок forwarder-перехода. Привязки к shipment снимаются.
    force: bool = False


class ShipmentOut(BaseModel):
    id: str
    direction: ShipmentDirection
    status: ShipmentStatus
    transport: str | None
    waybill_no: str | None
    notes: str | None
    waybill_photo_url: str | None
    planned_sent_at: datetime | None
    planned_arrival_at: datetime | None
    sent_at: datetime | None
    arrived_at: datetime | None
    created_at: datetime
    tracking_numbers: list[str] = Field(default_factory=list)


class ShipmentCreate(BaseModel):
    direction: ShipmentDirection = "kg_to_ru"
    transport: str | None = None
    waybill_no: str | None = None
    notes: str | None = None
    planned_sent_at: datetime | None = None
    planned_arrival_at: datetime | None = None


class ShipmentPatch(BaseModel):
    transport: str | None = None
    waybill_no: str | None = None
    notes: str | None = None
    planned_sent_at: datetime | None = None
    planned_arrival_at: datetime | None = None


class ShipmentAddRemoveTrack(BaseModel):
    tracking_number: str


class ShipmentReceiveItem(BaseModel):
    tracking_number: str
    received: bool


class ShipmentReceiveBody(BaseModel):
    items: list[ShipmentReceiveItem]


class SettingsOut(BaseModel):
    tariff_usd_per_kg: Decimal
    tariff_effective_from: datetime
    threshold_usa_days: int
    threshold_usa_enabled: bool
    threshold_to_kg_days: int
    threshold_to_kg_enabled: bool
    threshold_to_ru_days: int
    threshold_to_ru_enabled: bool
    cutoff_date: date


class SettingsPatch(BaseModel):
    tariff_usd_per_kg: Decimal | None = None
    threshold_usa_days: int | None = None
    threshold_usa_enabled: bool | None = None
    threshold_to_kg_days: int | None = None
    threshold_to_kg_enabled: bool | None = None
    threshold_to_ru_days: int | None = None
    threshold_to_ru_enabled: bool | None = None
    cutoff_date: date | None = None


class UntrackedOut(BaseModel):
    source_order_number: str
    item_title: str | None
    ordered_at: datetime | None
    delivery_status: str | None
