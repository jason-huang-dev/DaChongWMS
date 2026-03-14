from django.apps import AppConfig


class TestSystemConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "test_system"
    verbose_name = "Test System"
