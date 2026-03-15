"""Permissions for MFA enrollment endpoints."""

from __future__ import annotations

from typing import Any

from rest_framework.permissions import BasePermission
from rest_framework.request import Request

from utils.operator import get_request_operator


class CanManageOwnMFA(BasePermission):
    message = "An authenticated operator is required to manage MFA enrollment"

    def has_permission(self, request: Request, view: Any) -> bool:
        get_request_operator(request)
        return True
