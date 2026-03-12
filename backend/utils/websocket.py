"""Lightweight ASGI websocket handler copied from GreaterWMS."""

# cSpell:ignore ASGI

from __future__ import annotations

import datetime
import json
import urllib.parse
from functools import lru_cache
from typing import Any, Dict, Iterable, Protocol, Tuple, cast

from asgiref.typing import (
    ASGIReceiveCallable,
    ASGIReceiveEvent,
    ASGISendCallable,
    Scope,
    WebSocketAcceptEvent,
    WebSocketSendEvent,
)
from django.apps import apps
from rest_framework.exceptions import APIException


class _StaffQuerySet(Protocol):
    def filter(self, **kwargs: Any) -> "_StaffQuerySet": ...

    def exists(self) -> bool: ...


class _StaffModel(Protocol):
    objects: _StaffQuerySet


SendCallable = ASGISendCallable
CONNECTIONS: Dict[str, SendCallable] = {}


async def websocket_application(scope: Scope, receive: ASGIReceiveCallable, send: ASGISendCallable) -> None:
    while True:
        event: ASGIReceiveEvent = await receive()
        if event["type"] == "websocket.connect":
            accept_event: WebSocketAcceptEvent = {
                "type": "websocket.accept",
                "subprotocol": None,
                "headers": cast(Iterable[Tuple[bytes, bytes]], ()),
            }
            await send(accept_event)
            sender = _sender_key(scope)
            CONNECTIONS[sender] = send
        elif event["type"] == "websocket.receive":
            payload = _parse_query(scope)
            openid = payload.get("openid")
            sender = payload.get("sender")
            receiver = payload.get("receiver")
            if not all([openid, sender, receiver]):
                raise APIException({"detail": "Missing websocket params"})
            assert openid is not None
            assert sender is not None
            assert receiver is not None
            staff_model = _get_staff_model()
            if staff_model is not None and not staff_model.objects.filter(openid=openid, staff_name=receiver).exists():
                raise APIException({"detail": "Cannot send to non-owned staff"})
            text: Dict[str, str] = {
                "sender": sender,
                "receiver": receiver,
                "detail": str(event.get("text")),
                "create_time": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "update_time": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }
            receiver_key = f"{receiver}-{openid}"
            if receiver_key in CONNECTIONS:
                send_event: WebSocketSendEvent = {
                    "type": "websocket.send",
                    "text": json.dumps(text, ensure_ascii=False),
                    "bytes": None,
                }
                await CONNECTIONS[receiver_key](send_event)
        elif event["type"] == "websocket.disconnect":
            key = _sender_key(scope)
            CONNECTIONS.pop(key, None)
            break


def _parse_query(scope: Scope) -> Dict[str, str]:
    query_string_obj = scope.get("query_string", b"")
    if isinstance(query_string_obj, (bytes, bytearray)):
        query_string = bytes(query_string_obj).decode()
    else:
        query_string = str(query_string_obj)
    parsed = urllib.parse.parse_qs(query_string)
    return {key: values[0] for key, values in parsed.items() if values}


def _sender_key(scope: Scope) -> str:
    data = _parse_query(scope)
    return f"{data.get('sender', '')}-{data.get('openid', '')}"


@lru_cache(maxsize=1)
def _get_staff_model() -> _StaffModel | None:
    try:  # pragma: no cover - defensive, depends on optional app
        model = apps.get_model("staff.ListModel")
    except (LookupError, ValueError):
        return None
    return cast(_StaffModel, model)
