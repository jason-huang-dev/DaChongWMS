from django.db import models


class OperationOrderType(models.TextChoices):
    STANDARD = "STANDARD", "Standard"
    B2B = "B2B", "B2B"
    DROPSHIP = "DROPSHIP", "Dropshipping"
