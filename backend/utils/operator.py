"""Helpers for resolving the acting staff operator from API requests."""

from __future__ import annotations

from typing import cast

from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from staff.models import ListModel as Staff


def get_request_operator(request: Request) -> Staff:
    cached = getattr(request, "_cached_operator_staff", None)
    if cached is not None:
        return cast(Staff, cached)

    openid = getattr(request.auth, "openid", None)
    if not isinstance(openid, str) or not openid:
        raise PermissionDenied({"detail": "Authentication token missing openid"})

    operator_id = request.META.get("HTTP_OPERATOR")
    if not operator_id:
        raise PermissionDenied({"detail": "Please provide the HTTP_OPERATOR header"})

    operator = Staff.objects.filter(
        id=operator_id,
        openid=openid,
        is_delete=False,
    ).first()
    if operator is None:
        raise PermissionDenied({"detail": "Operator does not belong to the authenticated tenant"})
    if operator.is_lock:
        raise PermissionDenied({"detail": "Operator is locked"})

    setattr(request, "_cached_operator_staff", operator)
    return operator
