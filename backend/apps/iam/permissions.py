from __future__ import annotations

from collections.abc import Iterable

from django.db.models import Q

from apps.organizations.models import Organization, OrganizationMembership

from .models import AccessScope, PermissionOverride


def _split_permission_code(permission_code: str) -> tuple[str | None, str]:
    if "." not in permission_code:
        return None, permission_code
    return tuple(permission_code.split(".", 1))  # type: ignore[return-value]


def _permission_q(permission_code: str, *, prefix: str) -> Q:
    app_label, codename = _split_permission_code(permission_code)
    query = Q(**{f"{prefix}__codename": codename})
    if app_label:
        query &= Q(**{f"{prefix}__content_type__app_label": app_label})
    return query


def _scope_q(scope: AccessScope | None) -> Q:
    if scope is None:
        return Q(scope__isnull=True)
    return Q(scope__isnull=True) | Q(scope=scope)


def membership_has_permission(
    membership: OrganizationMembership | None,
    permission_code: str,
    *,
    scope: AccessScope | None = None,
) -> bool:
    if membership is None or not membership.is_active:
        return False

    scope_query = _scope_q(scope)
    overrides = membership.permission_overrides.filter(scope_query).filter(
        _permission_q(permission_code, prefix="permission")
    )

    if overrides.filter(effect=PermissionOverride.Effect.DENY).exists():
        return False
    if overrides.filter(effect=PermissionOverride.Effect.ALLOW).exists():
        return True

    role_grants = membership.role_assignments.filter(scope_query).filter(
        _permission_q(permission_code, prefix="role__role_permissions__permission")
    )
    if role_grants.exists():
        return True

    group_grants = membership.group_assignments.filter(scope_query).filter(
        _permission_q(permission_code, prefix="group__group_permissions__permission")
    )
    return group_grants.exists()


def membership_has_any_permission(
    membership: OrganizationMembership | None,
    permission_codes: Iterable[str],
    *,
    scope: AccessScope | None = None,
) -> bool:
    return any(
        membership_has_permission(membership, permission_code, scope=scope)
        for permission_code in permission_codes
    )


def get_active_membership(user: object, organization: Organization) -> OrganizationMembership | None:
    if not getattr(user, "is_authenticated", False):
        return None
    return OrganizationMembership.objects.filter(
        user=user,
        organization=organization,
        is_active=True,
    ).first()


def user_has_organization_permission(
    user: object,
    organization: Organization,
    permission_code: str,
    *,
    scope: AccessScope | None = None,
) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False):
        return True

    membership = get_active_membership(user, organization)
    return membership_has_permission(membership, permission_code, scope=scope)


def user_has_any_organization_permission(
    user: object,
    organization: Organization,
    permission_codes: Iterable[str],
    *,
    scope: AccessScope | None = None,
) -> bool:
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False):
        return True

    membership = get_active_membership(user, organization)
    return membership_has_any_permission(membership, permission_codes, scope=scope)
