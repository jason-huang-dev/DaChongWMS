"""Simple logging bridge to the legacy ``wms.Logs`` model."""

from __future__ import annotations

from typing import Any, Protocol, cast

from django.apps import apps


class _LogManager(Protocol):
    def create(self, **kwargs: Any) -> Any: ...


class _LogModel(Protocol):
    objects: _LogManager


class Logdrf:
    @staticmethod
    def logs(openid: str, appid: str, log_transaction: str, log_code: str) -> None:
        LogModel = _get_log_model()
        if LogModel is None:
            return
        LogModel.objects.create(
            openid=openid,
            appid=appid,
            log_transaction=log_transaction,
            log_code=log_code,
        )


def _get_log_model() -> type[_LogModel] | None:
    try:  # pragma: no cover - optional dependency
        model = apps.get_model("wms.Logs")
    except (LookupError, ValueError):
        return None
    return cast(type[_LogModel], model)
