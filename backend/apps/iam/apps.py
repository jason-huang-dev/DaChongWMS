from django.apps import AppConfig


class IamConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.iam"
    label = "iam"
    verbose_name = "IAM"

    def ready(self) -> None:
        from . import signals  # noqa: F401
