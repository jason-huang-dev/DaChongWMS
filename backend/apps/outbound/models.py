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


class SalesOrder(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="sales_orders",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="sales_orders",
    )
    customer_account = models.ForeignKey(
        CustomerAccount,
        on_delete=models.CASCADE,
        related_name="sales_orders",
    )
    staging_location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name="sales_orders",
    )
    order_type = models.CharField(
        max_length=32,
        choices=OperationOrderType.choices,
        default=OperationOrderType.DROPSHIP,
    )
    order_number = models.CharField(max_length=64)
    order_time = models.DateTimeField(blank=True, null=True)
    requested_ship_date = models.DateField(blank=True, null=True)
    expires_at = models.DateTimeField(blank=True, null=True)
    reference_code = models.CharField(max_length=64, blank=True, default="")
    status = models.CharField(
        max_length=32,
        choices=SalesOrderStatus.choices,
        default=SalesOrderStatus.OPEN,
    )
    fulfillment_stage = models.CharField(
        max_length=32,
        choices=SalesOrderFulfillmentStage.choices,
        default=SalesOrderFulfillmentStage.GET_TRACKING_NO,
    )
    exception_state = models.CharField(
        max_length=32,
        choices=SalesOrderExceptionState.choices,
        default=SalesOrderExceptionState.NORMAL,
    )
    customer_code = models.CharField(max_length=64, blank=True, default="")
    customer_name = models.CharField(max_length=255, blank=True, default="")
    customer_contact_name = models.CharField(max_length=255, blank=True, default="")
    customer_contact_email = models.EmailField(blank=True, default="")
    customer_contact_phone = models.CharField(max_length=64, blank=True, default="")
    package_count = models.PositiveIntegerField(default=0)
    package_type = models.CharField(max_length=64, blank=True, default="")
    package_weight = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    package_length = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    package_width = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    package_height = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    package_volume = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    logistics_provider = models.CharField(max_length=64, blank=True, default="")
    shipping_method = models.CharField(max_length=64, blank=True, default="")
    tracking_number = models.CharField(max_length=64, blank=True, default="")
    waybill_number = models.CharField(max_length=64, blank=True, default="")
    waybill_printed = models.BooleanField(default=False)
    waybill_printed_at = models.DateTimeField(blank=True, null=True)
    deliverer_name = models.CharField(max_length=255, blank=True, default="")
    deliverer_phone = models.CharField(max_length=64, blank=True, default="")
    receiver_name = models.CharField(max_length=255, blank=True, default="")
    receiver_phone = models.CharField(max_length=64, blank=True, default="")
    receiver_country = models.CharField(max_length=64, blank=True, default="")
    receiver_state = models.CharField(max_length=64, blank=True, default="")
    receiver_city = models.CharField(max_length=64, blank=True, default="")
    receiver_address = models.CharField(max_length=255, blank=True, default="")
    receiver_postal_code = models.CharField(max_length=32, blank=True, default="")
    picking_started_at = models.DateTimeField(blank=True, null=True)
    picking_completed_at = models.DateTimeField(blank=True, null=True)
    packed_at = models.DateTimeField(blank=True, null=True)
    exception_notes = models.TextField(blank=True, default="")
    notes = models.TextField(blank=True, default="")
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization_id", "-create_time", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "order_number"),
                name="unique_sales_order_number_per_organization",
            ),
        ]
        permissions = [
            ("view_outbound", "Can view outbound operations"),
            ("manage_outbound_orders", "Can manage outbound orders"),
            ("manage_outbound_execution", "Can manage outbound execution"),
        ]

    def clean(self) -> None:
        super().clean()
        self.order_number = self.order_number.strip().upper()
        self.reference_code = self.reference_code.strip()
        self.customer_code = self.customer_code.strip().upper()
        self.customer_name = self.customer_name.strip()
        self.customer_contact_name = self.customer_contact_name.strip()
        self.customer_contact_email = self.customer_contact_email.strip().lower()
        self.customer_contact_phone = self.customer_contact_phone.strip()
        self.package_type = self.package_type.strip()
        self.logistics_provider = self.logistics_provider.strip()
        self.shipping_method = self.shipping_method.strip()
        self.tracking_number = self.tracking_number.strip()
        self.waybill_number = self.waybill_number.strip()
        self.deliverer_name = self.deliverer_name.strip()
        self.deliverer_phone = self.deliverer_phone.strip()
        self.receiver_name = self.receiver_name.strip()
        self.receiver_phone = self.receiver_phone.strip()
        self.receiver_country = self.receiver_country.strip()
        self.receiver_state = self.receiver_state.strip()
        self.receiver_city = self.receiver_city.strip()
        self.receiver_address = self.receiver_address.strip()
        self.receiver_postal_code = self.receiver_postal_code.strip()
        self.exception_notes = self.exception_notes.strip()
        self.notes = self.notes.strip()

        errors: dict[str, str] = {}
        if not self.order_number:
            errors["order_number"] = "Order number cannot be blank."
        if self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization as the sales order."
        if self.customer_account.organization_id != self.organization_id:
            errors["customer_account"] = "Customer account must belong to the same organization as the sales order."
        if self.staging_location.organization_id != self.organization_id:
            errors["staging_location"] = "Staging location must belong to the same organization as the sales order."
        if self.staging_location.warehouse_id != self.warehouse_id:
            errors["staging_location"] = "Staging location must belong to the same warehouse as the sales order."
        if self.order_type == OperationOrderType.DROPSHIP and not self.customer_account.allow_dropshipping_orders:
            errors["customer_account"] = "Customer account is not enabled for dropshipping orders."
        if self.order_type == OperationOrderType.DROPSHIP:
            if not self.customer_code or not self.customer_name:
                errors["customer_account"] = "Dropshipping orders must carry customer account snapshot information."
        if self.waybill_printed and self.waybill_printed_at is None:
            self.waybill_printed_at = timezone.now()
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.order_number


class SalesOrderLine(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="sales_order_lines",
    )
    sales_order = models.ForeignKey(
        SalesOrder,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    line_number = models.PositiveIntegerField()
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="sales_order_lines",
    )
    ordered_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
    )
    allocated_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    picked_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    shipped_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    unit_price = models.DecimalField(
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
        choices=SalesOrderLineStatus.choices,
        default=SalesOrderLineStatus.OPEN,
    )
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization_id", "sales_order_id", "line_number", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("sales_order", "line_number"),
                name="unique_sales_order_line_number_per_order",
            ),
            models.CheckConstraint(
                condition=models.Q(ordered_qty__gte=F("allocated_qty")),
                name="sales_order_line_allocated_lte_ordered",
            ),
            models.CheckConstraint(
                condition=models.Q(ordered_qty__gte=F("picked_qty")),
                name="sales_order_line_picked_lte_ordered",
            ),
            models.CheckConstraint(
                condition=models.Q(ordered_qty__gte=F("shipped_qty")),
                name="sales_order_line_shipped_lte_ordered",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        errors: dict[str, str] = {}
        if self.sales_order.organization_id != self.organization_id:
            errors["sales_order"] = "Sales order must belong to the same organization as the line."
        if self.product.organization_id != self.organization_id:
            errors["product"] = "Product must belong to the same organization as the line."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.sales_order.order_number}#{self.line_number}"


class PickTask(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="pick_tasks",
    )
    sales_order_line = models.ForeignKey(
        SalesOrderLine,
        on_delete=models.CASCADE,
        related_name="pick_tasks",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="pick_tasks",
    )
    from_location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name="pick_tasks_from",
    )
    to_location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name="pick_tasks_to",
    )
    task_number = models.CharField(max_length=64)
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
        choices=PickTaskStatus.choices,
        default=PickTaskStatus.OPEN,
    )
    assigned_membership = models.ForeignKey(
        OrganizationMembership,
        on_delete=models.SET_NULL,
        related_name="assigned_pick_tasks",
        blank=True,
        null=True,
    )
    completed_by = models.CharField(max_length=255, blank=True, default="")
    completed_at = models.DateTimeField(blank=True, null=True)
    inventory_movement = models.ForeignKey(
        InventoryMovement,
        on_delete=models.SET_NULL,
        related_name="pick_tasks",
        blank=True,
        null=True,
    )
    notes = models.TextField(blank=True, default="")
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization_id", "sales_order_line_id", "task_number", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "task_number"),
                name="unique_pick_task_number_per_organization",
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
        if self.sales_order_line.organization_id != self.organization_id:
            errors["sales_order_line"] = "Pick task line must belong to the same organization."
        if self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization as the pick task."
        if self.from_location.organization_id != self.organization_id or self.from_location.warehouse_id != self.warehouse_id:
            errors["from_location"] = "Source location must belong to the same warehouse as the pick task."
        if self.to_location.organization_id != self.organization_id or self.to_location.warehouse_id != self.warehouse_id:
            errors["to_location"] = "Destination location must belong to the same warehouse as the pick task."
        if self.assigned_membership is not None and self.assigned_membership.organization_id != self.organization_id:
            errors["assigned_membership"] = "Assigned membership must belong to the same organization."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)


class Shipment(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="shipments",
    )
    sales_order = models.ForeignKey(
        SalesOrder,
        on_delete=models.CASCADE,
        related_name="shipments",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="shipments",
    )
    shipment_number = models.CharField(max_length=64)
    status = models.CharField(
        max_length=32,
        choices=ShipmentStatus.choices,
        default=ShipmentStatus.POSTED,
    )
    tracking_number = models.CharField(max_length=64, blank=True, default="")
    shipped_by = models.CharField(max_length=255)
    shipped_at = models.DateTimeField(default=timezone.now)
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization_id", "-shipped_at", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "shipment_number"),
                name="unique_shipment_number_per_organization",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        self.shipment_number = self.shipment_number.strip().upper()
        self.tracking_number = self.tracking_number.strip()
        self.shipped_by = self.shipped_by.strip()
        errors: dict[str, str] = {}
        if not self.shipment_number:
            errors["shipment_number"] = "Shipment number cannot be blank."
        if not self.shipped_by:
            errors["shipped_by"] = "Shipped by cannot be blank."
        if self.sales_order.organization_id != self.organization_id:
            errors["sales_order"] = "Shipment order must belong to the same organization."
        if self.warehouse.organization_id != self.organization_id or self.warehouse_id != self.sales_order.warehouse_id:
            errors["warehouse"] = "Shipment warehouse must match the sales order warehouse."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)


class ShipmentLine(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="shipment_lines",
    )
    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    sales_order_line = models.ForeignKey(
        SalesOrderLine,
        on_delete=models.CASCADE,
        related_name="shipment_lines",
    )
    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
    )
    inventory_movement = models.ForeignKey(
        InventoryMovement,
        on_delete=models.SET_NULL,
        related_name="shipment_lines",
        blank=True,
        null=True,
    )
    create_time = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("organization_id", "shipment_id", "sales_order_line_id", "id")

    def clean(self) -> None:
        super().clean()
        errors: dict[str, str] = {}
        if self.shipment.organization_id != self.organization_id:
            errors["shipment"] = "Shipment must belong to the same organization."
        if self.sales_order_line.organization_id != self.organization_id:
            errors["sales_order_line"] = "Shipment line must belong to the same organization."
        if self.shipment.sales_order_id != self.sales_order_line.sales_order_id:
            errors["sales_order_line"] = "Shipment line must belong to the shipment sales order."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)
