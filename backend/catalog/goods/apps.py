from django.apps import AppConfig


class GoodsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "catalog.goods"
    label = "goods"
    verbose_name = "Goods Catalog"
