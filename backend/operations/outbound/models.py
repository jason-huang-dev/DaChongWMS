"""Outbound sales, picking, and shipment models."""

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


class SalesOrderStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    ALLOCATED = "ALLOCATED", "Allocated"
    PICKING = "PICKING", "Picking"
    PICKED = "PICKED", "Picked"
    SHIPPED = "SHIPPED", "Shipped"
    CANCELLED = "CANCELLED", "Cancelled"


class SalesOrderLineStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    ALLOCATED = "ALLOCATED", "Allocated"
    PARTIAL = "PARTIAL", "Partial"
    PICKED = "PICKED", "Picked"
    SHIPPED = "SHIPPED", "Shipped"
    CANCELLED = "CANCELLED", "Cancelled"


class PickTaskStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    ASSIGNED = "ASSIGNED", "Assigned"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class ShipmentStatus(models.TextChoices):
    POSTED = "POSTED", "Posted"
    CANCELLED = "CANCELLED", "Cancelled"


class DockLoadVerificationStatus(models.TextChoices):
    VERIFIED = "VERIFIED", "Verified"
    REJECTED = "REJECTED", "Rejected"


class SalesOrder(TenantAuditModel):
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="sales_orders",
        verbose_name="Warehouse",
    )
    customer = models.ForeignKey(
        "customer.ListModel",
        on_delete=models.PROTECT,
        related_name="sales_orders",
        verbose_name="Customer",
    )
    staging_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.PROTECT,
        related_name="sales_orders",
        verbose_name="Staging Location",
    )
    order_number = models.CharField(max_length=64, verbose_name="Sales Order Number")
    requested_ship_date = models.DateField(blank=True, null=True, verbose_name="Requested Ship Date")
    reference_code = models.CharField(max_length=64, blank=True, default="", verbose_name="Reference Code")
    status = models.CharField(
        max_length=32,
        choices=SalesOrderStatus.choices,
        default=SalesOrderStatus.OPEN,
        verbose_name="Status",
    )
    notes = models.TextField(blank=True, default="", verbose_name="Notes")

    class Meta:
        db_table = "outbound_sales_order"
        verbose_name = "Sales Order"
        verbose_name_plural = "Sales Orders"
        ordering = ["-create_time", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "order_number"],
                condition=Q(is_delete=False),
                name="outbound_sales_order_number_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.order_number


class SalesOrderLine(TenantAuditModel):
    sales_order = models.ForeignKey(
        SalesOrder,
        on_delete=models.PROTECT,
        related_name="lines",
        verbose_name="Sales Order",
    )
    line_number = models.PositiveIntegerField(verbose_name="Line Number")
    goods = models.ForeignKey(
        "goods.ListModel",
        on_delete=models.PROTECT,
        related_name="sales_order_lines",
        verbose_name="Goods",
    )
    ordered_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        verbose_name="Ordered Qty",
    )
    allocated_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Allocated Qty",
    )
    picked_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Picked Qty",
    )
    shipped_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Shipped Qty",
    )
    unit_price = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Unit Price",
    )
    stock_status = models.CharField(
        max_length=32,
        choices=InventoryStatus.choices,
        default=InventoryStatus.AVAILABLE,
        verbose_name="Stock Status",
    )
    status = models.CharField(
        max_length=32,
        choices=SalesOrderLineStatus.choices,
        default=SalesOrderLineStatus.OPEN,
        verbose_name="Status",
    )

    class Meta:
        db_table = "outbound_sales_order_line"
        verbose_name = "Sales Order Line"
        verbose_name_plural = "Sales Order Lines"
        ordering = ["sales_order_id", "line_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["sales_order", "line_number"],
                condition=Q(is_delete=False),
                name="outbound_sales_order_line_number_uq",
            ),
            models.CheckConstraint(
                condition=Q(ordered_qty__gte=F("allocated_qty") + F("picked_qty") + F("shipped_qty")),
                name="outbound_sales_order_progress_lte_ordered",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.sales_order.order_number}#{self.line_number}"


class PickTask(TenantAuditModel):
    sales_order_line = models.ForeignKey(
        SalesOrderLine,
        on_delete=models.PROTECT,
        related_name="pick_tasks",
        verbose_name="Sales Order Line",
    )
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="pick_tasks",
        verbose_name="Warehouse",
    )
    goods = models.ForeignKey(
        "goods.ListModel",
        on_delete=models.PROTECT,
        related_name="pick_tasks",
        verbose_name="Goods",
    )
    task_number = models.CharField(max_length=64, verbose_name="Task Number")
    from_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.PROTECT,
        related_name="pick_tasks_from",
        verbose_name="From Location",
    )
    to_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.PROTECT,
        related_name="pick_tasks_to",
        verbose_name="To Location",
    )
    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        verbose_name="Quantity",
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
        choices=PickTaskStatus.choices,
        default=PickTaskStatus.OPEN,
        verbose_name="Status",
    )
    assigned_to = models.ForeignKey(
        "staff.ListModel",
        on_delete=models.PROTECT,
        related_name="pick_tasks",
        blank=True,
        null=True,
        verbose_name="Assigned To",
    )
    completed_by = models.CharField(max_length=255, blank=True, default="", verbose_name="Completed By")
    completed_at = models.DateTimeField(blank=True, null=True, verbose_name="Completed At")
    inventory_movement = models.ForeignKey(
        InventoryMovement,
        on_delete=models.PROTECT,
        related_name="outbound_pick_tasks",
        blank=True,
        null=True,
        verbose_name="Inventory Movement",
    )
    license_plate = models.ForeignKey(
        "scanner.LicensePlate",
        on_delete=models.PROTECT,
        related_name="pick_tasks",
        blank=True,
        null=True,
        verbose_name="License Plate",
    )
    notes = models.TextField(blank=True, default="", verbose_name="Notes")

    class Meta:
        db_table = "outbound_pick_task"
        verbose_name = "Pick Task"
        verbose_name_plural = "Pick Tasks"
        ordering = ["status", "create_time", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "task_number"],
                condition=Q(is_delete=False),
                name="outbound_pick_task_number_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.task_number


class Shipment(TenantAuditModel):
    sales_order = models.ForeignKey(
        SalesOrder,
        on_delete=models.PROTECT,
        related_name="shipments",
        verbose_name="Sales Order",
    )
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="shipments",
        verbose_name="Warehouse",
    )
    staging_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.PROTECT,
        related_name="shipments",
        verbose_name="Staging Location",
    )
    shipment_number = models.CharField(max_length=64, verbose_name="Shipment Number")
    status = models.CharField(
        max_length=32,
        choices=ShipmentStatus.choices,
        default=ShipmentStatus.POSTED,
        verbose_name="Status",
    )
    reference_code = models.CharField(max_length=64, blank=True, default="", verbose_name="Reference Code")
    notes = models.TextField(blank=True, default="", verbose_name="Notes")
    shipped_by = models.CharField(max_length=255, verbose_name="Shipped By")
    shipped_at = models.DateTimeField(default=timezone.now, verbose_name="Shipped At")

    class Meta:
        db_table = "outbound_shipment"
        verbose_name = "Shipment"
        verbose_name_plural = "Shipments"
        ordering = ["-shipped_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "shipment_number"],
                condition=Q(is_delete=False),
                name="outbound_shipment_number_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.shipment_number


class ShipmentLine(TenantAuditModel):
    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.PROTECT,
        related_name="lines",
        verbose_name="Shipment",
    )
    sales_order_line = models.ForeignKey(
        SalesOrderLine,
        on_delete=models.PROTECT,
        related_name="shipment_lines",
        verbose_name="Sales Order Line",
    )
    goods = models.ForeignKey(
        "goods.ListModel",
        on_delete=models.PROTECT,
        related_name="shipment_lines",
        verbose_name="Goods",
    )
    from_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.PROTECT,
        related_name="shipment_lines",
        verbose_name="From Location",
    )
    shipped_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        verbose_name="Shipped Qty",
    )
    stock_status = models.CharField(
        max_length=32,
        choices=InventoryStatus.choices,
        default=InventoryStatus.AVAILABLE,
        verbose_name="Stock Status",
    )
    lot_number = models.CharField(max_length=64, blank=True, default="", verbose_name="Lot Number")
    serial_number = models.CharField(max_length=64, blank=True, default="", verbose_name="Serial Number")
    inventory_movement = models.ForeignKey(
        InventoryMovement,
        on_delete=models.PROTECT,
        related_name="shipment_lines",
        blank=True,
        null=True,
        verbose_name="Inventory Movement",
    )
    license_plate = models.ForeignKey(
        "scanner.LicensePlate",
        on_delete=models.PROTECT,
        related_name="shipment_lines",
        blank=True,
        null=True,
        verbose_name="License Plate",
    )

    class Meta:
        db_table = "outbound_shipment_line"
        verbose_name = "Shipment Line"
        verbose_name_plural = "Shipment Lines"
        ordering = ["shipment_id", "id"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.shipment.shipment_number}:{self.goods.goods_code}"


class DockLoadVerification(TenantAuditModel):
    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.PROTECT,
        related_name="dock_load_verifications",
        verbose_name="Shipment",
    )
    shipment_line = models.ForeignKey(
        ShipmentLine,
        on_delete=models.PROTECT,
        related_name="dock_load_verifications",
        blank=True,
        null=True,
        verbose_name="Shipment Line",
    )
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="dock_load_verifications",
        verbose_name="Warehouse",
    )
    dock_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.PROTECT,
        related_name="dock_load_verifications",
        verbose_name="Dock Location",
    )
    goods = models.ForeignKey(
        "goods.ListModel",
        on_delete=models.PROTECT,
        related_name="dock_load_verifications",
        verbose_name="Goods",
    )
    license_plate = models.ForeignKey(
        "scanner.LicensePlate",
        on_delete=models.PROTECT,
        related_name="dock_load_verifications",
        blank=True,
        null=True,
        verbose_name="License Plate",
    )
    verified_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        verbose_name="Verified Qty",
    )
    status = models.CharField(
        max_length=16,
        choices=DockLoadVerificationStatus.choices,
        default=DockLoadVerificationStatus.VERIFIED,
        verbose_name="Status",
    )
    trailer_reference = models.CharField(max_length=128, blank=True, default="", verbose_name="Trailer Reference")
    verified_by = models.CharField(max_length=255, verbose_name="Verified By")
    verified_at = models.DateTimeField(default=timezone.now, verbose_name="Verified At")
    notes = models.TextField(blank=True, default="", verbose_name="Notes")

    class Meta:
        db_table = "outbound_dock_load_verification"
        verbose_name = "Dock Load Verification"
        verbose_name_plural = "Dock Load Verifications"
        ordering = ["-verified_at", "-id"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.shipment.shipment_number}:{self.goods.goods_code}:{self.verified_qty}"
