from __future__ import annotations

from typing import Any

from .request import Request

SAFE_METHODS: tuple[str, ...]


class BasePermission:
    def has_permission(self, request: Request, view: Any) -> bool: ...

    def has_object_permission(self, request: Request, view: Any, obj: Any) -> bool: ...


class AllowAny(BasePermission):
    pass


class IsAuthenticated(BasePermission):
    pass


class IsAdminUser(BasePermission):
    pass


class IsAuthenticatedOrReadOnly(BasePermission):
    pass
