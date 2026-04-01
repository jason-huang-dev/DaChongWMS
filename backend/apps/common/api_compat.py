from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Callable, TypeVar

from rest_framework.pagination import PageNumberPagination
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.services.session_service import get_authenticated_membership
from apps.organizations.models import OrganizationMembership

TRecord = TypeVar("TRecord")


class CompatibilityPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 500


def get_compat_membership(request: Request) -> OrganizationMembership | None:
    return get_authenticated_membership(user=request.user, auth=request.auth)


def get_query_value(request: Request, *keys: str) -> str | None:
    for key in keys:
        value = request.query_params.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def get_optional_int(request: Request, *keys: str) -> int | None:
    value = get_query_value(request, *keys)
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def decimal_to_string(value: Decimal | int | float | str) -> str:
    return str(value)


def iso_date(value: date | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def iso_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def paginate_compat_list(
    *,
    request: Request,
    view: object,
    records: object,
    serializer: Callable[[TRecord], dict[str, object]],
) -> Response:
    paginator = CompatibilityPagination()
    page = paginator.paginate_queryset(records, request, view=view)
    serialized = [serializer(record) for record in (page or records)]
    if page is not None:
        return paginator.get_paginated_response(serialized)
    return Response({"count": len(serialized), "next": None, "previous": None, "results": serialized})


def empty_compat_response(*, request: Request, view: object) -> Response:
    return paginate_compat_list(
        request=request,
        view=view,
        records=[],
        serializer=lambda _record: {},
    )
