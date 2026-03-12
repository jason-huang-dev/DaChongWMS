"""MD5 helpers maintained for backwards compatibility."""

from __future__ import annotations

import datetime
import hashlib


class Md5:
    """Namespace wrapper replicating the legacy static method signature."""

    @staticmethod
    def md5(value: str) -> str:
        digest = hashlib.md5(value.encode("utf-8"))
        digest.update(str(datetime.datetime.now()).encode("utf-8"))
        return digest.hexdigest()
