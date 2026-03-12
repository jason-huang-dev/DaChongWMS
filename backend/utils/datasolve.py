"""Validation helpers ported from the legacy GreaterWMS project.

The functions intentionally avoid hard-coding DaChongWMS domain knowledge so we
can gradually hook them into future multi-tenant apps.  Whenever the original
implementation depended on models that do not yet exist in this repository the
helpers now raise a descriptive ``APIException`` to highlight the missing
integration point instead of crashing on import.
"""

# cSpell:ignore DaChongWMS

from __future__ import annotations

import base64
import json
import re
from typing import Any, Dict, Protocol, Sequence, cast

from rest_framework.exceptions import APIException

try:  # pragma: no cover - optional dependency
    from userprofile.models import Users as _ImportedLegacyUser
except Exception:  # ImportError or AppRegistryNotReady
    _ImportedLegacyUser = None


class _LegacyUserQuerySet(Protocol):
    def filter(self, **kwargs: Any) -> "_LegacyUserQuerySet": ...

    def exists(self) -> bool: ...


class _LegacyUserModel(Protocol):
    objects: _LegacyUserQuerySet


_LegacyUser = cast("_LegacyUserModel | None", _ImportedLegacyUser)


def _ensure_user_model(field: str) -> _LegacyUserModel:
    if _LegacyUser is None:
        raise APIException(
            {
                "detail": (
                    f"Cannot validate {field} because the legacy `userprofile` app "
                    "is not installed. Port the app or replace this validator."
                )
            }
        )
    return _LegacyUser


def data_validate(value: str) -> str:
    """Reject obvious script/select injections; otherwise echo the value."""

    _reject_common_injection_tokens(value)
    return value


def qty_0_data_validate(value: int) -> int:
    _reject_common_injection_tokens(value)
    if value <= 0:
        raise APIException({"detail": "Qty Must > 0"})
    return value


def qty_data_validate(value: int) -> int:
    _reject_common_injection_tokens(value)
    if value < 0:
        raise APIException({"detail": "Qty Must >= 0"})
    return value


def openid_validate(value: str) -> str:
    user_model = _ensure_user_model("openid")
    if user_model.objects.filter(openid=value).exists():
        return value
    raise APIException({"detail": "User does not exists"})


def appid_validate(value: str) -> str:
    user_model = _ensure_user_model("appid")
    if user_model.objects.filter(appid=value).exists():
        return value
    raise APIException({"detail": "User does not exists"})


def asn_data_validate(value: str) -> str:
    _reject_common_injection_tokens(value)
    numbers = re.findall(r"\d+", str(value), re.IGNORECASE)
    if not numbers:
        raise APIException({"detail": "ASN code missing numeric suffix"})
    base = numbers[0]
    if base == "00000001":
        return "ASN00000001"
    return "ASN" + str(int(base) + 1).zfill(8)


def dn_data_validate(value: str) -> str:
    _reject_common_injection_tokens(value)
    numbers = re.findall(r"\d+", str(value), re.IGNORECASE)
    if not numbers:
        raise APIException({"detail": "DN code missing numeric suffix"})
    base = numbers[0]
    if base == "00000001":
        return "DN00000001"
    return "DN" + str(int(base) + 1).zfill(8)


def sumOfList(values: Sequence[float], size: int | None = None) -> float:
    """Recursive sum helper maintained for backwards compatibility."""

    if size is None:
        size = len(values)
    if size <= 0:
        return 0
    return values[size - 1] + sumOfList(values, size - 1)


def is_number(value: object) -> bool:
    try:
        float(value)  # type: ignore[arg-type]
        return True
    except (TypeError, ValueError):
        pass
    try:
        import unicodedata

        unicodedata.numeric(value)  # type: ignore[arg-type]
        return True
    except (TypeError, ValueError):
        return False


def secret_bar_code(value: str) -> str:
    return base64.b64encode(str(value).encode()).decode()


def verify_bar_code(value: str) -> Dict[str, Any]:
    decoded = base64.b64decode(str(value).encode()).decode().replace("'", '"')
    return cast(Dict[str, Any], json.loads(decoded))


def transportation_calculate(weight: float, volume: float, weight_fee: float, volume_fee: float, min_fee: float) -> float:
    weight_cost = weight * weight_fee
    volume_cost = volume * volume_fee
    candidate = weight_cost if weight_cost > volume_cost else volume_cost
    return round(candidate if candidate > min_fee else min_fee, 2)


def _reject_common_injection_tokens(value: object) -> None:
    text = str(value)
    for keyword in ("script", "select"):
        if re.findall(keyword, text, re.IGNORECASE):
            raise APIException({"detail": "Bad data cannot be stored"})
