from __future__ import annotations

from typing import Any, Mapping

from .request import Request
from .response import Response


class APIView:
    request: Request

    @classmethod
    def as_view(cls, **initkwargs: Any) -> Any: ...


def exception_handler(exc: Exception, context: Mapping[str, Any]) -> Response | None: ...
