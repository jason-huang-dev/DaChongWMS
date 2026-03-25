from __future__ import annotations

from django.contrib.auth.models import Permission
from django.db import transaction

from apps.iam.constants import SYSTEM_ROLE_SPECS, SystemRoleSpec
from apps.iam.models import Role, RoleAssignment, RolePermission


def _get_permission(permission_code: str) -> Permission | None:
    if "." not in permission_code:
        return Permission.objects.filter(codename=permission_code).first()
    app_label, codename = permission_code.split(".", 1)
    return Permission.objects.filter(
        content_type__app_label=app_label,
        codename=codename,
    ).first()


def _sync_role_permissions(role: Role, spec: SystemRoleSpec) -> None:
    desired_permission_ids = {
        permission.id
        for permission_code in spec.permissions
        if (permission := _get_permission(permission_code)) is not None
    }

    role.role_permissions.exclude(permission_id__in=desired_permission_ids).delete()
    existing_permission_ids = set(
        role.role_permissions.values_list("permission_id", flat=True)
    )
    missing_permission_ids = desired_permission_ids - existing_permission_ids
    if missing_permission_ids:
        through_model = role.role_permissions.model
        through_model.objects.bulk_create(
            [
                through_model(role=role, permission_id=permission_id)
                for permission_id in sorted(missing_permission_ids)
            ]
        )


def _consolidate_duplicate_system_roles(role: Role) -> Role:
    duplicates = list(
        Role.objects.filter(
            organization__isnull=True,
            code=role.code,
        )
        .exclude(pk=role.pk)
        .order_by("id")
    )
    if not duplicates:
        return role

    for duplicate in duplicates:
        duplicate_permissions = RolePermission.objects.filter(role=duplicate)
        for duplicate_permission in duplicate_permissions:
            RolePermission.objects.get_or_create(
                role=role,
                permission=duplicate_permission.permission,
            )

        duplicate_assignments = RoleAssignment.objects.filter(role=duplicate)
        for duplicate_assignment in duplicate_assignments:
            RoleAssignment.objects.get_or_create(
                membership=duplicate_assignment.membership,
                role=role,
                scope=duplicate_assignment.scope,
            )

        duplicate.delete()
    return role


@transaction.atomic
def sync_system_roles() -> list[Role]:
    synced_roles: list[Role] = []
    for spec in SYSTEM_ROLE_SPECS:
        existing_role = (
            Role.objects.filter(
                organization__isnull=True,
                code=spec.code,
            )
            .order_by("id")
            .first()
        )
        if existing_role is None:
            role = Role.objects.create(
                organization=None,
                code=spec.code,
                name=spec.name,
                membership_type=spec.membership_type,
                is_system=True,
                is_active=True,
            )
        else:
            role = existing_role
            changed = False
            if role.name != spec.name:
                role.name = spec.name
                changed = True
            if role.membership_type != spec.membership_type:
                role.membership_type = spec.membership_type
                changed = True
            if not role.is_system:
                role.is_system = True
                changed = True
            if not role.is_active:
                role.is_active = True
                changed = True
            if changed:
                role.save(update_fields=["name", "membership_type", "is_system", "is_active"])
        role = _consolidate_duplicate_system_roles(role)
        _sync_role_permissions(role, spec)
        synced_roles.append(role)
    return synced_roles
