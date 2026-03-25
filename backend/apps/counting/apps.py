from django.apps import AppConfig


class CountingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.counting"
    label = "counting"
    verbose_name = "Counting"

