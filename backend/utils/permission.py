"""Default permissive DRF permission class placeholder."""

from __future__ import annotations

from typing import Any

from rest_framework.permissions import BasePermission
from rest_framework.request import Request


class Normalpermission(BasePermission):
    def has_permission(self, request: Request, view: Any) -> bool:  # pragma: no cover - DRF hook
        return True

    def has_object_permission(self, request: Request, view: Any, obj: Any) -> bool:  # pragma: no cover
        return True
