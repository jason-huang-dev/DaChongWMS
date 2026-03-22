from __future__ import annotations

from django.contrib.auth.models import Permission
from django.db import transaction

from apps.iam.constants import SYSTEM_ROLE_SPECS, SystemRoleSpec
from apps.iam.models import Role


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


@transaction.atomic
def sync_system_roles() -> list[Role]:
    synced_roles: list[Role] = []
    for spec in SYSTEM_ROLE_SPECS:
        role, _ = Role.objects.update_or_create(
            organization=None,
            code=spec.code,
            defaults={
                "name": spec.name,
                "membership_type": spec.membership_type,
                "is_system": True,
                "is_active": True,
            },
        )
        _sync_role_permissions(role, spec)
        synced_roles.append(role)
    return synced_roles
