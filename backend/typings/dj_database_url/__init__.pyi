from __future__ import annotations

from typing import Any, Dict, Optional


def config(
    default: Optional[str] = ...,
    env: str = ...,
    engine: Optional[str] = ...,
    conn_max_age: Optional[int] = ...,
    ssl_require: bool = ...,
    **kwargs: Any,
) -> Dict[str, Any]: ...
