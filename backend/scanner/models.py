from django.db import models


class ListModel(models.Model):
    mode = models.CharField(max_length=255, verbose_name="Mode")
    code = models.TextField(verbose_name="Code")
    bar_code = models.CharField(max_length=255, verbose_name="Bar Code")
    openid = models.CharField(max_length=255, verbose_name="Openid")
    is_delete = models.BooleanField(default=False, verbose_name="Delete Label")
    create_time = models.DateTimeField(auto_now_add=True, verbose_name="Create Time")
    update_time = models.DateTimeField(auto_now=True, verbose_name="Update Time")

    class Meta:
        ordering = ['-id']
        db_table = 'scanner'
        verbose_name = 'Scanner'
        verbose_name_plural = 'Scanners'

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.mode}:{self.code}"
