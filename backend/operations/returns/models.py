"""Customer return receipt and disposition models."""

from __future__ import annotations

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import F, Q
from django.utils import timezone

from inventory.models import InventoryMovement, InventoryStatus


class TenantAuditModel(models.Model):
    creator = models.CharField(max_length=255, default="system", verbose_name="Created By")
    openid = models.CharField(max_length=255, verbose_name="Openid", db_index=True)
    is_delete = models.BooleanField(default=False, verbose_name="Delete Label")
    create_time = models.DateTimeField(auto_now_add=True, verbose_name="Create Time")
    update_time = models.DateTimeField(auto_now=True, verbose_name="Update Time")

    class Meta:
        abstract = True


class ReturnOrderStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    PARTIAL_RECEIVED = "PARTIAL_RECEIVED", "Partial Received"
    RECEIVED = "RECEIVED", "Received"
    PARTIAL_DISPOSED = "PARTIAL_DISPOSED", "Partial Disposed"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class ReturnLineStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    PARTIAL_RECEIVED = "PARTIAL_RECEIVED", "Partial Received"
    RECEIVED = "RECEIVED", "Received"
    PARTIAL_DISPOSED = "PARTIAL_DISPOSED", "Partial Disposed"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class ReturnDispositionType(models.TextChoices):
    RESTOCK = "RESTOCK", "Restock"
    QUARANTINE = "QUARANTINE", "Quarantine"
    SCRAP = "SCRAP", "Scrap"


class ReturnOrder(TenantAuditModel):
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="return_orders",
        verbose_name="Warehouse",
    )
    customer = models.ForeignKey(
        "customer.ListModel",
        on_delete=models.PROTECT,
        related_name="return_orders",
        verbose_name="Customer",
    )
    sales_order = models.ForeignKey(
        "outbound.SalesOrder",
        on_delete=models.PROTECT,
        related_name="return_orders",
        blank=True,
        null=True,
        verbose_name="Sales Order",
    )
    return_number = models.CharField(max_length=64, verbose_name="Return Number")
    requested_date = models.DateField(blank=True, null=True, verbose_name="Requested Date")
    reference_code = models.CharField(max_length=64, blank=True, default="", verbose_name="Reference Code")
    status = models.CharField(
        max_length=32,
        choices=ReturnOrderStatus.choices,
        default=ReturnOrderStatus.OPEN,
        verbose_name="Status",
    )
    notes = models.TextField(blank=True, default="", verbose_name="Notes")

    class Meta:
        db_table = "returns_return_order"
        verbose_name = "Return Order"
        verbose_name_plural = "Return Orders"
        ordering = ["-create_time", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "return_number"],
                condition=Q(is_delete=False),
                name="returns_return_order_number_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.return_number


class ReturnLine(TenantAuditModel):
    return_order = models.ForeignKey(
        ReturnOrder,
        on_delete=models.PROTECT,
        related_name="lines",
        verbose_name="Return Order",
    )
    line_number = models.PositiveIntegerField(verbose_name="Line Number")
    goods = models.ForeignKey(
        "goods.ListModel",
        on_delete=models.PROTECT,
        related_name="return_lines",
        verbose_name="Goods",
    )
    expected_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        verbose_name="Expected Qty",
    )
    received_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Received Qty",
    )
    disposed_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Disposed Qty",
    )
    status = models.CharField(
        max_length=32,
        choices=ReturnLineStatus.choices,
        default=ReturnLineStatus.OPEN,
        verbose_name="Status",
    )
    return_reason = models.CharField(max_length=255, blank=True, default="", verbose_name="Return Reason")
    notes = models.TextField(blank=True, default="", verbose_name="Notes")

    class Meta:
        db_table = "returns_return_line"
        verbose_name = "Return Line"
        verbose_name_plural = "Return Lines"
        ordering = ["return_order_id", "line_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["return_order", "line_number"],
                condition=Q(is_delete=False),
                name="returns_return_line_number_uq",
            ),
            models.CheckConstraint(
                condition=Q(expected_qty__gte=F("received_qty")),
                name="returns_expected_gte_received",
            ),
            models.CheckConstraint(
                condition=Q(received_qty__gte=F("disposed_qty")),
                name="returns_received_gte_disposed",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.return_order.return_number}#{self.line_number}"


class ReturnReceipt(TenantAuditModel):
    return_line = models.ForeignKey(
        ReturnLine,
        on_delete=models.PROTECT,
        related_name="receipts",
        verbose_name="Return Line",
    )
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="return_receipts",
        verbose_name="Warehouse",
    )
    receipt_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.PROTECT,
        related_name="return_receipts",
        verbose_name="Receipt Location",
    )
    receipt_number = models.CharField(max_length=64, verbose_name="Receipt Number")
    received_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        verbose_name="Received Qty",
    )
    stock_status = models.CharField(
        max_length=32,
        choices=InventoryStatus.choices,
        default=InventoryStatus.QUARANTINE,
        verbose_name="Stock Status",
    )
    lot_number = models.CharField(max_length=64, blank=True, default="", verbose_name="Lot Number")
    serial_number = models.CharField(max_length=64, blank=True, default="", verbose_name="Serial Number")
    notes = models.TextField(blank=True, default="", verbose_name="Notes")
    received_by = models.CharField(max_length=255, verbose_name="Received By")
    received_at = models.DateTimeField(default=timezone.now, verbose_name="Received At")
    inventory_movement = models.ForeignKey(
        InventoryMovement,
        on_delete=models.PROTECT,
        related_name="return_receipts",
        blank=True,
        null=True,
        verbose_name="Inventory Movement",
    )

    class Meta:
        db_table = "returns_return_receipt"
        verbose_name = "Return Receipt"
        verbose_name_plural = "Return Receipts"
        ordering = ["-received_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "receipt_number"],
                condition=Q(is_delete=False),
                name="returns_receipt_number_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.receipt_number


class ReturnDisposition(TenantAuditModel):
    return_receipt = models.ForeignKey(
        ReturnReceipt,
        on_delete=models.PROTECT,
        related_name="dispositions",
        verbose_name="Return Receipt",
    )
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="return_dispositions",
        verbose_name="Warehouse",
    )
    disposition_number = models.CharField(max_length=64, verbose_name="Disposition Number")
    disposition_type = models.CharField(
        max_length=32,
        choices=ReturnDispositionType.choices,
        verbose_name="Disposition Type",
    )
    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        verbose_name="Quantity",
    )
    to_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.PROTECT,
        related_name="return_dispositions",
        blank=True,
        null=True,
        verbose_name="To Location",
    )
    notes = models.TextField(blank=True, default="", verbose_name="Notes")
    completed_by = models.CharField(max_length=255, verbose_name="Completed By")
    completed_at = models.DateTimeField(default=timezone.now, verbose_name="Completed At")
    inventory_movement = models.ForeignKey(
        InventoryMovement,
        on_delete=models.PROTECT,
        related_name="return_dispositions",
        blank=True,
        null=True,
        verbose_name="Inventory Movement",
    )

    class Meta:
        db_table = "returns_return_disposition"
        verbose_name = "Return Disposition"
        verbose_name_plural = "Return Dispositions"
        ordering = ["-completed_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "disposition_number"],
                condition=Q(is_delete=False),
                name="returns_disposition_number_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.disposition_number
