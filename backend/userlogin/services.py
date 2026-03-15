"""Authentication-related service helpers."""

from __future__ import annotations

from dataclasses import dataclass

from django.contrib.auth import get_user_model
from django.db import transaction

from staff.models import ListModel as Staff
from userprofile.models import Users
from utils.md5 import Md5


@dataclass(frozen=True)
class RegistrationResult:
    auth_user: object
    profile: Users
    staff: Staff


@dataclass(frozen=True)
class WorkspaceIdentity:
    auth_user: object
    profile: Users
    staff: Staff


def resolve_workspace_identity(*, auth_user=None, username: str | None = None) -> WorkspaceIdentity:
    user_model = get_user_model()
    if auth_user is None:
        if not username:
            raise ValueError("username is required when auth_user is not provided")
        auth_user = user_model.objects.filter(username=username).first()
    if auth_user is None:
        raise ValueError("Authenticated user not found")

    profile = Users.objects.filter(user_id=auth_user.id, is_delete=False).first()
    if profile is None:
        raise ValueError("User profile not found")

    staff = Staff.objects.filter(
        openid=profile.openid,
        staff_name=profile.name,
        is_delete=False,
    ).first()
    if staff is None:
        raise ValueError("Staff record not found")

    return WorkspaceIdentity(auth_user=auth_user, profile=profile, staff=staff)


def build_auth_response_data(*, identity: WorkspaceIdentity, mfa_enrollment_required: bool, extra: dict[str, object] | None = None) -> dict[str, object]:
    payload: dict[str, object] = {
        "name": getattr(identity.auth_user, "username", identity.profile.name),
        "openid": identity.profile.openid,
        "user_id": identity.staff.id,
        "mfa_enrollment_required": mfa_enrollment_required,
    }
    if extra:
        payload.update(extra)
    return payload


@transaction.atomic
def register_workspace_user(*, username: str, password: str, email: str, ip: str) -> RegistrationResult:
    user_model = get_user_model()
    auth_user = user_model.objects.create_user(username=username, password=password, email=email)
    openid = Md5.md5(username)
    profile = Users.objects.create(
        user_id=auth_user.id,
        name=username,
        vip=1,
        openid=openid,
        appid=Md5.md5(f"{username}-appid"),
        developer=False,
        t_code=Md5.md5(f"{username}-t-code"),
        ip=ip,
    )
    staff = Staff.objects.create(
        staff_name=username,
        staff_type="Manager",
        check_code=8888,
        openid=openid,
    )
    return RegistrationResult(auth_user=auth_user, profile=profile, staff=staff)
