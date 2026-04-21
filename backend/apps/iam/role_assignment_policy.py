from __future__ import annotations

from apps.iam.constants import PermissionCode
from apps.iam.models import Role
from apps.iam.models import AccessScope
from apps.iam.permissions import membership_permission_codes
from apps.iam.services.bootstrap import sync_system_roles
from apps.organizations.models import OrganizationMembership


def sync_role_assignment_policies() -> None:
    sync_system_roles()


def role_permission_codes(role: Role) -> set[str]:
    return {
        f"{app_label}.{codename}"
        for app_label, codename in role.role_permissions.values_list(
            "permission__content_type__app_label",
            "permission__codename",
        )
        if app_label and codename
    }


def role_management_flags(role: Role) -> tuple[bool, bool]:
    permission_codes = role_permission_codes(role)
    return (
        PermissionCode.MANAGE_MEMBERSHIPS in permission_codes,
        PermissionCode.MANAGE_CLIENT_USERS in permission_codes,
    )


def membership_has_unscoped_role_code(
    membership: OrganizationMembership,
    role_code: str,
) -> bool:
    return membership.role_assignments.filter(
        scope__isnull=True,
        role__code=role_code,
        role__is_active=True,
    ).exists()


def can_assign_role(
    actor_membership: OrganizationMembership,
    role: Role,
    *,
    scope: AccessScope | None = None,
) -> bool:
    sync_role_assignment_policies()

    if membership_has_unscoped_role_code(actor_membership, Role.SystemCode.OWNER):
        return True
    if role.organization_id is None and role.code == Role.SystemCode.OWNER:
        return False

    actor_permission_codes = set(membership_permission_codes(actor_membership, scope=scope))
    target_permission_codes = role_permission_codes(role)
    return target_permission_codes.issubset(actor_permission_codes)
