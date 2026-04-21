from __future__ import annotations

from dataclasses import dataclass

from django.db import transaction
from django.db.models import Q

from apps.accounts.services.user_service import get_or_create_user_by_email
from apps.iam.constants import PermissionCode
from apps.iam.models import Role, RoleAssignment
from apps.iam.permissions import get_active_membership, user_has_organization_permission
from apps.iam.role_assignment_policy import can_assign_role, sync_role_assignment_policies
from apps.organizations.models import MembershipType, Organization, OrganizationMembership
from apps.partners.models import CustomerAccount
from apps.partners.services.customer_accounts import (
    get_customer_account_scope,
    grant_client_account_access,
)


class MembershipError(Exception):
    pass


@dataclass(frozen=True, slots=True)
class CreateOrganizationUserInput:
    actor: object
    organization: Organization
    email: str
    full_name: str
    membership_type: str = MembershipType.INTERNAL
    role_code: str | None = None
    customer_account_id: int | None = None


def _can_manage_membership_type(
    *,
    actor: object,
    organization: Organization,
    membership_type: str,
    customer_account: CustomerAccount | None = None,
) -> bool:
    if getattr(actor, "is_superuser", False):
        return True

    can_manage_internal = user_has_organization_permission(
        actor,
        organization,
        PermissionCode.MANAGE_MEMBERSHIPS,
    )
    can_manage_clients = user_has_organization_permission(
        actor,
        organization,
        PermissionCode.MANAGE_CLIENT_USERS,
        scope=get_customer_account_scope(customer_account) if customer_account else None,
    )

    if membership_type == MembershipType.CLIENT:
        return can_manage_clients or can_manage_internal
    return can_manage_internal


@transaction.atomic
def create_organization_user(payload: CreateOrganizationUserInput) -> tuple[OrganizationMembership, bool]:
    sync_role_assignment_policies()
    customer_account: CustomerAccount | None = None
    if payload.membership_type == MembershipType.CLIENT:
        if payload.customer_account_id is None:
            raise MembershipError("Client users must be assigned to a customer account.")
        customer_account = CustomerAccount.objects.filter(
            pk=payload.customer_account_id,
            organization=payload.organization,
            is_active=True,
        ).first()
        if customer_account is None:
            raise MembershipError("Customer account does not exist in this organization.")
    elif payload.customer_account_id is not None:
        raise MembershipError("Internal users cannot be assigned to a customer account.")

    if not _can_manage_membership_type(
        actor=payload.actor,
        organization=payload.organization,
        membership_type=payload.membership_type,
        customer_account=customer_account,
    ):
        raise MembershipError(
            f"You are not allowed to create {payload.membership_type.lower()} users in this organization."
        )

    user, created = get_or_create_user_by_email(
        email=payload.email,
        full_name=payload.full_name,
    )
    membership, membership_created = OrganizationMembership.objects.get_or_create(
        user=user,
        organization=payload.organization,
        defaults={"membership_type": payload.membership_type},
    )

    if not membership_created:
        membership.membership_type = payload.membership_type
        membership.is_active = True
        membership.save(update_fields=["membership_type", "is_active"])

    actor_membership = None
    if not getattr(payload.actor, "is_superuser", False):
        actor_membership = get_active_membership(payload.actor, payload.organization)

    if payload.membership_type == MembershipType.CLIENT and customer_account is not None:
        customer_account_scope = get_customer_account_scope(customer_account)
        if payload.role_code:
            role = Role.objects.filter(
                Q(organization=payload.organization) | Q(organization__isnull=True),
                code=payload.role_code,
                is_active=True,
            ).first()
            if role is None:
                raise MembershipError(f"Role '{payload.role_code}' does not exist for this organization.")
            if role.membership_type != MembershipType.CLIENT:
                raise MembershipError("Only client roles can be assigned to customer account access.")
            if actor_membership is not None and not can_assign_role(actor_membership, role, scope=customer_account_scope):
                raise MembershipError("You are not allowed to assign this role.")
        try:
            grant_client_account_access(
                membership=membership,
                customer_account=customer_account,
                role_code=payload.role_code or Role.SystemCode.CLIENT_USER,
            )
        except ValueError as exc:
            raise MembershipError(str(exc)) from exc
    elif payload.role_code:
        role = Role.objects.filter(
            Q(organization=payload.organization) | Q(organization__isnull=True),
            code=payload.role_code,
            is_active=True,
        ).first()
        if role is None:
            raise MembershipError(f"Role '{payload.role_code}' does not exist for this organization.")
        if role.membership_type != membership.membership_type:
            raise MembershipError("Role membership_type does not match the membership.")
        if actor_membership is not None and not can_assign_role(actor_membership, role):
            raise MembershipError("You are not allowed to assign this role.")
        RoleAssignment.objects.get_or_create(membership=membership, role=role)

    return membership, created
