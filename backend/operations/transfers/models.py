"""Transfer and replenishment models."""

from __future__ import annotations

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import F, Q
from django.utils import timezone

from inventory.models import InventoryBalance, InventoryMovement, InventoryStatus


class TenantAuditModel(models.Model):
    creator = models.CharField(max_length=255, default="system", verbose_name="Created By")
    openid = models.CharField(max_length=255, verbose_name="Openid", db_index=True)
    is_delete = models.BooleanField(default=False, verbose_name="Delete Label")
    create_time = models.DateTimeField(auto_now_add=True, verbose_name="Create Time")
    update_time = models.DateTimeField(auto_now=True, verbose_name="Update Time")

    class Meta:
        abstract = True


class TransferOrderStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    IN_PROGRESS = "IN_PROGRESS", "In Progress"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class TransferLineStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class ReplenishmentTaskStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    ASSIGNED = "ASSIGNED", "Assigned"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class TransferOrder(TenantAuditModel):
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="transfer_orders",
        verbose_name="Warehouse",
    )
    transfer_number = models.CharField(max_length=64, verbose_name="Transfer Number")
    requested_date = models.DateField(blank=True, null=True, verbose_name="Requested Date")
    reference_code = models.CharField(max_length=64, blank=True, default="", verbose_name="Reference Code")
    status = models.CharField(
        max_length=32,
        choices=TransferOrderStatus.choices,
        default=TransferOrderStatus.OPEN,
        verbose_name="Status",
    )
    notes = models.TextField(blank=True, default="", verbose_name="Notes")

    class Meta:
        db_table = "transfers_transfer_order"
        verbose_name = "Transfer Order"
        verbose_name_plural = "Transfer Orders"
        ordering = ["-create_time", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "transfer_number"],
                condition=Q(is_delete=False),
                name="transfers_transfer_order_number_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.transfer_number


class TransferLine(TenantAuditModel):
    transfer_order = models.ForeignKey(
        TransferOrder,
        on_delete=models.PROTECT,
        related_name="lines",
        verbose_name="Transfer Order",
    )
    line_number = models.PositiveIntegerField(verbose_name="Line Number")
    goods = models.ForeignKey(
        "goods.ListModel",
        on_delete=models.PROTECT,
        related_name="transfer_lines",
        verbose_name="Goods",
    )
    from_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.PROTECT,
        related_name="transfer_lines_from",
        verbose_name="From Location",
    )
    to_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.PROTECT,
        related_name="transfer_lines_to",
        verbose_name="To Location",
    )
    requested_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        verbose_name="Requested Qty",
    )
    moved_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Moved Qty",
    )
    stock_status = models.CharField(
        max_length=32,
        choices=InventoryStatus.choices,
        default=InventoryStatus.AVAILABLE,
        verbose_name="Stock Status",
    )
    lot_number = models.CharField(max_length=64, blank=True, default="", verbose_name="Lot Number")
    serial_number = models.CharField(max_length=64, blank=True, default="", verbose_name="Serial Number")
    status = models.CharField(
        max_length=32,
        choices=TransferLineStatus.choices,
        default=TransferLineStatus.OPEN,
        verbose_name="Status",
    )
    assigned_to = models.ForeignKey(
        "staff.ListModel",
        on_delete=models.PROTECT,
        related_name="transfer_lines",
        blank=True,
        null=True,
        verbose_name="Assigned To",
    )
    completed_by = models.CharField(max_length=255, blank=True, default="", verbose_name="Completed By")
    completed_at = models.DateTimeField(blank=True, null=True, verbose_name="Completed At")
    inventory_movement = models.ForeignKey(
        InventoryMovement,
        on_delete=models.PROTECT,
        related_name="transfer_lines",
        blank=True,
        null=True,
        verbose_name="Inventory Movement",
    )
    notes = models.TextField(blank=True, default="", verbose_name="Notes")

    class Meta:
        db_table = "transfers_transfer_line"
        verbose_name = "Transfer Line"
        verbose_name_plural = "Transfer Lines"
        ordering = ["transfer_order_id", "line_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["transfer_order", "line_number"],
                condition=Q(is_delete=False),
                name="transfers_transfer_line_number_uq",
            ),
            models.CheckConstraint(
                condition=Q(requested_qty__gte=F("moved_qty")),
                name="transfers_transfer_requested_gte_moved",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.transfer_order.transfer_number}#{self.line_number}"


class ReplenishmentRule(TenantAuditModel):
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="replenishment_rules",
        verbose_name="Warehouse",
    )
    goods = models.ForeignKey(
        "goods.ListModel",
        on_delete=models.PROTECT,
        related_name="replenishment_rules",
        verbose_name="Goods",
    )
    source_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.PROTECT,
        related_name="replenishment_rules_source",
        verbose_name="Source Location",
    )
    target_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.PROTECT,
        related_name="replenishment_rules_target",
        verbose_name="Target Location",
    )
    minimum_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Minimum Qty",
    )
    target_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        verbose_name="Target Qty",
    )
    stock_status = models.CharField(
        max_length=32,
        choices=InventoryStatus.choices,
        default=InventoryStatus.AVAILABLE,
        verbose_name="Stock Status",
    )
    priority = models.PositiveIntegerField(default=100, verbose_name="Priority")
    is_active = models.BooleanField(default=True, verbose_name="Is Active")
    notes = models.TextField(blank=True, default="", verbose_name="Notes")

    class Meta:
        db_table = "transfers_replenishment_rule"
        verbose_name = "Replenishment Rule"
        verbose_name_plural = "Replenishment Rules"
        ordering = ["priority", "warehouse_id", "target_location_id", "goods_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "warehouse", "goods", "source_location", "target_location", "stock_status"],
                condition=Q(is_delete=False),
                name="transfers_replenishment_rule_uq",
            ),
            models.CheckConstraint(
                condition=Q(target_qty__gt=F("minimum_qty")),
                name="transfers_replenishment_target_gt_min",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.goods.goods_code} {self.source_location.location_code}->{self.target_location.location_code}"


class ReplenishmentTask(TenantAuditModel):
    replenishment_rule = models.ForeignKey(
        ReplenishmentRule,
        on_delete=models.PROTECT,
        related_name="tasks",
        blank=True,
        null=True,
        verbose_name="Replenishment Rule",
    )
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="replenishment_tasks",
        verbose_name="Warehouse",
    )
    source_balance = models.ForeignKey(
        InventoryBalance,
        on_delete=models.PROTECT,
        related_name="replenishment_tasks",
        verbose_name="Source Balance",
    )
    goods = models.ForeignKey(
        "goods.ListModel",
        on_delete=models.PROTECT,
        related_name="replenishment_tasks",
        verbose_name="Goods",
    )
    task_number = models.CharField(max_length=64, verbose_name="Task Number")
    from_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.PROTECT,
        related_name="replenishment_tasks_from",
        verbose_name="From Location",
    )
    to_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.PROTECT,
        related_name="replenishment_tasks_to",
        verbose_name="To Location",
    )
    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        verbose_name="Quantity",
    )
    priority = models.PositiveIntegerField(default=100, verbose_name="Priority")
    stock_status = models.CharField(
        max_length=32,
        choices=InventoryStatus.choices,
        default=InventoryStatus.AVAILABLE,
        verbose_name="Stock Status",
    )
    lot_number = models.CharField(max_length=64, blank=True, default="", verbose_name="Lot Number")
    serial_number = models.CharField(max_length=64, blank=True, default="", verbose_name="Serial Number")
    status = models.CharField(
        max_length=32,
        choices=ReplenishmentTaskStatus.choices,
        default=ReplenishmentTaskStatus.OPEN,
        verbose_name="Status",
    )
    assigned_to = models.ForeignKey(
        "staff.ListModel",
        on_delete=models.PROTECT,
        related_name="replenishment_tasks",
        blank=True,
        null=True,
        verbose_name="Assigned To",
    )
    completed_by = models.CharField(max_length=255, blank=True, default="", verbose_name="Completed By")
    completed_at = models.DateTimeField(blank=True, null=True, verbose_name="Completed At")
    inventory_movement = models.ForeignKey(
        InventoryMovement,
        on_delete=models.PROTECT,
        related_name="replenishment_tasks",
        blank=True,
        null=True,
        verbose_name="Inventory Movement",
    )
    notes = models.TextField(blank=True, default="", verbose_name="Notes")
    generated_at = models.DateTimeField(default=timezone.now, verbose_name="Generated At")

    class Meta:
        db_table = "transfers_replenishment_task"
        verbose_name = "Replenishment Task"
        verbose_name_plural = "Replenishment Tasks"
        ordering = ["status", "priority", "generated_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "task_number"],
                condition=Q(is_delete=False),
                name="transfers_replenishment_task_number_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.task_number
