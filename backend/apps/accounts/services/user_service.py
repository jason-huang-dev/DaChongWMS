from __future__ import annotations

from dataclasses import dataclass

from apps.accounts.models import User


@dataclass(frozen=True, slots=True)
class CreateUserInput:
    email: str
    full_name: str = ""
    password: str | None = None
    is_staff: bool = False
    is_superuser: bool = False
    is_active: bool = True


def create_user(payload: CreateUserInput) -> User:
    return User.objects.create_user(
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
        is_staff=payload.is_staff,
        is_superuser=payload.is_superuser,
        is_active=payload.is_active,
    )


def get_or_create_user_by_email(
    *,
    email: str,
    full_name: str = "",
    password: str | None = None,
) -> tuple[User, bool]:
    normalized_email = User.objects.normalize_email(email).strip().lower()
    user = User.objects.filter(email=normalized_email).first()
    created = user is None
    if user is None:
        user = User.objects.create_user(
            email=normalized_email,
            password=password,
            full_name=full_name,
        )
        return user, True

    updated_fields: list[str] = []
    if full_name and user.full_name != full_name:
        user.full_name = full_name
        updated_fields.append("full_name")
    if password:
        user.set_password(password)
        updated_fields.append("password")
    if updated_fields:
        user.save(update_fields=updated_fields)
    return user, created
