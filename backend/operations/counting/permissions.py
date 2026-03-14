"""Permissions for cycle counting and variance approvals."""

from __future__ import annotations

from typing import Any, ClassVar, Iterable

from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework.request import Request

from utils.operator import get_request_operator


class CanManageCountingRecords(BasePermission):
    write_roles: ClassVar[set[str]] = {"Manager", "Supervisor", "Inbound", "Outbound", "StockControl"}
    approval_roles: ClassVar[set[str]] = {"Manager", "Supervisor", "StockControl"}

    def has_permission(self, request: Request, view: Any) -> bool:
        if request.method in SAFE_METHODS:
            return True
        operator = get_request_operator(request)
        action = getattr(view, "action", "")
        allowed_roles = self.approval_roles if action in {"approve", "reject"} else self.write_roles
        if operator.staff_type not in allowed_roles:
            self.message = self._message(operator.staff_type, allowed_roles)
            return False
        return True

    def has_object_permission(self, request: Request, view: Any, obj: Any) -> bool:
        if request.method in SAFE_METHODS:
            return True
        openid = getattr(request.auth, "openid", None)
        return getattr(obj, "openid", openid) == openid

    @staticmethod
    def _message(actual_role: str, allowed_roles: Iterable[str]) -> str:
        allowed = ", ".join(sorted(allowed_roles))
        return f"Role `{actual_role}` cannot perform this action. Allowed roles: {allowed}"


class CanManageCountingApprovals(BasePermission):
    allowed_roles: ClassVar[set[str]] = {"Manager", "Supervisor", "StockControl"}

    def has_permission(self, request: Request, view: Any) -> bool:
        operator = get_request_operator(request)
        if operator.staff_type not in self.allowed_roles:
            self.message = self._message(operator.staff_type, self.allowed_roles)
            return False
        return True

    def has_object_permission(self, request: Request, view: Any, obj: Any) -> bool:
        openid = getattr(request.auth, "openid", None)
        return getattr(obj, "openid", openid) == openid

    @staticmethod
    def _message(actual_role: str, allowed_roles: Iterable[str]) -> str:
        allowed = ", ".join(sorted(allowed_roles))
        return f"Role `{actual_role}` cannot perform this action. Allowed roles: {allowed}"
