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
from apps.organizations.models import Organization
from apps.outbound.models import SalesOrder
from apps.partners.models import CustomerAccount
from apps.products.models import Product
from apps.warehouse.models import Warehouse


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


class ReturnOrder(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="return_orders",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="return_orders",
    )
    customer_account = models.ForeignKey(
        CustomerAccount,
        on_delete=models.CASCADE,
        related_name="return_orders",
    )
    sales_order = models.ForeignKey(
        SalesOrder,
        on_delete=models.SET_NULL,
        related_name="return_orders",
        blank=True,
        null=True,
    )
    order_type = models.CharField(
        max_length=32,
        choices=OperationOrderType.choices,
        default=OperationOrderType.STANDARD,
    )
    return_number = models.CharField(max_length=64)
    customer_code = models.CharField(max_length=64, blank=True, default="")
    customer_name = models.CharField(max_length=255, blank=True, default="")
    customer_contact_name = models.CharField(max_length=255, blank=True, default="")
    customer_contact_email = models.EmailField(blank=True, default="")
    customer_contact_phone = models.CharField(max_length=64, blank=True, default="")
    requested_date = models.DateField(blank=True, null=True)
    reference_code = models.CharField(max_length=64, blank=True, default="")
    status = models.CharField(
        max_length=32,
        choices=ReturnOrderStatus.choices,
        default=ReturnOrderStatus.OPEN,
    )
    notes = models.TextField(blank=True, default="")
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization_id", "-create_time", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "return_number"),
                name="unique_return_number_per_organization",
            ),
        ]
        permissions = [
            ("view_returns", "Can view returns operations"),
            ("manage_return_orders", "Can manage return orders"),
            ("manage_return_execution", "Can manage return execution"),
        ]

    def clean(self) -> None:
        super().clean()
        self.return_number = self.return_number.strip().upper()
        self.customer_code = self.customer_code.strip().upper()
        self.customer_name = self.customer_name.strip()
        self.customer_contact_name = self.customer_contact_name.strip()
        self.customer_contact_email = self.customer_contact_email.strip().lower()
        self.customer_contact_phone = self.customer_contact_phone.strip()
        self.reference_code = self.reference_code.strip()
        self.notes = self.notes.strip()

        errors: dict[str, str] = {}
        if not self.return_number:
            errors["return_number"] = "Return number cannot be blank."
        if self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization as the return order."
        if self.customer_account.organization_id != self.organization_id:
            errors["customer_account"] = "Customer account must belong to the same organization as the return order."
        if not self.customer_code or not self.customer_name:
            errors["customer_account"] = "Return orders must carry customer account snapshot information."
        if self.sales_order is not None:
            if self.sales_order.organization_id != self.organization_id:
                errors["sales_order"] = "Sales order must belong to the same organization as the return order."
            if self.sales_order.warehouse_id != self.warehouse_id:
                errors["sales_order"] = "Sales order warehouse must match the return order warehouse."
            if self.sales_order.customer_account_id != self.customer_account_id:
                errors["sales_order"] = "Sales order customer account must match the return order customer account."
            if self.sales_order.order_type != self.order_type:
                errors["order_type"] = "Return order type must match the linked sales order type."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)


class ReturnLine(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="return_lines",
    )
    return_order = models.ForeignKey(
        ReturnOrder,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    line_number = models.PositiveIntegerField()
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="return_lines",
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
    disposed_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    return_reason = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=32,
        choices=ReturnLineStatus.choices,
        default=ReturnLineStatus.OPEN,
    )
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization_id", "return_order_id", "line_number", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("return_order", "line_number"),
                name="unique_return_line_number_per_order",
            ),
            models.CheckConstraint(
                condition=models.Q(expected_qty__gte=F("received_qty")),
                name="return_line_expected_gte_received",
            ),
            models.CheckConstraint(
                condition=models.Q(received_qty__gte=F("disposed_qty")),
                name="return_line_received_gte_disposed",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        self.return_reason = self.return_reason.strip()
        self.notes = self.notes.strip()
        errors: dict[str, str] = {}
        if self.return_order.organization_id != self.organization_id:
            errors["return_order"] = "Return order must belong to the same organization as the return line."
        if self.product.organization_id != self.organization_id:
            errors["product"] = "Product must belong to the same organization as the return line."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)


class ReturnReceipt(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="return_receipts",
    )
    return_line = models.ForeignKey(
        ReturnLine,
        on_delete=models.CASCADE,
        related_name="receipts",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="return_receipts",
    )
    receipt_location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name="return_receipts",
    )
    receipt_number = models.CharField(max_length=64)
    received_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
    )
    disposed_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    stock_status = models.CharField(
        max_length=32,
        choices=InventoryStatus.choices,
        default=InventoryStatus.QUARANTINE,
    )
    lot_number = models.CharField(max_length=64, blank=True, default="")
    serial_number = models.CharField(max_length=64, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    received_by = models.CharField(max_length=255)
    received_at = models.DateTimeField(default=timezone.now)
    inventory_movement = models.ForeignKey(
        InventoryMovement,
        on_delete=models.SET_NULL,
        related_name="return_receipts",
        blank=True,
        null=True,
    )
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization_id", "-received_at", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "receipt_number"),
                name="unique_return_receipt_number_per_organization",
            ),
            models.CheckConstraint(
                condition=models.Q(received_qty__gte=F("disposed_qty")),
                name="return_receipt_received_gte_disposed",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        self.receipt_number = self.receipt_number.strip().upper()
        self.lot_number = self.lot_number.strip()
        self.serial_number = self.serial_number.strip()
        self.notes = self.notes.strip()
        self.received_by = self.received_by.strip()
        errors: dict[str, str] = {}
        if not self.receipt_number:
            errors["receipt_number"] = "Receipt number cannot be blank."
        if not self.received_by:
            errors["received_by"] = "Received by cannot be blank."
        if self.return_line.organization_id != self.organization_id:
            errors["return_line"] = "Return line must belong to the same organization as the return receipt."
        if self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization as the return receipt."
        if self.warehouse_id != self.return_line.return_order.warehouse_id:
            errors["warehouse"] = "Receipt warehouse must match the return order warehouse."
        if self.receipt_location.organization_id != self.organization_id or self.receipt_location.warehouse_id != self.warehouse_id:
            errors["receipt_location"] = "Receipt location must belong to the same warehouse as the receipt."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)


class ReturnDisposition(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="return_dispositions",
    )
    return_receipt = models.ForeignKey(
        ReturnReceipt,
        on_delete=models.CASCADE,
        related_name="dispositions",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="return_dispositions",
    )
    disposition_number = models.CharField(max_length=64)
    disposition_type = models.CharField(
        max_length=32,
        choices=ReturnDispositionType.choices,
    )
    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
    )
    to_location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name="return_dispositions",
        blank=True,
        null=True,
    )
    notes = models.TextField(blank=True, default="")
    completed_by = models.CharField(max_length=255)
    completed_at = models.DateTimeField(default=timezone.now)
    inventory_movement = models.ForeignKey(
        InventoryMovement,
        on_delete=models.SET_NULL,
        related_name="return_dispositions",
        blank=True,
        null=True,
    )
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization_id", "-completed_at", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "disposition_number"),
                name="unique_return_disposition_number_per_organization",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        self.disposition_number = self.disposition_number.strip().upper()
        self.notes = self.notes.strip()
        self.completed_by = self.completed_by.strip()
        errors: dict[str, str] = {}
        if not self.disposition_number:
            errors["disposition_number"] = "Disposition number cannot be blank."
        if not self.completed_by:
            errors["completed_by"] = "Completed by cannot be blank."
        if self.return_receipt.organization_id != self.organization_id:
            errors["return_receipt"] = "Return receipt must belong to the same organization as the disposition."
        if self.warehouse.organization_id != self.organization_id or self.warehouse_id != self.return_receipt.warehouse_id:
            errors["warehouse"] = "Disposition warehouse must match the return receipt warehouse."
        if self.to_location is not None and (
            self.to_location.organization_id != self.organization_id or self.to_location.warehouse_id != self.warehouse_id
        ):
            errors["to_location"] = "Disposition destination must belong to the same warehouse."
        if self.disposition_type == ReturnDispositionType.SCRAP and self.to_location is not None:
            errors["to_location"] = "Scrap dispositions must not define a destination location."
        if self.disposition_type in {ReturnDispositionType.RESTOCK, ReturnDispositionType.QUARANTINE} and self.to_location is None:
            errors["to_location"] = "This disposition type requires a destination location."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

