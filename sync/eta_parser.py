"""Parse eBay arriving_by_date strings into a timestamp.

Known formats (verified against live data):
- "Fri, May 22"                   → year inferred (closest future ≥ ordered_at)
- "May 12, 2026"
- "May 1, 2026 - May 12, 2026"    → take the LATER bound
- "Mon, May 4"
"""
from __future__ import annotations

import re
from datetime import date, datetime, timezone

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}
WEEKDAYS = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}


def _parse_one(s: str, anchor: date) -> date | None:
    s = s.strip()
    # "May 12, 2026"
    m = re.match(r"^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$", s)
    if m:
        mo = MONTHS.get(m.group(1)[:3].lower())
        if not mo:
            return None
        return date(int(m.group(3)), mo, int(m.group(2)))
    # "Fri, May 22" / "May 22"
    m = re.match(r"^(?:([A-Za-z]+),\s+)?([A-Za-z]+)\s+(\d{1,2})$", s)
    if m:
        wd = m.group(1)
        mo = MONTHS.get(m.group(2)[:3].lower())
        if not mo:
            return None
        day = int(m.group(3))
        # Choose closest future year ≥ anchor.
        year = anchor.year
        try:
            d = date(year, mo, day)
        except ValueError:
            return None
        if d < anchor:
            try:
                d = date(year + 1, mo, day)
            except ValueError:
                return None
        if wd is not None and wd[:3].lower() not in WEEKDAYS:
            return None
        return d
    return None


def parse_eta(raw: str | None, ordered_at: datetime | None) -> datetime | None:
    if not raw:
        return None
    anchor = (ordered_at.date() if ordered_at else date.today())
    parts = [p for p in raw.split("-")]
    parsed = [_parse_one(p, anchor) for p in parts]
    parsed = [p for p in parsed if p is not None]
    if not parsed:
        return None
    chosen = max(parsed)  # take LATER bound from a range
    return datetime.combine(chosen, datetime.min.time(), tzinfo=timezone.utc)
