from __future__ import annotations

from typing import Any, Mapping

from .response import Response


def exception_handler(exc: Exception, context: Mapping[str, Any]) -> Response | None: ...
