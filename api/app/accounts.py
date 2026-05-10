"""Hardcoded credentials for the two internal accounts.
Rotate by editing this file + redeploying.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Role = Literal["admin", "forwarder"]


@dataclass(frozen=True, slots=True)
class Account:
    login: str
    password: str
    role: Role
    user_id: str


ACCOUNTS: tuple[Account, ...] = (
    Account(login="stepan",  password="Password123", role="admin",     user_id="stepan"),
    Account(login="kg_team", password="KgTeam2026",  role="forwarder", user_id="kg_team"),
)
