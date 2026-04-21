from __future__ import annotations

from dataclasses import dataclass
from typing import Final

from django.conf import settings
from django.contrib.auth import authenticate
from django.core import signing
from django.db import transaction
from django.utils.text import slugify

from apps.accounts.models import User
from apps.accounts.services.demo_seed import seed_demo_workspace
from apps.iam.constants import PermissionCode
from apps.iam.models import Role, RoleAssignment
from apps.iam.permissions import membership_has_any_permission
from apps.iam.services.bootstrap import sync_system_roles
from apps.organizations.models import (
    MembershipType,
    Organization,
    OrganizationMembership,
    OrganizationStaffProfile,
)
from apps.warehouse.models import Warehouse

SESSION_TOKEN_SALT: Final[str] = "apps.accounts.session"
SESSION_TOKEN_MAX_AGE_SECONDS: Final[int] = getattr(
    settings,
    "ACCOUNT_HEADER_SESSION_MAX_AGE_SECONDS",
    60 * 60 * 24 * 30,
)
ROLE_PRIORITY: Final[dict[str, int]] = {
    Role.SystemCode.OWNER: 0,
    Role.SystemCode.MANAGER: 1,
    Role.SystemCode.STAFF: 2,
    Role.SystemCode.CLIENT_ADMIN: 3,
    Role.SystemCode.CLIENT_USER: 4,
}


@dataclass(frozen=True, slots=True)
class SessionClaims:
    user_id: int
    membership_id: int


@dataclass(frozen=True, slots=True)
class SessionContext:
    user: User
    membership: OrganizationMembership
    token: str


@dataclass(frozen=True, slots=True)
class BootstrapSessionContext:
    session: SessionContext
    used_default_name: bool
    used_default_password: bool
    seed_summary: dict[str, int]


def authenticate_user_identifier(*, identifier: str, password: str) -> User | None:
    normalized_identifier = identifier.strip().lower()
    if not normalized_identifier:
        return None

    authenticated_user = authenticate(username=normalized_identifier, password=password)
    if isinstance(authenticated_user, User):
        return authenticated_user
    return None


def get_active_memberships_for_user(user: User) -> list[OrganizationMembership]:
    return list(
        OrganizationMembership.objects.select_related(
            "organization",
            "user",
            "staff_profile",
            "staff_profile__default_warehouse",
        )
        .prefetch_related("role_assignments__role")
        .filter(user=user, is_active=True, organization__is_active=True)
        .order_by("organization__name", "organization_id", "id")
    )


def get_default_membership_for_user(user: User) -> OrganizationMembership | None:
    memberships = get_active_memberships_for_user(user)
    if not memberships:
        return None
    return memberships[0]


def get_authenticated_membership(*, user: object, auth: object) -> OrganizationMembership | None:
    if not isinstance(user, User) or not user.is_authenticated:
        return None

    membership_id = getattr(auth, "membership_id", None)
    if not isinstance(membership_id, int):
        return None

    return (
        OrganizationMembership.objects.select_related(
            "organization",
            "user",
            "staff_profile",
            "staff_profile__default_warehouse",
        )
        .prefetch_related("role_assignments__role")
        .filter(
            id=membership_id,
            user=user,
            is_active=True,
            organization__is_active=True,
        )
        .first()
    )


def get_membership_staff_profile(
    membership: OrganizationMembership,
) -> OrganizationStaffProfile | None:
    cached_profile = membership._state.fields_cache.get("staff_profile")
    if isinstance(cached_profile, OrganizationStaffProfile):
        return cached_profile
    return (
        OrganizationStaffProfile.objects.select_related("default_warehouse")
        .filter(membership=membership)
        .first()
    )


def issue_session_token(*, membership: OrganizationMembership) -> str:
    return signing.dumps(
        {
            "user_id": membership.user_id,
            "membership_id": membership.id,
        },
        salt=SESSION_TOKEN_SALT,
        compress=True,
    )


def parse_session_token(token: str) -> SessionClaims:
    payload = signing.loads(
        token,
        salt=SESSION_TOKEN_SALT,
        max_age=SESSION_TOKEN_MAX_AGE_SECONDS,
    )
    user_id = payload.get("user_id")
    membership_id = payload.get("membership_id")
    if not isinstance(user_id, int) or not isinstance(membership_id, int):
        raise signing.BadSignature("Session token is missing required claims.")
    return SessionClaims(user_id=user_id, membership_id=membership_id)


def get_membership_display_role(membership: OrganizationMembership) -> str:
    roles = sorted(
        (
            assignment.role
            for assignment in membership.role_assignments.all()
            if assignment.role.is_active
        ),
        key=lambda role: (ROLE_PRIORITY.get(role.code, 99), role.name, role.id),
    )
    if roles:
        return roles[0].name
    return membership.get_membership_type_display()


def is_company_admin_membership(membership: OrganizationMembership) -> bool:
    return membership_has_any_permission(
        membership,
        (PermissionCode.MANAGE_MEMBERSHIPS,),
    )


def can_manage_users(membership: OrganizationMembership) -> bool:
    return membership_has_any_permission(
        membership,
        (
            PermissionCode.MANAGE_MEMBERSHIPS,
            PermissionCode.MANAGE_CLIENT_USERS,
        ),
    )


def build_authenticated_response(
    *,
    membership: OrganizationMembership,
    token: str | None = None,
    extra: dict[str, object] | None = None,
) -> dict[str, object]:
    membership = reconcile_authenticated_membership(membership)
    operator_profile = ensure_operator_profile(membership)
    response_payload: dict[str, object] = {
        "name": membership.user.display_name,
        "openid": membership.organization.slug,
        "token": token or issue_session_token(membership=membership),
        "user_id": operator_profile.id,
        "company_id": membership.organization_id,
        "company_name": membership.organization.name,
        "membership_id": membership.id,
        "mfa_enrollment_required": False,
    }
    if extra:
        response_payload.update(extra)
    return response_payload


def _build_unique_organization_slug(base_label: str) -> str:
    base_slug = slugify(base_label) or "organization"
    candidate_slug = base_slug
    suffix = 2
    while Organization.objects.filter(slug=candidate_slug).exists():
        candidate_slug = f"{base_slug}-{suffix}"
        suffix += 1
    return candidate_slug


def get_system_role(code: str) -> Role:
    existing_role = (
        Role.objects.filter(
            organization__isnull=True,
            code=code,
            is_system=True,
        )
        .order_by("id")
        .first()
    )
    if existing_role is not None:
        return existing_role

    sync_system_roles()
    return Role.objects.get(
        organization__isnull=True,
        code=code,
        is_system=True,
    )


def reconcile_authenticated_membership(membership: OrganizationMembership) -> OrganizationMembership:
    sync_system_roles()

    default_email, *_ = _get_test_system_defaults()
    if membership.user.email.strip().lower() == default_email:
        owner_role = get_system_role(Role.SystemCode.OWNER)
        RoleAssignment.objects.get_or_create(
            membership=membership,
            role=owner_role,
        )

    return membership


def ensure_operator_profile(membership: OrganizationMembership) -> OrganizationStaffProfile:
    profile = get_membership_staff_profile(membership)
    if profile is not None:
        return profile

    role_name = get_membership_display_role(membership)
    profile, _ = OrganizationStaffProfile.objects.get_or_create(
        organization=membership.organization,
        membership=membership,
        defaults={
            "staff_name": membership.user.display_name,
            "staff_type": role_name,
            "check_code": 8888,
            "is_lock": False,
        },
    )
    return profile


@transaction.atomic
def ensure_default_membership_for_user(user: User) -> OrganizationMembership:
    membership = get_default_membership_for_user(user)
    if membership is not None:
        return reconcile_authenticated_membership(membership)

    organization_label = f"{user.display_name}'s Organization"
    organization = Organization.objects.create(
        name=organization_label,
        slug=_build_unique_organization_slug(organization_label),
    )
    membership = OrganizationMembership.objects.create(
        user=user,
        organization=organization,
        membership_type=MembershipType.INTERNAL,
        is_active=True,
    )
    owner_role = get_system_role(Role.SystemCode.OWNER)
    RoleAssignment.objects.get_or_create(
        membership=membership,
        role=owner_role,
    )
    return membership


def _get_test_system_defaults() -> tuple[str, str, str, str, str, str]:
    return (
        str(getattr(settings, "TEST_SYSTEM_DEFAULT_EMAIL", "test-system-admin@example.com")).strip().lower(),
        str(getattr(settings, "TEST_SYSTEM_DEFAULT_PASSWORD", "TestSystem123!")),
        str(getattr(settings, "TEST_SYSTEM_DEFAULT_NAME", "Test System Admin")).strip() or "Test System Admin",
        str(getattr(settings, "TEST_SYSTEM_DEFAULT_ORGANIZATION_NAME", "Test System Organization")).strip()
        or "Test System Organization",
        str(getattr(settings, "TEST_SYSTEM_DEFAULT_WAREHOUSE_NAME", "Main Warehouse")).strip() or "Main Warehouse",
        str(getattr(settings, "TEST_SYSTEM_DEFAULT_WAREHOUSE_CODE", "MAIN")).strip().upper() or "MAIN",
    )


@transaction.atomic
def provision_test_system_session() -> BootstrapSessionContext:
    default_email, default_password, default_name, default_organization_name, default_warehouse_name, default_warehouse_code = (
        _get_test_system_defaults()
    )
    sync_system_roles()
    seed_summary = {
        "users": 0,
        "organizations": 0,
        "memberships": 0,
        "warehouses": 0,
    }

    user = User.objects.filter(email__iexact=default_email).first()
    if user is None:
        user = User.objects.create_user(
            email=default_email,
            password=default_password,
            full_name=default_name,
        )
        seed_summary["users"] = 1
    else:
        update_fields: list[str] = []
        if not user.is_active:
            user.is_active = True
            update_fields.append("is_active")
        if not user.full_name.strip():
            user.full_name = default_name
            update_fields.append("full_name")
        if update_fields:
            user.save(update_fields=update_fields)

    membership = (
        OrganizationMembership.objects.select_related("organization")
        .filter(user=user)
        .order_by("id")
        .first()
    )
    if membership is None:
        organization = Organization.objects.create(
            name=default_organization_name,
            slug=_build_unique_organization_slug(default_organization_name),
        )
        seed_summary["organizations"] = 1
        membership = OrganizationMembership.objects.create(
            user=user,
            organization=organization,
            membership_type=MembershipType.INTERNAL,
            is_active=True,
        )
        seed_summary["memberships"] = 1
    else:
        organization = membership.organization
        membership_updates: list[str] = []
        if not organization.is_active:
            organization.is_active = True
            organization.save(update_fields=["is_active"])
        if membership.membership_type != MembershipType.INTERNAL:
            membership.membership_type = MembershipType.INTERNAL
            membership_updates.append("membership_type")
        if not membership.is_active:
            membership.is_active = True
            membership_updates.append("is_active")
        if membership_updates:
            membership.save(update_fields=membership_updates)

    owner_role = get_system_role(Role.SystemCode.OWNER)
    RoleAssignment.objects.get_or_create(
        membership=membership,
        role=owner_role,
    )

    warehouse = (
        Warehouse.objects.filter(
            organization=organization,
            is_active=True,
        )
        .order_by("name", "id")
        .first()
    )
    if warehouse is None:
        warehouse = Warehouse.objects.create(
            organization=organization,
            name=default_warehouse_name,
            code=default_warehouse_code,
        )
        seed_summary["warehouses"] = 1

    profile = ensure_operator_profile(membership)
    profile_updates: list[str] = []
    if profile.staff_name != user.display_name:
        profile.staff_name = user.display_name
        profile_updates.append("staff_name")
    role_name = get_membership_display_role(membership)
    if profile.staff_type != role_name:
        profile.staff_type = role_name
        profile_updates.append("staff_type")
    if profile.default_warehouse_id is None:
        profile.default_warehouse = warehouse
        profile_updates.append("default_warehouse")
    if profile_updates:
        profile.save(update_fields=profile_updates)

    for category, created_count in seed_demo_workspace(
        organization=organization,
        membership=membership,
        warehouse=warehouse,
        operator_name=user.display_name,
    ).items():
        seed_summary[category] = created_count

    session = SessionContext(
        user=user,
        membership=membership,
        token=issue_session_token(membership=membership),
    )
    return BootstrapSessionContext(
        session=session,
        used_default_name=user.display_name == default_name,
        used_default_password=user.check_password(default_password),
        seed_summary=seed_summary,
    )


@transaction.atomic
def provision_signup_session(*, full_name: str, email: str, password: str) -> SessionContext:
    user = User.objects.create_user(
        email=email,
        password=password,
        full_name=full_name,
    )

    membership = ensure_default_membership_for_user(user)
    token = issue_session_token(membership=membership)
    return SessionContext(user=user, membership=membership, token=token)
