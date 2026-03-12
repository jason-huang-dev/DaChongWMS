"""Legacy per-method throttling helper."""

from __future__ import annotations

from datetime import datetime
from functools import lru_cache
from typing import Any, Dict, Protocol, Sequence, cast

from django.apps import apps
from django.conf import settings
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.throttling import BaseThrottle

from .md5 import Md5


class _ThrottleQuerySet(Protocol):
    def filter(self, **kwargs: Any) -> "_ThrottleQuerySet": ...

    def order_by(self, *fields: str) -> "_ThrottleQuerySet": ...

    def delete(self) -> Sequence[Any]: ...

    def count(self) -> int: ...

    def first(self) -> "_ThrottleEntry | None": ...


class _ThrottleManager(Protocol):
    def filter(self, **kwargs: Any) -> _ThrottleQuerySet: ...

    def create(self, **kwargs: Any) -> "_ThrottleEntry": ...


class _ThrottleEntry(Protocol):
    objects: _ThrottleManager
    create_time: datetime


_DOC_WHITELIST: set[str] = {"/api/docs/", "/api/debug/", "/api/"}

_METHOD_LIMITS: Dict[str, int] = {
    "get": getattr(settings, "GET_THROTTLE", 500),
    "post": getattr(settings, "POST_THROTTLE", 500),
    "put": getattr(settings, "PUT_THROTTLE", 500),
    "patch": getattr(settings, "PATCH_THROTTLE", 500),
    "delete": getattr(settings, "DELETE_THROTTLE", 500),
}

ALLOCATION_SECONDS = getattr(settings, "ALLOCATION_SECONDS", 1)


class VisitThrottle(BaseThrottle):
    def __init__(self) -> None:
        self._wait_until: datetime | None = None

    def allow_request(self, request: Request, view: Any) -> bool:  # pragma: no cover - DRF hook
        if request.path in _DOC_WHITELIST:
            return True
        model = _get_throttle_model()
        auth = getattr(request, "auth", None)
        if model is None or not auth:
            return True

        method = request.method.lower()
        limit = _METHOD_LIMITS.get(method)
        if limit is None:
            return True

        ip = request.META.get("HTTP_X_FORWARDED_FOR") or request.META.get("REMOTE_ADDR")
        if not ip:
            return True

        cutoff = timezone.now() - timezone.timedelta(seconds=ALLOCATION_SECONDS)
        model.objects.filter(method=method, create_time__lte=cutoff).delete()

        token = Md5.md5(ip)
        queryset = (
            model.objects.filter(
                openid=getattr(auth, "openid", None),
                appid=getattr(auth, "appid", None),
                ip=ip,
                method=method,
            ).order_by("id")
        )
        count = queryset.count()
        latest = queryset.first()

        model.objects.create(
            openid=getattr(auth, "openid", None),
            appid=getattr(auth, "appid", None),
            ip=ip,
            method=method,
            t_code=token,
        )

        if latest is None:
            return True

        self._wait_until = latest.create_time
        delta_seconds = (timezone.now() - latest.create_time).total_seconds()
        if delta_seconds >= ALLOCATION_SECONDS:
            return True
        return count < limit

    def wait(self) -> float | None:  # pragma: no cover - DRF hook
        if not self._wait_until:
            return None
        delta = (timezone.now() - self._wait_until).total_seconds()
        remaining = max(ALLOCATION_SECONDS - delta, 0.0)
        return remaining or None


@lru_cache(maxsize=1)
def _get_throttle_model() -> type[_ThrottleEntry] | None:
    try:  # pragma: no cover - depends on optional app
        model = apps.get_model("throttle.ListModel")
    except (LookupError, ValueError):
        return None
    return cast(type[_ThrottleEntry], model)
