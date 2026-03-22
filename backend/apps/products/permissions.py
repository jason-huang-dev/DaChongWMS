from __future__ import annotations

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.iam.constants import PermissionCode
from apps.iam.permissions import user_has_any_organization_permission, user_has_organization_permission


class CanViewProductCatalog(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_organization_permission(
            request.user,
            organization,
            PermissionCode.VIEW_PRODUCT,
        )


class CanManageProducts(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_organization_permission(
            request.user,
            organization,
            PermissionCode.MANAGE_PRODUCTS,
        )


class CanManageDistributionProducts(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_any_organization_permission(
            request.user,
            organization,
            (
                PermissionCode.MANAGE_DISTRIBUTION_PRODUCTS,
                PermissionCode.MANAGE_PRODUCTS,
            ),
        )


class CanManageSerialManagement(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_any_organization_permission(
            request.user,
            organization,
            (
                PermissionCode.MANAGE_SERIAL_MANAGEMENT,
                PermissionCode.MANAGE_PRODUCTS,
            ),
        )


class CanManagePackaging(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_any_organization_permission(
            request.user,
            organization,
            (
                PermissionCode.MANAGE_PACKAGING,
                PermissionCode.MANAGE_PRODUCTS,
            ),
        )


class CanManageProductMarks(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_any_organization_permission(
            request.user,
            organization,
            (
                PermissionCode.MANAGE_PRODUCT_MARKS,
                PermissionCode.MANAGE_PRODUCTS,
            ),
        )
