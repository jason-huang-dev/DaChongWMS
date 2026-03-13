from django.db import models


class ListModel(models.Model):
    supplier_name = models.CharField(max_length=255, verbose_name="Supplier Name")
    supplier_city = models.CharField(max_length=255, verbose_name="Supplier City")
    supplier_address = models.CharField(max_length=255, verbose_name="Supplier Address")
    supplier_contact = models.CharField(max_length=255, verbose_name="Supplier Contact")
    supplier_manager = models.CharField(max_length=255, verbose_name="Supplier Manager")
    supplier_level = models.IntegerField(default=0, verbose_name="Supplier Level")
    creator = models.CharField(max_length=255, default="system", verbose_name="Created By")
    openid = models.CharField(max_length=255, verbose_name="Openid")
    is_delete = models.BooleanField(default=False, verbose_name="Delete Label")
    create_time = models.DateTimeField(auto_now_add=True, verbose_name="Create Time")
    update_time = models.DateTimeField(auto_now=True, verbose_name="Update Time")

    class Meta:
        db_table = 'supplier'
        verbose_name = 'Supplier'
        verbose_name_plural = 'Suppliers'

    def __str__(self) -> str:  # pragma: no cover
        return self.supplier_name
