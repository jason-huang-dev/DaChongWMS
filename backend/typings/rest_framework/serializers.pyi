from __future__ import annotations

from typing import Any, Iterable, Mapping, Sequence


class Field:
    def __init__(self, *args: Any, **kwargs: Any) -> None: ...


class Serializer(Field):
    data: Any
    errors: Any
    validated_data: Mapping[str, Any]

    def __init__(self, instance: Any = ..., data: Any = ..., many: bool = ..., **kwargs: Any) -> None: ...

    def is_valid(self, *, raise_exception: bool = ...) -> bool: ...

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


class IntegerField(Field):
    def __init__(self, *, min_value: int | None = ..., max_value: int | None = ..., **kwargs: Any) -> None: ...


class BooleanField(Field):
    def __init__(self, *, default: bool | None = ..., **kwargs: Any) -> None: ...


class ChoiceField(Field):
    def __init__(self, choices: Iterable[Any], **kwargs: Any) -> None: ...


class ListField(Field):
    def __init__(self, child: Field | None = ..., **kwargs: Any) -> None: ...


class JSONField(Field):
    def __init__(self, **kwargs: Any) -> None: ...


class EmailField(CharField):
    pass


class ValidationError(Exception):
    def __init__(self, detail: Any = ..., code: Any = ...) -> None: ...
