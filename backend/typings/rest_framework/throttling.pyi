from __future__ import annotations

from typing import Any

from .request import Request


class BaseThrottle:
    def allow_request(self, request: Request, view: Any) -> bool: ...

    def wait(self) -> float | None: ...
