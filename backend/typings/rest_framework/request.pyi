from __future__ import annotations

from typing import Any, Mapping, MutableMapping


class Request:
    auth: Any
    user: Any
    data: Any
    query_params: Mapping[str, Any]
    META: MutableMapping[str, Any]
    method: str
    path: str
