"""Inventory state and audit models."""

from __future__ import annotations

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import F, Q
from django.utils import timezone

from catalog.goods.models import ListModel as Goods
from locations.models import Location
from warehouse.models import Warehouse


class TenantAuditModel(models.Model):
    creator = models.CharField(max_length=255, default="system", verbose_name="Created By")
    openid = models.CharField(max_length=255, verbose_name="Openid", db_index=True)
    is_delete = models.BooleanField(default=False, verbose_name="Delete Label")
    create_time = models.DateTimeField(auto_now_add=True, verbose_name="Create Time")
    update_time = models.DateTimeField(auto_now=True, verbose_name="Update Time")

    class Meta:
        abstract = True


class InventoryStatus(models.TextChoices):
    AVAILABLE = "AVAILABLE", "Available"
    QUARANTINE = "QUARANTINE", "Quarantine"
    DAMAGED = "DAMAGED", "Damaged"


class MovementType(models.TextChoices):
    OPENING = "OPENING", "Opening Balance"
    RECEIPT = "RECEIPT", "Receipt"
    PUTAWAY = "PUTAWAY", "Putaway"
    TRANSFER = "TRANSFER", "Transfer"
    PICK = "PICK", "Pick"
    SHIP = "SHIP", "Ship"
    ADJUSTMENT_IN = "ADJUSTMENT_IN", "Adjustment In"
    ADJUSTMENT_OUT = "ADJUSTMENT_OUT", "Adjustment Out"
    HOLD = "HOLD", "Hold"
    RELEASE_HOLD = "RELEASE_HOLD", "Release Hold"


class InventoryBalance(TenantAuditModel):
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.PROTECT,
        related_name="inventory_balances",
        verbose_name="Warehouse",
    )
    location = models.ForeignKey(
        Location,
        on_delete=models.PROTECT,
        related_name="inventory_balances",
        verbose_name="Location",
    )
    goods = models.ForeignKey(
        Goods,
        on_delete=models.PROTECT,
        related_name="inventory_balances",
        verbose_name="Goods",
    )
    stock_status = models.CharField(
        max_length=32,
        choices=InventoryStatus.choices,
        default=InventoryStatus.AVAILABLE,
        verbose_name="Stock Status",
    )
    lot_number = models.CharField(max_length=64, blank=True, default="", verbose_name="Lot Number")
    serial_number = models.CharField(max_length=64, blank=True, default="", verbose_name="Serial Number")
    on_hand_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="On Hand Qty",
    )
    allocated_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Allocated Qty",
    )
    hold_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Hold Qty",
    )
    unit_cost = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Unit Cost",
    )
    currency = models.CharField(max_length=8, default="USD", verbose_name="Currency")
    last_movement_at = models.DateTimeField(blank=True, null=True, verbose_name="Last Movement At")

    class Meta:
        db_table = "inventory_balance"
        verbose_name = "Inventory Balance"
        verbose_name_plural = "Inventory Balances"
        ordering = ["warehouse_id", "location_id", "goods_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "location", "goods", "lot_number", "serial_number", "stock_status"],
                condition=Q(is_delete=False),
                name="inv_balance_uq",
            ),
            models.CheckConstraint(
                condition=Q(on_hand_qty__gte=F("allocated_qty")),
                name="inv_on_hand_gte_alloc",
            ),
            models.CheckConstraint(
                condition=Q(on_hand_qty__gte=F("hold_qty")),
                name="inv_on_hand_gte_hold",
            ),
        ]

    @property
    def available_qty(self) -> Decimal:
        return self.on_hand_qty - self.allocated_qty - self.hold_qty

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.goods.goods_code} @ {self.location.location_code}"


class InventoryMovement(TenantAuditModel):
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.PROTECT,
        related_name="inventory_movements",
        verbose_name="Warehouse",
    )
    goods = models.ForeignKey(
        Goods,
        on_delete=models.PROTECT,
        related_name="inventory_movements",
        verbose_name="Goods",
    )
    from_location = models.ForeignKey(
        Location,
        on_delete=models.PROTECT,
        related_name="inventory_movements_out",
        verbose_name="From Location",
        blank=True,
        null=True,
    )
    to_location = models.ForeignKey(
        Location,
        on_delete=models.PROTECT,
        related_name="inventory_movements_in",
        verbose_name="To Location",
        blank=True,
        null=True,
    )
    movement_type = models.CharField(
        max_length=32,
        choices=MovementType.choices,
        verbose_name="Movement Type",
    )
    stock_status = models.CharField(
        max_length=32,
        choices=InventoryStatus.choices,
        default=InventoryStatus.AVAILABLE,
        verbose_name="Stock Status",
    )
    lot_number = models.CharField(max_length=64, blank=True, default="", verbose_name="Lot Number")
    serial_number = models.CharField(max_length=64, blank=True, default="", verbose_name="Serial Number")
    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        verbose_name="Quantity",
    )
    unit_cost = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Unit Cost",
    )
    reference_code = models.CharField(max_length=64, blank=True, default="", verbose_name="Reference Code")
    reason = models.CharField(max_length=255, blank=True, default="", verbose_name="Reason")
    performed_by = models.CharField(max_length=255, verbose_name="Performed By")
    occurred_at = models.DateTimeField(default=timezone.now, verbose_name="Occurred At")
    resulting_from_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        blank=True,
        null=True,
        verbose_name="Resulting From Qty",
    )
    resulting_to_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        blank=True,
        null=True,
        verbose_name="Resulting To Qty",
    )

    class Meta:
        db_table = "inventory_movement"
        verbose_name = "Inventory Movement"
        verbose_name_plural = "Inventory Movements"
        ordering = ["-occurred_at", "-id"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.movement_type} {self.goods.goods_code} {self.quantity}"


class InventoryHold(TenantAuditModel):
    inventory_balance = models.ForeignKey(
        InventoryBalance,
        on_delete=models.PROTECT,
        related_name="holds",
        verbose_name="Inventory Balance",
    )
    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        verbose_name="Quantity",
    )
    reason = models.CharField(max_length=255, verbose_name="Reason")
    reference_code = models.CharField(max_length=64, blank=True, default="", verbose_name="Reference Code")
    notes = models.TextField(blank=True, default="", verbose_name="Notes")
    held_by = models.CharField(max_length=255, verbose_name="Held By")
    released_by = models.CharField(max_length=255, blank=True, default="", verbose_name="Released By")
    released_at = models.DateTimeField(blank=True, null=True, verbose_name="Released At")
    is_active = models.BooleanField(default=True, verbose_name="Is Active")

    class Meta:
        db_table = "inventory_hold"
        verbose_name = "Inventory Hold"
        verbose_name_plural = "Inventory Holds"
        ordering = ["-create_time", "-id"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.inventory_balance.goods.goods_code} hold {self.quantity}"
