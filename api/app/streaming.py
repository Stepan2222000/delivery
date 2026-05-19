"""Vercel AI SDK UIMessageStream (v1) — SSE wire format helpers.
Spec: https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
"""
from __future__ import annotations

import json
import uuid
from typing import Any, AsyncIterator


SSE_HEADERS = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "x-vercel-ai-ui-message-stream": "v1",
}


def _event(obj: dict[str, Any]) -> bytes:
    return ("data: " + json.dumps(obj, ensure_ascii=False) + "\n\n").encode("utf-8")


def _done() -> bytes:
    return b"data: [DONE]\n\n"


def message_id() -> str:
    return "msg_" + uuid.uuid4().hex


async def text_message_stream(
    text: str, *, mid: str, data_parts: list[dict[str, Any]] | None = None
) -> AsyncIterator[bytes]:
    """Emit a complete assistant message as a single SSE stream.
    Optional data_parts are sent as `data-*` events before the text starts.
    """
    yield _event({"type": "start"})
    yield _event({"type": "start-step"})
    if data_parts:
        for p in data_parts:
            yield _event(p)
    yield _event({"type": "text-start", "id": mid})
    # Send text in one shot — chat replies are short structured-output
    # echoes, no need to chunk artificially.
    yield _event({"type": "text-delta", "id": mid, "delta": text})
    yield _event({"type": "text-end", "id": mid})
    yield _event({"type": "finish-step"})
    yield _event({"type": "finish"})
    yield _done()
