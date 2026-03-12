"""ASGI entrypoint for the DaChongWMS project.

The `application` object defined here is discovered by ASGI servers such as
Uvicorn or Daphne. It simply initializes Django using the project's settings
and exposes the callable so async web servers can hand incoming requests to it.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "dachong_wms.settings")

application = get_asgi_application()
