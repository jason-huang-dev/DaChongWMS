from __future__ import annotations

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.iam.constants import PermissionCode
from apps.iam.permissions import user_has_any_organization_permission


class CanViewReturns(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_any_organization_permission(
            request.user,
            organization,
            (
                PermissionCode.VIEW_RETURNS,
                PermissionCode.MANAGE_RETURN_ORDERS,
                PermissionCode.MANAGE_RETURN_EXECUTION,
            ),
        )


class CanManageReturnOrders(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_any_organization_permission(
            request.user,
            organization,
            (PermissionCode.MANAGE_RETURN_ORDERS,),
        )


class CanManageReturnExecution(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_any_organization_permission(
            request.user,
            organization,
            (
                PermissionCode.MANAGE_RETURN_EXECUTION,
                PermissionCode.MANAGE_RETURN_ORDERS,
            ),
        )

