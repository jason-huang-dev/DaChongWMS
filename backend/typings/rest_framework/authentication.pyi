from __future__ import annotations

from typing import Any, Tuple

from .request import Request


class BaseAuthentication:
    def authenticate(self, request: Request) -> Tuple[Any, Any] | None: ...

    def authenticate_header(self, request: Request) -> str | None: ...
