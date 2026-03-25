from __future__ import annotations

from typing import Any


class BaseParser:
    media_type: str

    def parse(self, stream: Any, media_type: str | None = ..., parser_context: Any = ...) -> Any: ...


class FormParser(BaseParser):
    pass


class MultiPartParser(BaseParser):
    pass
