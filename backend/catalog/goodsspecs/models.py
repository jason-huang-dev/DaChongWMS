from django.db import models


class ListModel(models.Model):
    goods_specs = models.CharField(max_length=255, unique=True, verbose_name="Goods Specs")
    creator = models.CharField(max_length=255, default="system", verbose_name="Created By")
    openid = models.CharField(max_length=255, verbose_name="Openid")
    is_delete = models.BooleanField(default=False, verbose_name="Delete Label")
    create_time = models.DateTimeField(auto_now_add=True, verbose_name="Create Time")
    update_time = models.DateTimeField(auto_now=True, verbose_name="Update Time")

    class Meta:
        db_table = 'goodsspecs'
        verbose_name = 'Goods Specs'
        verbose_name_plural = 'Goods Specs'

    def __str__(self) -> str:  # pragma: no cover
        return self.goods_specs
