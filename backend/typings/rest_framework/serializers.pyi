from __future__ import annotations

from typing import Any, Iterable, Mapping, Sequence


class Field:
    def __init__(self, *args: Any, **kwargs: Any) -> None: ...


class Serializer(Field):
    data: Any
    validated_data: Mapping[str, Any]

    def save(self, **kwargs: Any) -> Any: ...


class ModelSerializer(Serializer):
    Meta: type[Any]


class DateTimeField(Field):
    def __init__(
        self,
        *,
        read_only: bool = ...,
        format: str | None = ...,
        input_formats: Sequence[str] | None = ...,
        default_timezone: Any = ...,
        **kwargs: Any,
    ) -> None: ...


class CharField(Field):
    def __init__(
        self,
        *,
        max_length: int | None = ...,
        min_length: int | None = ...,
        validators: Sequence[Any] | None = ...,
        trim_whitespace: bool = ...,
        **kwargs: Any,
    ) -> None: ...
