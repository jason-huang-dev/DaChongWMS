"""WSGI entrypoint for the DaChongWMS project.

This module provides the synchronous `application` object consumed by
WSGI-compatible servers such as Gunicorn or uWSGI, ensuring Django is
configured with the project's settings before serving HTTP requests.
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "dachong_wms.settings")

application = get_wsgi_application()
