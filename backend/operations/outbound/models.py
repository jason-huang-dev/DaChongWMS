"""Outbound sales, picking, and shipment models."""

from __future__ import annotations

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import F, Q
from django.utils import timezone

from inventory.models import InventoryMovement, InventoryStatus
from operations.order_types import OperationOrderType


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


class SalesOrderFulfillmentStage(models.TextChoices):
    GET_TRACKING_NO = "GET_TRACKING_NO", "Get Tracking No"
    TO_MOVE = "TO_MOVE", "To Move"
    IN_PROCESS = "IN_PROCESS", "In Process Orders"
    TO_SHIP = "TO_SHIP", "To Ship"
    SHIPPED = "SHIPPED", "Shipped"
    CANCELLED = "CANCELLED", "Cancelled"


class SalesOrderExceptionState(models.TextChoices):
    NORMAL = "NORMAL", "Normal"
    ABNORMAL_PACKAGE = "ABNORMAL_PACKAGE", "Abnormal Package"
    ORDER_INTERCEPTION = "ORDER_INTERCEPTION", "Order Interception"


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


class ShortPickStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    RESOLVED = "RESOLVED", "Resolved"


class ShortPickReason(models.TextChoices):
    INVENTORY_MISSING = "INVENTORY_MISSING", "Inventory Missing"
    DAMAGED = "DAMAGED", "Damaged"
    LOCATION_EMPTY = "LOCATION_EMPTY", "Location Empty"
    LPN_MISMATCH = "LPN_MISMATCH", "LPN Mismatch"
    COUNT_REQUIRED = "COUNT_REQUIRED", "Count Required"
    OTHER = "OTHER", "Other"


class OutboundWaveStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    RELEASED = "RELEASED", "Released"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class PackageExecutionStep(models.TextChoices):
    RELABEL = "RELABEL", "Scan And Relabel"
    PACK = "PACK", "Scan To Pack"
    INSPECT = "INSPECT", "Scan To Inspect"
    WEIGH = "WEIGH", "Weighing To Ship"


class PackageExecutionStatus(models.TextChoices):
    SUCCESS = "SUCCESS", "Success"
    FLAGGED = "FLAGGED", "Flagged"


class ShipmentDocumentType(models.TextChoices):
    MANIFEST = "MANIFEST", "Manifest Record"
    PHOTO = "PHOTO", "Photo Record"
    SCANFORM = "SCANFORM", "Get Scanform"


class LogisticsTrackingStatus(models.TextChoices):
    INFO_RECEIVED = "INFO_RECEIVED", "Info Received"
    IN_TRANSIT = "IN_TRANSIT", "In Transit"
    ARRIVED = "ARRIVED", "Arrived"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY", "Out For Delivery"
    DELIVERED = "DELIVERED", "Delivered"
    EXCEPTION = "EXCEPTION", "Exception"


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
    order_type = models.CharField(
        max_length=32,
        choices=OperationOrderType.choices,
        default=OperationOrderType.DROPSHIP,
        verbose_name="Order Type",
    )
    order_number = models.CharField(max_length=64, verbose_name="Sales Order Number")
    order_time = models.DateTimeField(blank=True, null=True, verbose_name="Order Time")
    requested_ship_date = models.DateField(blank=True, null=True, verbose_name="Requested Ship Date")
    expires_at = models.DateTimeField(blank=True, null=True, verbose_name="Expiration Time")
    reference_code = models.CharField(max_length=64, blank=True, default="", verbose_name="Reference Code")
    status = models.CharField(
        max_length=32,
        choices=SalesOrderStatus.choices,
        default=SalesOrderStatus.OPEN,
        verbose_name="Status",
    )
    fulfillment_stage = models.CharField(
        max_length=32,
        choices=SalesOrderFulfillmentStage.choices,
        default=SalesOrderFulfillmentStage.GET_TRACKING_NO,
        verbose_name="Fulfillment Stage",
    )
    exception_state = models.CharField(
        max_length=32,
        choices=SalesOrderExceptionState.choices,
        default=SalesOrderExceptionState.NORMAL,
        verbose_name="Exception State",
    )
    package_count = models.PositiveIntegerField(default=0, verbose_name="Package Count")
    package_type = models.CharField(max_length=64, blank=True, default="", verbose_name="Package Type")
    package_weight = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Package Weight",
    )
    package_length = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Package Length",
    )
    package_width = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Package Width",
    )
    package_height = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Package Height",
    )
    package_volume = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Package Volume",
    )
    logistics_provider = models.CharField(max_length=64, blank=True, default="", verbose_name="Logistics Provider")
    shipping_method = models.CharField(max_length=64, blank=True, default="", verbose_name="Shipping Method")
    tracking_number = models.CharField(max_length=64, blank=True, default="", verbose_name="Tracking Number")
    waybill_number = models.CharField(max_length=64, blank=True, default="", verbose_name="Waybill Number")
    waybill_printed = models.BooleanField(default=False, verbose_name="Waybill Printed")
    waybill_printed_at = models.DateTimeField(blank=True, null=True, verbose_name="Waybill Printed At")
    deliverer_name = models.CharField(max_length=255, blank=True, default="", verbose_name="Deliverer Name")
    deliverer_phone = models.CharField(max_length=64, blank=True, default="", verbose_name="Deliverer Phone")
    receiver_name = models.CharField(max_length=255, blank=True, default="", verbose_name="Receiver Name")
    receiver_phone = models.CharField(max_length=64, blank=True, default="", verbose_name="Receiver Phone")
    receiver_country = models.CharField(max_length=64, blank=True, default="", verbose_name="Receiver Country")
    receiver_state = models.CharField(max_length=64, blank=True, default="", verbose_name="Receiver State")
    receiver_city = models.CharField(max_length=64, blank=True, default="", verbose_name="Receiver City")
    receiver_address = models.CharField(max_length=255, blank=True, default="", verbose_name="Receiver Address")
    receiver_postal_code = models.CharField(max_length=32, blank=True, default="", verbose_name="Receiver Postal Code")
    picking_started_at = models.DateTimeField(blank=True, null=True, verbose_name="Picking Started At")
    picking_completed_at = models.DateTimeField(blank=True, null=True, verbose_name="Picking Completed At")
    packed_at = models.DateTimeField(blank=True, null=True, verbose_name="Packed At")
    exception_notes = models.TextField(blank=True, default="", verbose_name="Exception Notes")
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


class OutboundWave(TenantAuditModel):
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="outbound_waves",
        verbose_name="Warehouse",
    )
    order_type = models.CharField(
        max_length=32,
        choices=OperationOrderType.choices,
        default=OperationOrderType.DROPSHIP,
        verbose_name="Order Type",
    )
    wave_number = models.CharField(max_length=64, verbose_name="Wave Number")
    status = models.CharField(
        max_length=16,
        choices=OutboundWaveStatus.choices,
        default=OutboundWaveStatus.OPEN,
        verbose_name="Status",
    )
    notes = models.TextField(blank=True, default="", verbose_name="Notes")
    generated_by = models.CharField(max_length=255, verbose_name="Generated By")
    generated_at = models.DateTimeField(default=timezone.now, verbose_name="Generated At")

    class Meta:
        db_table = "outbound_wave"
        verbose_name = "Outbound Wave"
        verbose_name_plural = "Outbound Waves"
        ordering = ["-generated_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "wave_number"],
                condition=Q(is_delete=False),
                name="outbound_wave_number_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.wave_number


class OutboundWaveOrder(TenantAuditModel):
    wave = models.ForeignKey(
        OutboundWave,
        on_delete=models.PROTECT,
        related_name="orders",
        verbose_name="Wave",
    )
    sales_order = models.ForeignKey(
        SalesOrder,
        on_delete=models.PROTECT,
        related_name="wave_assignments",
        verbose_name="Sales Order",
    )
    sort_sequence = models.PositiveIntegerField(default=1, verbose_name="Sort Sequence")

    class Meta:
        db_table = "outbound_wave_order"
        verbose_name = "Outbound Wave Order"
        verbose_name_plural = "Outbound Wave Orders"
        ordering = ["wave_id", "sort_sequence", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["wave", "sales_order"],
                condition=Q(is_delete=False),
                name="outbound_wave_order_sales_order_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.wave.wave_number}:{self.sales_order.order_number}"


class PackageExecutionRecord(TenantAuditModel):
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="package_execution_records",
        verbose_name="Warehouse",
    )
    sales_order = models.ForeignKey(
        SalesOrder,
        on_delete=models.PROTECT,
        related_name="package_execution_records",
        verbose_name="Sales Order",
    )
    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.PROTECT,
        related_name="package_execution_records",
        blank=True,
        null=True,
        verbose_name="Shipment",
    )
    wave = models.ForeignKey(
        OutboundWave,
        on_delete=models.PROTECT,
        related_name="package_execution_records",
        blank=True,
        null=True,
        verbose_name="Wave",
    )
    record_number = models.CharField(max_length=64, verbose_name="Record Number")
    step_type = models.CharField(
        max_length=16,
        choices=PackageExecutionStep.choices,
        verbose_name="Step Type",
    )
    execution_status = models.CharField(
        max_length=16,
        choices=PackageExecutionStatus.choices,
        default=PackageExecutionStatus.SUCCESS,
        verbose_name="Execution Status",
    )
    package_number = models.CharField(max_length=64, verbose_name="Package Number")
    scan_code = models.CharField(max_length=255, blank=True, default="", verbose_name="Scan Code")
    weight = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        blank=True,
        null=True,
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Weight",
    )
    notes = models.TextField(blank=True, default="", verbose_name="Notes")
    executed_by = models.CharField(max_length=255, verbose_name="Executed By")
    executed_at = models.DateTimeField(default=timezone.now, verbose_name="Executed At")

    class Meta:
        db_table = "outbound_package_execution_record"
        verbose_name = "Package Execution Record"
        verbose_name_plural = "Package Execution Records"
        ordering = ["-executed_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "record_number"],
                condition=Q(is_delete=False),
                name="outbound_package_execution_number_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.record_number


class ShipmentDocumentRecord(TenantAuditModel):
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="shipment_document_records",
        verbose_name="Warehouse",
    )
    sales_order = models.ForeignKey(
        SalesOrder,
        on_delete=models.PROTECT,
        related_name="shipment_document_records",
        verbose_name="Sales Order",
    )
    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.PROTECT,
        related_name="document_records",
        blank=True,
        null=True,
        verbose_name="Shipment",
    )
    wave = models.ForeignKey(
        OutboundWave,
        on_delete=models.PROTECT,
        related_name="document_records",
        blank=True,
        null=True,
        verbose_name="Wave",
    )
    document_number = models.CharField(max_length=64, verbose_name="Document Number")
    document_type = models.CharField(
        max_length=16,
        choices=ShipmentDocumentType.choices,
        verbose_name="Document Type",
    )
    reference_code = models.CharField(max_length=64, blank=True, default="", verbose_name="Reference Code")
    file_name = models.CharField(max_length=255, blank=True, default="", verbose_name="File Name")
    notes = models.TextField(blank=True, default="", verbose_name="Notes")
    generated_by = models.CharField(max_length=255, verbose_name="Generated By")
    generated_at = models.DateTimeField(default=timezone.now, verbose_name="Generated At")

    class Meta:
        db_table = "outbound_shipment_document_record"
        verbose_name = "Shipment Document Record"
        verbose_name_plural = "Shipment Document Records"
        ordering = ["-generated_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "document_number"],
                condition=Q(is_delete=False),
                name="outbound_shipment_document_number_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.document_number


class LogisticsTrackingEvent(TenantAuditModel):
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="logistics_tracking_events",
        verbose_name="Warehouse",
    )
    sales_order = models.ForeignKey(
        SalesOrder,
        on_delete=models.PROTECT,
        related_name="tracking_events",
        verbose_name="Sales Order",
    )
    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.PROTECT,
        related_name="tracking_events",
        blank=True,
        null=True,
        verbose_name="Shipment",
    )
    event_number = models.CharField(max_length=64, verbose_name="Event Number")
    tracking_number = models.CharField(max_length=64, verbose_name="Tracking Number")
    event_code = models.CharField(max_length=32, verbose_name="Event Code")
    event_status = models.CharField(
        max_length=32,
        choices=LogisticsTrackingStatus.choices,
        verbose_name="Event Status",
    )
    event_location = models.CharField(max_length=255, blank=True, default="", verbose_name="Event Location")
    description = models.TextField(blank=True, default="", verbose_name="Description")
    occurred_at = models.DateTimeField(default=timezone.now, verbose_name="Occurred At")
    recorded_by = models.CharField(max_length=255, verbose_name="Recorded By")

    class Meta:
        db_table = "outbound_logistics_tracking_event"
        verbose_name = "Logistics Tracking Event"
        verbose_name_plural = "Logistics Tracking Events"
        ordering = ["-occurred_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "event_number"],
                condition=Q(is_delete=False),
                name="outbound_tracking_event_number_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.event_number


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


class ShortPickRecord(TenantAuditModel):
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="short_pick_records",
        verbose_name="Warehouse",
    )
    sales_order = models.ForeignKey(
        SalesOrder,
        on_delete=models.PROTECT,
        related_name="short_pick_records",
        verbose_name="Sales Order",
    )
    sales_order_line = models.ForeignKey(
        SalesOrderLine,
        on_delete=models.PROTECT,
        related_name="short_pick_records",
        verbose_name="Sales Order Line",
    )
    pick_task = models.ForeignKey(
        PickTask,
        on_delete=models.PROTECT,
        related_name="short_pick_records",
        verbose_name="Pick Task",
    )
    goods = models.ForeignKey(
        "goods.ListModel",
        on_delete=models.PROTECT,
        related_name="short_pick_records",
        verbose_name="Goods",
    )
    from_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.PROTECT,
        related_name="short_pick_records_from",
        verbose_name="From Location",
    )
    to_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.PROTECT,
        related_name="short_pick_records_to",
        blank=True,
        null=True,
        verbose_name="To Location",
    )
    requested_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        verbose_name="Requested Qty",
    )
    picked_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Picked Qty",
    )
    short_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        verbose_name="Short Qty",
    )
    stock_status = models.CharField(
        max_length=32,
        choices=InventoryStatus.choices,
        default=InventoryStatus.AVAILABLE,
        verbose_name="Stock Status",
    )
    lot_number = models.CharField(max_length=64, blank=True, default="", verbose_name="Lot Number")
    serial_number = models.CharField(max_length=64, blank=True, default="", verbose_name="Serial Number")
    reason_code = models.CharField(max_length=32, choices=ShortPickReason.choices, verbose_name="Reason Code")
    status = models.CharField(max_length=16, choices=ShortPickStatus.choices, default=ShortPickStatus.OPEN, verbose_name="Status")
    notes = models.TextField(blank=True, default="", verbose_name="Notes")
    reported_by = models.CharField(max_length=255, verbose_name="Reported By")
    reported_at = models.DateTimeField(default=timezone.now, verbose_name="Reported At")
    resolved_by = models.CharField(max_length=255, blank=True, default="", verbose_name="Resolved By")
    resolved_at = models.DateTimeField(blank=True, null=True, verbose_name="Resolved At")
    resolution_notes = models.TextField(blank=True, default="", verbose_name="Resolution Notes")

    class Meta:
        db_table = "outbound_short_pick_record"
        verbose_name = "Short Pick Record"
        verbose_name_plural = "Short Pick Records"
        ordering = ["status", "-reported_at", "-id"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.sales_order.order_number}:{self.goods.goods_code}:{self.short_qty}"
