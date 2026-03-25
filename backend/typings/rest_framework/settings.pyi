from __future__ import annotations

from typing import Any


class _APISettings:
    DEFAULT_AUTHENTICATION_CLASSES: list[Any]
    DEFAULT_PERMISSION_CLASSES: list[Any]
    PAGE_SIZE: int | None


api_settings: _APISettings
