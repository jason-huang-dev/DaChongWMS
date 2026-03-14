"""Inbound purchasing, receipt, and putaway models."""

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


class PurchaseOrderStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    PARTIAL = "PARTIAL", "Partial"
    CLOSED = "CLOSED", "Closed"
    CANCELLED = "CANCELLED", "Cancelled"


class PurchaseOrderLineStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    PARTIAL = "PARTIAL", "Partial"
    CLOSED = "CLOSED", "Closed"
    CANCELLED = "CANCELLED", "Cancelled"


class ReceiptStatus(models.TextChoices):
    POSTED = "POSTED", "Posted"
    CANCELLED = "CANCELLED", "Cancelled"


class PutawayTaskStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    ASSIGNED = "ASSIGNED", "Assigned"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class AdvanceShipmentNoticeStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    PARTIAL = "PARTIAL", "Partial"
    RECEIVED = "RECEIVED", "Received"
    CANCELLED = "CANCELLED", "Cancelled"


class PurchaseOrder(TenantAuditModel):
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="purchase_orders",
        verbose_name="Warehouse",
    )
    supplier = models.ForeignKey(
        "supplier.ListModel",
        on_delete=models.PROTECT,
        related_name="purchase_orders",
        verbose_name="Supplier",
    )
    po_number = models.CharField(max_length=64, verbose_name="Purchase Order Number")
    expected_arrival_date = models.DateField(blank=True, null=True, verbose_name="Expected Arrival Date")
    reference_code = models.CharField(max_length=64, blank=True, default="", verbose_name="Reference Code")
    status = models.CharField(
        max_length=32,
        choices=PurchaseOrderStatus.choices,
        default=PurchaseOrderStatus.OPEN,
        verbose_name="Status",
    )
    notes = models.TextField(blank=True, default="", verbose_name="Notes")

    class Meta:
        db_table = "inbound_purchase_order"
        verbose_name = "Purchase Order"
        verbose_name_plural = "Purchase Orders"
        ordering = ["-create_time", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "po_number"],
                condition=Q(is_delete=False),
                name="inbound_po_number_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.po_number


class AdvanceShipmentNotice(TenantAuditModel):
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.PROTECT,
        related_name="advance_shipment_notices",
        verbose_name="Purchase Order",
    )
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="advance_shipment_notices",
        verbose_name="Warehouse",
    )
    supplier = models.ForeignKey(
        "supplier.ListModel",
        on_delete=models.PROTECT,
        related_name="advance_shipment_notices",
        verbose_name="Supplier",
    )
    asn_number = models.CharField(max_length=64, verbose_name="ASN Number")
    expected_arrival_date = models.DateField(blank=True, null=True, verbose_name="Expected Arrival Date")
    status = models.CharField(
        max_length=32,
        choices=AdvanceShipmentNoticeStatus.choices,
        default=AdvanceShipmentNoticeStatus.OPEN,
        verbose_name="Status",
    )
    reference_code = models.CharField(max_length=64, blank=True, default="", verbose_name="Reference Code")
    notes = models.TextField(blank=True, default="", verbose_name="Notes")

    class Meta:
        db_table = "inbound_advance_shipment_notice"
        verbose_name = "Advance Shipment Notice"
        verbose_name_plural = "Advance Shipment Notices"
        ordering = ["-create_time", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "asn_number"],
                condition=Q(is_delete=False),
                name="inbound_asn_number_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.asn_number


class AdvanceShipmentNoticeLine(TenantAuditModel):
    asn = models.ForeignKey(
        AdvanceShipmentNotice,
        on_delete=models.PROTECT,
        related_name="lines",
        verbose_name="Advance Shipment Notice",
    )
    line_number = models.PositiveIntegerField(verbose_name="Line Number")
    purchase_order_line = models.ForeignKey(
        "inbound.PurchaseOrderLine",
        on_delete=models.PROTECT,
        related_name="asn_lines",
        blank=True,
        null=True,
        verbose_name="Purchase Order Line",
    )
    goods = models.ForeignKey(
        "goods.ListModel",
        on_delete=models.PROTECT,
        related_name="asn_lines",
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
    stock_status = models.CharField(
        max_length=32,
        choices=InventoryStatus.choices,
        default=InventoryStatus.AVAILABLE,
        verbose_name="Stock Status",
    )
    expected_lpn_code = models.CharField(max_length=128, blank=True, default="", verbose_name="Expected LPN Code")
    notes = models.TextField(blank=True, default="", verbose_name="Notes")

    class Meta:
        db_table = "inbound_advance_shipment_notice_line"
        verbose_name = "Advance Shipment Notice Line"
        verbose_name_plural = "Advance Shipment Notice Lines"
        ordering = ["asn_id", "line_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["asn", "line_number"],
                condition=Q(is_delete=False),
                name="inbound_asn_line_number_uq",
            ),
            models.CheckConstraint(
                condition=Q(expected_qty__gte=F("received_qty")),
                name="inbound_asn_line_received_lte_expected",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.asn.asn_number}#{self.line_number}"


class PurchaseOrderLine(TenantAuditModel):
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.PROTECT,
        related_name="lines",
        verbose_name="Purchase Order",
    )
    line_number = models.PositiveIntegerField(verbose_name="Line Number")
    goods = models.ForeignKey(
        "goods.ListModel",
        on_delete=models.PROTECT,
        related_name="purchase_order_lines",
        verbose_name="Goods",
    )
    ordered_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        verbose_name="Ordered Qty",
    )
    received_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Received Qty",
    )
    unit_cost = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Unit Cost",
    )
    stock_status = models.CharField(
        max_length=32,
        choices=InventoryStatus.choices,
        default=InventoryStatus.AVAILABLE,
        verbose_name="Stock Status",
    )
    status = models.CharField(
        max_length=32,
        choices=PurchaseOrderLineStatus.choices,
        default=PurchaseOrderLineStatus.OPEN,
        verbose_name="Status",
    )

    class Meta:
        db_table = "inbound_purchase_order_line"
        verbose_name = "Purchase Order Line"
        verbose_name_plural = "Purchase Order Lines"
        ordering = ["purchase_order_id", "line_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["purchase_order", "line_number"],
                condition=Q(is_delete=False),
                name="inbound_po_line_number_uq",
            ),
            models.CheckConstraint(
                condition=Q(ordered_qty__gte=F("received_qty")),
                name="inbound_po_line_received_lte_ordered",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.purchase_order.po_number}#{self.line_number}"


class Receipt(TenantAuditModel):
    asn = models.ForeignKey(
        AdvanceShipmentNotice,
        on_delete=models.PROTECT,
        related_name="receipts",
        blank=True,
        null=True,
        verbose_name="Advance Shipment Notice",
    )
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.PROTECT,
        related_name="receipts",
        verbose_name="Purchase Order",
    )
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="receipts",
        verbose_name="Warehouse",
    )
    receipt_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.PROTECT,
        related_name="receipts",
        verbose_name="Receipt Location",
    )
    receipt_number = models.CharField(max_length=64, verbose_name="Receipt Number")
    status = models.CharField(
        max_length=32,
        choices=ReceiptStatus.choices,
        default=ReceiptStatus.POSTED,
        verbose_name="Status",
    )
    reference_code = models.CharField(max_length=64, blank=True, default="", verbose_name="Reference Code")
    notes = models.TextField(blank=True, default="", verbose_name="Notes")
    received_by = models.CharField(max_length=255, verbose_name="Received By")
    received_at = models.DateTimeField(default=timezone.now, verbose_name="Received At")

    class Meta:
        db_table = "inbound_receipt"
        verbose_name = "Receipt"
        verbose_name_plural = "Receipts"
        ordering = ["-received_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "receipt_number"],
                condition=Q(is_delete=False),
                name="inbound_receipt_number_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.receipt_number


class ReceiptLine(TenantAuditModel):
    asn_line = models.ForeignKey(
        AdvanceShipmentNoticeLine,
        on_delete=models.PROTECT,
        related_name="receipt_lines",
        blank=True,
        null=True,
        verbose_name="ASN Line",
    )
    receipt = models.ForeignKey(
        Receipt,
        on_delete=models.PROTECT,
        related_name="lines",
        verbose_name="Receipt",
    )
    purchase_order_line = models.ForeignKey(
        PurchaseOrderLine,
        on_delete=models.PROTECT,
        related_name="receipt_lines",
        verbose_name="Purchase Order Line",
    )
    goods = models.ForeignKey(
        "goods.ListModel",
        on_delete=models.PROTECT,
        related_name="receipt_lines",
        verbose_name="Goods",
    )
    receipt_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.PROTECT,
        related_name="receipt_lines",
        verbose_name="Receipt Location",
    )
    received_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        verbose_name="Received Qty",
    )
    stock_status = models.CharField(
        max_length=32,
        choices=InventoryStatus.choices,
        default=InventoryStatus.AVAILABLE,
        verbose_name="Stock Status",
    )
    lot_number = models.CharField(max_length=64, blank=True, default="", verbose_name="Lot Number")
    serial_number = models.CharField(max_length=64, blank=True, default="", verbose_name="Serial Number")
    unit_cost = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Unit Cost",
    )
    inventory_movement = models.ForeignKey(
        InventoryMovement,
        on_delete=models.PROTECT,
        related_name="receipt_lines",
        blank=True,
        null=True,
        verbose_name="Inventory Movement",
    )
    license_plate = models.ForeignKey(
        "scanner.LicensePlate",
        on_delete=models.PROTECT,
        related_name="receipt_lines",
        blank=True,
        null=True,
        verbose_name="License Plate",
    )

    class Meta:
        db_table = "inbound_receipt_line"
        verbose_name = "Receipt Line"
        verbose_name_plural = "Receipt Lines"
        ordering = ["receipt_id", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["receipt", "purchase_order_line"],
                condition=Q(is_delete=False),
                name="inbound_receipt_line_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.receipt.receipt_number}:{self.goods.goods_code}"


class PutawayTask(TenantAuditModel):
    receipt_line = models.ForeignKey(
        ReceiptLine,
        on_delete=models.PROTECT,
        related_name="putaway_tasks",
        verbose_name="Receipt Line",
    )
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="putaway_tasks",
        verbose_name="Warehouse",
    )
    goods = models.ForeignKey(
        "goods.ListModel",
        on_delete=models.PROTECT,
        related_name="putaway_tasks",
        verbose_name="Goods",
    )
    task_number = models.CharField(max_length=64, verbose_name="Task Number")
    from_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.PROTECT,
        related_name="putaway_tasks_from",
        verbose_name="From Location",
    )
    to_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.PROTECT,
        related_name="putaway_tasks_to",
        verbose_name="To Location",
        blank=True,
        null=True,
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
        choices=PutawayTaskStatus.choices,
        default=PutawayTaskStatus.OPEN,
        verbose_name="Status",
    )
    assigned_to = models.ForeignKey(
        "staff.ListModel",
        on_delete=models.PROTECT,
        related_name="putaway_tasks",
        blank=True,
        null=True,
        verbose_name="Assigned To",
    )
    completed_by = models.CharField(max_length=255, blank=True, default="", verbose_name="Completed By")
    completed_at = models.DateTimeField(blank=True, null=True, verbose_name="Completed At")
    inventory_movement = models.ForeignKey(
        InventoryMovement,
        on_delete=models.PROTECT,
        related_name="putaway_tasks",
        blank=True,
        null=True,
        verbose_name="Inventory Movement",
    )
    license_plate = models.ForeignKey(
        "scanner.LicensePlate",
        on_delete=models.PROTECT,
        related_name="putaway_tasks",
        blank=True,
        null=True,
        verbose_name="License Plate",
    )
    notes = models.TextField(blank=True, default="", verbose_name="Notes")

    class Meta:
        db_table = "inbound_putaway_task"
        verbose_name = "Putaway Task"
        verbose_name_plural = "Putaway Tasks"
        ordering = ["status", "create_time", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "task_number"],
                condition=Q(is_delete=False),
                name="inbound_putaway_task_number_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.task_number
