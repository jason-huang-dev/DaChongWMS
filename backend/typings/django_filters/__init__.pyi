from __future__ import annotations

from typing import Any


class Filter:
    def __init__(self, *args: Any, **kwargs: Any) -> None: ...


class CharFilter(Filter):
    pass


class FilterSet:
    def __init__(self, *args: Any, **kwargs: Any) -> None: ...
