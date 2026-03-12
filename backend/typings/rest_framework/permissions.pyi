from __future__ import annotations

from typing import Any

from .request import Request


class BasePermission:
    def has_permission(self, request: Request, view: Any) -> bool: ...

    def has_object_permission(self, request: Request, view: Any, obj: Any) -> bool: ...
