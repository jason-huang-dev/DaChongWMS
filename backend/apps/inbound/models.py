from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import F
from django.utils import timezone

from apps.common.operation_types import OperationOrderType
from apps.inventory.models import InventoryMovement, InventoryStatus
from apps.locations.models import Location
from apps.organizations.models import Organization, OrganizationMembership
from apps.partners.models import CustomerAccount
from apps.products.models import Product
from apps.warehouse.models import Warehouse


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


class AdvanceShipmentNoticeStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    PARTIAL = "PARTIAL", "Partial"
    RECEIVED = "RECEIVED", "Received"
    CANCELLED = "CANCELLED", "Cancelled"


class ReceiptStatus(models.TextChoices):
    POSTED = "POSTED", "Posted"
    CANCELLED = "CANCELLED", "Cancelled"


class PutawayTaskStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    ASSIGNED = "ASSIGNED", "Assigned"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class PurchaseOrder(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="purchase_orders",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="purchase_orders",
    )
    customer_account = models.ForeignKey(
        CustomerAccount,
        on_delete=models.CASCADE,
        related_name="purchase_orders",
    )
    order_type = models.CharField(
        max_length=32,
        choices=OperationOrderType.choices,
        default=OperationOrderType.STANDARD,
    )
    po_number = models.CharField(max_length=64)
    customer_code = models.CharField(max_length=64, blank=True, default="")
    customer_name = models.CharField(max_length=255, blank=True, default="")
    supplier_code = models.CharField(max_length=64, blank=True, default="")
    supplier_name = models.CharField(max_length=255, blank=True, default="")
    supplier_contact_name = models.CharField(max_length=255, blank=True, default="")
    supplier_contact_phone = models.CharField(max_length=64, blank=True, default="")
    expected_arrival_date = models.DateField(blank=True, null=True)
    reference_code = models.CharField(max_length=64, blank=True, default="")
    status = models.CharField(
        max_length=32,
        choices=PurchaseOrderStatus.choices,
        default=PurchaseOrderStatus.OPEN,
    )
    notes = models.TextField(blank=True, default="")
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization_id", "-create_time", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "po_number"),
                name="unique_purchase_order_number_per_organization",
            ),
        ]
        permissions = [
            ("view_inbound", "Can view inbound operations"),
            ("manage_inbound_orders", "Can manage inbound orders"),
            ("manage_inbound_execution", "Can manage inbound execution"),
        ]

    def clean(self) -> None:
        super().clean()
        self.po_number = self.po_number.strip().upper()
        self.customer_code = self.customer_code.strip().upper()
        self.customer_name = self.customer_name.strip()
        self.supplier_code = self.supplier_code.strip().upper()
        self.supplier_name = self.supplier_name.strip()
        self.supplier_contact_name = self.supplier_contact_name.strip()
        self.supplier_contact_phone = self.supplier_contact_phone.strip()
        self.reference_code = self.reference_code.strip()
        self.notes = self.notes.strip()

        errors: dict[str, str] = {}
        if not self.po_number:
            errors["po_number"] = "Purchase order number cannot be blank."
        if self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization as the purchase order."
        if self.customer_account.organization_id != self.organization_id:
            errors["customer_account"] = "Customer account must belong to the same organization as the purchase order."
        if not self.customer_code or not self.customer_name:
            errors["customer_account"] = "Purchase orders must carry customer account snapshot information."
        if not self.customer_account.allow_inbound_goods:
            errors["customer_account"] = "Customer account is not enabled for inbound goods."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.po_number


class PurchaseOrderLine(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="purchase_order_lines",
    )
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    line_number = models.PositiveIntegerField()
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="purchase_order_lines",
    )
    ordered_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
    )
    received_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    unit_cost = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    stock_status = models.CharField(
        max_length=32,
        choices=InventoryStatus.choices,
        default=InventoryStatus.AVAILABLE,
    )
    status = models.CharField(
        max_length=32,
        choices=PurchaseOrderLineStatus.choices,
        default=PurchaseOrderLineStatus.OPEN,
    )
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization_id", "purchase_order_id", "line_number", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("purchase_order", "line_number"),
                name="unique_purchase_order_line_number_per_order",
            ),
            models.CheckConstraint(
                condition=models.Q(ordered_qty__gte=F("received_qty")),
                name="purchase_order_line_received_lte_ordered",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        errors: dict[str, str] = {}
        if self.purchase_order.organization_id != self.organization_id:
            errors["purchase_order"] = "Purchase order must belong to the same organization as the line."
        if self.product.organization_id != self.organization_id:
            errors["product"] = "Product must belong to the same organization as the line."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)


class AdvanceShipmentNotice(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="advance_shipment_notices",
    )
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name="advance_shipment_notices",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="advance_shipment_notices",
    )
    customer_account = models.ForeignKey(
        CustomerAccount,
        on_delete=models.CASCADE,
        related_name="advance_shipment_notices",
    )
    order_type = models.CharField(
        max_length=32,
        choices=OperationOrderType.choices,
        default=OperationOrderType.STANDARD,
    )
    asn_number = models.CharField(max_length=64)
    expected_arrival_date = models.DateField(blank=True, null=True)
    status = models.CharField(
        max_length=32,
        choices=AdvanceShipmentNoticeStatus.choices,
        default=AdvanceShipmentNoticeStatus.OPEN,
    )
    reference_code = models.CharField(max_length=64, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization_id", "-create_time", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "asn_number"),
                name="unique_asn_number_per_organization",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        self.asn_number = self.asn_number.strip().upper()
        self.reference_code = self.reference_code.strip()
        self.notes = self.notes.strip()
        errors: dict[str, str] = {}
        if not self.asn_number:
            errors["asn_number"] = "ASN number cannot be blank."
        if self.purchase_order.organization_id != self.organization_id:
            errors["purchase_order"] = "Purchase order must belong to the same organization as the ASN."
        if self.warehouse_id != self.purchase_order.warehouse_id:
            errors["warehouse"] = "ASN warehouse must match the purchase order warehouse."
        if self.customer_account_id != self.purchase_order.customer_account_id:
            errors["customer_account"] = "ASN customer account must match the purchase order customer account."
        if self.order_type != self.purchase_order.order_type:
            errors["order_type"] = "ASN order type must match the purchase order order type."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)


class AdvanceShipmentNoticeLine(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="advance_shipment_notice_lines",
    )
    asn = models.ForeignKey(
        AdvanceShipmentNotice,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    line_number = models.PositiveIntegerField()
    purchase_order_line = models.ForeignKey(
        PurchaseOrderLine,
        on_delete=models.CASCADE,
        related_name="asn_lines",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="asn_lines",
    )
    expected_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
    )
    received_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    stock_status = models.CharField(
        max_length=32,
        choices=InventoryStatus.choices,
        default=InventoryStatus.AVAILABLE,
    )
    expected_lpn_code = models.CharField(max_length=128, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization_id", "asn_id", "line_number", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("asn", "line_number"),
                name="unique_asn_line_number_per_asn",
            ),
            models.CheckConstraint(
                condition=models.Q(expected_qty__gte=F("received_qty")),
                name="asn_line_received_lte_expected",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        self.expected_lpn_code = self.expected_lpn_code.strip()
        self.notes = self.notes.strip()
        errors: dict[str, str] = {}
        if self.asn.organization_id != self.organization_id:
            errors["asn"] = "ASN must belong to the same organization as the line."
        if self.purchase_order_line.organization_id != self.organization_id:
            errors["purchase_order_line"] = "Purchase order line must belong to the same organization as the ASN line."
        if self.product.organization_id != self.organization_id:
            errors["product"] = "Product must belong to the same organization as the ASN line."
        if self.purchase_order_line.purchase_order_id != self.asn.purchase_order_id:
            errors["purchase_order_line"] = "Purchase order line must belong to the ASN purchase order."
        if self.product_id != self.purchase_order_line.product_id:
            errors["product"] = "ASN line product must match the purchase order line product."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)


class Receipt(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="receipts",
    )
    asn = models.ForeignKey(
        AdvanceShipmentNotice,
        on_delete=models.SET_NULL,
        related_name="receipts",
        blank=True,
        null=True,
    )
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name="receipts",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="receipts",
    )
    receipt_location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name="receipts",
    )
    receipt_number = models.CharField(max_length=64)
    status = models.CharField(
        max_length=32,
        choices=ReceiptStatus.choices,
        default=ReceiptStatus.POSTED,
    )
    reference_code = models.CharField(max_length=64, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    received_by = models.CharField(max_length=255)
    received_at = models.DateTimeField(default=timezone.now)
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization_id", "-received_at", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "receipt_number"),
                name="unique_receipt_number_per_organization",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        self.receipt_number = self.receipt_number.strip().upper()
        self.reference_code = self.reference_code.strip()
        self.notes = self.notes.strip()
        self.received_by = self.received_by.strip()
        errors: dict[str, str] = {}
        if not self.receipt_number:
            errors["receipt_number"] = "Receipt number cannot be blank."
        if not self.received_by:
            errors["received_by"] = "Received by cannot be blank."
        if self.purchase_order.organization_id != self.organization_id:
            errors["purchase_order"] = "Purchase order must belong to the same organization as the receipt."
        if self.warehouse_id != self.purchase_order.warehouse_id:
            errors["warehouse"] = "Receipt warehouse must match the purchase order warehouse."
        if self.receipt_location.organization_id != self.organization_id or self.receipt_location.warehouse_id != self.warehouse_id:
            errors["receipt_location"] = "Receipt location must belong to the same warehouse as the receipt."
        if self.asn is not None and self.asn.purchase_order_id != self.purchase_order_id:
            errors["asn"] = "Receipt ASN must belong to the same purchase order."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)


class ReceiptLine(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="receipt_lines",
    )
    asn_line = models.ForeignKey(
        AdvanceShipmentNoticeLine,
        on_delete=models.SET_NULL,
        related_name="receipt_lines",
        blank=True,
        null=True,
    )
    receipt = models.ForeignKey(
        Receipt,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    purchase_order_line = models.ForeignKey(
        PurchaseOrderLine,
        on_delete=models.CASCADE,
        related_name="receipt_lines",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="receipt_lines",
    )
    receipt_location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name="receipt_lines",
    )
    received_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
    )
    stock_status = models.CharField(
        max_length=32,
        choices=InventoryStatus.choices,
        default=InventoryStatus.AVAILABLE,
    )
    lot_number = models.CharField(max_length=64, blank=True, default="")
    serial_number = models.CharField(max_length=64, blank=True, default="")
    unit_cost = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    inventory_movement = models.ForeignKey(
        InventoryMovement,
        on_delete=models.SET_NULL,
        related_name="receipt_lines",
        blank=True,
        null=True,
    )
    create_time = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("organization_id", "receipt_id", "purchase_order_line_id", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("receipt", "purchase_order_line"),
                name="unique_receipt_line_per_receipt_po_line",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        self.lot_number = self.lot_number.strip()
        self.serial_number = self.serial_number.strip()
        errors: dict[str, str] = {}
        if self.receipt.organization_id != self.organization_id:
            errors["receipt"] = "Receipt must belong to the same organization as the line."
        if self.purchase_order_line.organization_id != self.organization_id:
            errors["purchase_order_line"] = "Purchase order line must belong to the same organization as the line."
        if self.purchase_order_line.purchase_order_id != self.receipt.purchase_order_id:
            errors["purchase_order_line"] = "Purchase order line must belong to the same purchase order as the receipt."
        if self.product_id != self.purchase_order_line.product_id:
            errors["product"] = "Receipt line product must match the purchase order line product."
        if self.receipt_location_id != self.receipt.receipt_location_id:
            errors["receipt_location"] = "Receipt line location must match the receipt location."
        if self.asn_line is not None and self.asn_line.asn_id != self.receipt.asn_id:
            errors["asn_line"] = "ASN line must belong to the same ASN as the receipt."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)


class PutawayTask(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="putaway_tasks",
    )
    receipt_line = models.ForeignKey(
        ReceiptLine,
        on_delete=models.CASCADE,
        related_name="putaway_tasks",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="putaway_tasks",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="putaway_tasks",
    )
    task_number = models.CharField(max_length=64)
    from_location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name="putaway_tasks_from",
    )
    to_location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name="putaway_tasks_to",
        blank=True,
        null=True,
    )
    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
    )
    stock_status = models.CharField(
        max_length=32,
        choices=InventoryStatus.choices,
        default=InventoryStatus.AVAILABLE,
    )
    lot_number = models.CharField(max_length=64, blank=True, default="")
    serial_number = models.CharField(max_length=64, blank=True, default="")
    status = models.CharField(
        max_length=32,
        choices=PutawayTaskStatus.choices,
        default=PutawayTaskStatus.OPEN,
    )
    assigned_membership = models.ForeignKey(
        OrganizationMembership,
        on_delete=models.SET_NULL,
        related_name="putaway_tasks",
        blank=True,
        null=True,
    )
    completed_by = models.CharField(max_length=255, blank=True, default="")
    completed_at = models.DateTimeField(blank=True, null=True)
    inventory_movement = models.ForeignKey(
        InventoryMovement,
        on_delete=models.SET_NULL,
        related_name="putaway_tasks",
        blank=True,
        null=True,
    )
    notes = models.TextField(blank=True, default="")
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization_id", "status", "create_time", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "task_number"),
                name="unique_putaway_task_number_per_organization",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        self.task_number = self.task_number.strip().upper()
        self.lot_number = self.lot_number.strip()
        self.serial_number = self.serial_number.strip()
        self.completed_by = self.completed_by.strip()
        self.notes = self.notes.strip()
        errors: dict[str, str] = {}
        if not self.task_number:
            errors["task_number"] = "Task number cannot be blank."
        if self.receipt_line.organization_id != self.organization_id:
            errors["receipt_line"] = "Receipt line must belong to the same organization as the putaway task."
        if self.product_id != self.receipt_line.product_id:
            errors["product"] = "Putaway product must match the receipt line product."
        if self.warehouse.organization_id != self.organization_id or self.warehouse_id != self.receipt_line.receipt.warehouse_id:
            errors["warehouse"] = "Putaway warehouse must match the receipt warehouse."
        if self.from_location.organization_id != self.organization_id or self.from_location.warehouse_id != self.warehouse_id:
            errors["from_location"] = "Putaway source location must belong to the same warehouse."
        if self.to_location is not None and (
            self.to_location.organization_id != self.organization_id or self.to_location.warehouse_id != self.warehouse_id
        ):
            errors["to_location"] = "Putaway destination location must belong to the same warehouse."
        if self.assigned_membership is not None and self.assigned_membership.organization_id != self.organization_id:
            errors["assigned_membership"] = "Assigned membership must belong to the same organization."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

