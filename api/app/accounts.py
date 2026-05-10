"""Hardcoded user accounts.

Two logical accounts (admin/manager + forwarder) for an internal tool. Pwds
were already plaintext in env+docker-compose; consolidating them here removes
3 places of duplication. Rotate by editing this file + redeploying.

ID + display_name must match the rows in `users` table (sql/001_init.sql).
"""
from __future__ import annotations

from typing import Literal

Role = Literal["admin", "forwarder"]


class Account:
    __slots__ = ("login", "password", "role", "user_id", "display_name")

    def __init__(self, *, login: str, password: str, role: Role, user_id: str, display_name: str):
        self.login = login
        self.password = password
        self.role = role
        self.user_id = user_id
        self.display_name = display_name


ACCOUNTS: tuple[Account, ...] = (
    Account(login="stepan",  password="Password123", role="admin",     user_id="stepan",  display_name="Степан"),
    Account(login="kg_team", password="KgTeam2026",  role="forwarder", user_id="kg_team", display_name="Форвардер"),
)
