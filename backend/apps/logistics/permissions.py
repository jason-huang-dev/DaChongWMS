from __future__ import annotations

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.iam.constants import PermissionCode
from apps.iam.permissions import user_has_any_organization_permission, user_has_organization_permission


class CanViewLogistics(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_any_organization_permission(
            request.user,
            organization,
            (
                PermissionCode.VIEW_LOGISTICS,
                PermissionCode.MANAGE_LOGISTICS_PROVIDERS,
                PermissionCode.MANAGE_LOGISTICS_RULES,
                PermissionCode.MANAGE_LOGISTICS_CHARGING,
                PermissionCode.MANAGE_LOGISTICS_COSTS,
            ),
        )


class CanManageLogisticsProviders(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_organization_permission(request.user, organization, PermissionCode.MANAGE_LOGISTICS_PROVIDERS)


class CanManageLogisticsRules(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_organization_permission(request.user, organization, PermissionCode.MANAGE_LOGISTICS_RULES)


class CanManageLogisticsCharging(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_organization_permission(request.user, organization, PermissionCode.MANAGE_LOGISTICS_CHARGING)


class CanManageLogisticsCosts(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_organization_permission(request.user, organization, PermissionCode.MANAGE_LOGISTICS_COSTS)

