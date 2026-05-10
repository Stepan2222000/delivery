"""Status transition rules.

- Forwarder may only move forward through their own set of transitions.
- Admin may set anything (rollback included), but the API surfaces a flag so the UI
  can show a confirmation dialog for backwards moves.
"""
from __future__ import annotations

from .schemas import ParcelStatus

# Linear order of states for "forward / backward" comparison.
ORDER: dict[str, int] = {
    "ordered": 1,
    "arrived_usa": 2,
    "received_by_forwarder_usa": 3,
    "in_shipment_usa_to_kg": 4,
    "arrived_kg": 5,
    "in_shipment_kg_to_ru": 6,
    "delivered_ru": 7,
    # Off-axis terminal/exception states — handled separately.
    "not_received_ru": 7,
    "cancelled": 0,
}

# Manual transitions a forwarder may apply (UI + xlsx import).
# `arrived_usa` is set automatically by the eBay sync worker — forwarder
# can never set it (UI dropdown filters it out, API rejects it).
# `in_shipment_kg_to_ru` is set only as a side-effect of "send shipment" —
# also unavailable to manual bulk action.
# Forwarder may jump forward into received_usa / in_shipment_usa_to_kg / arrived_kg
# from any earlier non-terminal state.
FORWARDER_FORWARD: dict[ParcelStatus, set[ParcelStatus]] = {
    "ordered":                    {"received_by_forwarder_usa", "in_shipment_usa_to_kg", "arrived_kg"},
    "arrived_usa":                {"received_by_forwarder_usa", "in_shipment_usa_to_kg", "arrived_kg"},
    "received_by_forwarder_usa":  {"in_shipment_usa_to_kg", "arrived_kg"},
    "in_shipment_usa_to_kg":      {"arrived_kg"},
    "arrived_kg":                 set(),  # next move is via "send shipment"
    "in_shipment_kg_to_ru":       set(),  # final move is admin-side receive
    "delivered_ru":               set(),
    "not_received_ru":            set(),
    "cancelled":                  set(),
}


def is_forward(from_s: ParcelStatus, to_s: ParcelStatus) -> bool:
    if to_s == "cancelled":
        return True  # cancellation is always allowed (won't lose physical state)
    return ORDER[to_s] > ORDER[from_s]


def can_forwarder_transition(from_s: ParcelStatus, to_s: ParcelStatus) -> bool:
    return to_s in FORWARDER_FORWARD.get(from_s, set())


def admin_transition_warning(from_s: ParcelStatus, to_s: ParcelStatus) -> bool:
    """True if admin's transition is a backwards move (should require confirm)."""
    if from_s == to_s:
        return False
    return not is_forward(from_s, to_s)
