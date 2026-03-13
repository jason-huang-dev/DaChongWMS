from django.db import models


class ListModel(models.Model):
    capital_name = models.CharField(max_length=255, unique=True, verbose_name="Capital Name")
    capital_qty = models.FloatField(default=0, verbose_name="Capital Quantity")
    capital_cost = models.FloatField(default=0, verbose_name="Capital Cost")
    creator = models.CharField(max_length=255, default="system", verbose_name="Created By")
    openid = models.CharField(max_length=255, verbose_name="Openid")
    is_delete = models.BooleanField(default=False, verbose_name="Delete Label")
    create_time = models.DateTimeField(auto_now_add=True, verbose_name="Create Time")
    update_time = models.DateTimeField(auto_now=True, verbose_name="Update Time")

    class Meta:
        db_table = 'capital'
        verbose_name = 'Capital'
        verbose_name_plural = 'Capitals'

    def __str__(self) -> str:  # pragma: no cover
        return self.capital_name
