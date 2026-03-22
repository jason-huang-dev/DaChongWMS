from __future__ import annotations

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.iam.constants import PermissionCode
from apps.iam.permissions import user_has_any_organization_permission, user_has_organization_permission


class CanViewFees(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_any_organization_permission(
            request.user,
            organization,
            (
                PermissionCode.VIEW_FEES,
                PermissionCode.MANAGE_BALANCE_TRANSACTIONS,
                PermissionCode.REVIEW_BALANCE_TRANSACTIONS,
                PermissionCode.MANAGE_VOUCHERS,
                PermissionCode.MANAGE_CHARGE_CATALOG,
                PermissionCode.MANAGE_MANUAL_CHARGES,
                PermissionCode.MANAGE_FUND_FLOWS,
                PermissionCode.MANAGE_RENT_DETAILS,
                PermissionCode.MANAGE_BUSINESS_EXPENSES,
                PermissionCode.MANAGE_RECEIVABLE_BILLS,
                PermissionCode.MANAGE_PROFIT_CALCULATIONS,
            ),
        )


class CanManageBalanceTransactions(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_organization_permission(
            request.user,
            organization,
            PermissionCode.MANAGE_BALANCE_TRANSACTIONS,
        )


class CanReviewBalanceTransactions(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_any_organization_permission(
            request.user,
            organization,
            (
                PermissionCode.REVIEW_BALANCE_TRANSACTIONS,
                PermissionCode.MANAGE_BALANCE_TRANSACTIONS,
            ),
        )


class CanManageVouchers(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_organization_permission(request.user, organization, PermissionCode.MANAGE_VOUCHERS)


class CanManageChargeCatalog(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_organization_permission(request.user, organization, PermissionCode.MANAGE_CHARGE_CATALOG)


class CanManageManualCharges(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_organization_permission(request.user, organization, PermissionCode.MANAGE_MANUAL_CHARGES)


class CanManageFundFlows(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_organization_permission(request.user, organization, PermissionCode.MANAGE_FUND_FLOWS)


class CanManageRentDetails(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_organization_permission(request.user, organization, PermissionCode.MANAGE_RENT_DETAILS)


class CanManageBusinessExpenses(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_organization_permission(request.user, organization, PermissionCode.MANAGE_BUSINESS_EXPENSES)


class CanManageReceivableBills(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_organization_permission(request.user, organization, PermissionCode.MANAGE_RECEIVABLE_BILLS)


class CanManageProfitCalculations(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_organization_permission(
            request.user,
            organization,
            PermissionCode.MANAGE_PROFIT_CALCULATIONS,
        )

