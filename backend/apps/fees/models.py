from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.organizations.models import Organization
from apps.partners.models import CustomerAccount
from apps.warehouse.models import Warehouse


class OrganizationScopedFeeModel(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class BalanceTransaction(OrganizationScopedFeeModel):
    class TransactionType(models.TextChoices):
        RECHARGE = "RECHARGE", "Recharge"
        DEDUCTION = "DEDUCTION", "Deduction"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PENDING_REVIEW = "PENDING_REVIEW", "Pending review"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        POSTED = "POSTED", "Posted"

    customer_account = models.ForeignKey(
        CustomerAccount,
        on_delete=models.SET_NULL,
        related_name="balance_transactions",
        null=True,
        blank=True,
    )
    voucher = models.ForeignKey(
        "Voucher",
        on_delete=models.SET_NULL,
        related_name="balance_transactions",
        null=True,
        blank=True,
    )
    transaction_type = models.CharField(
        max_length=20,
        choices=TransactionType.choices,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING_REVIEW,
    )
    reference_code = models.CharField(max_length=100, blank=True, default="")
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    currency = models.CharField(max_length=8, blank=True, default="USD")
    requested_by_name = models.CharField(max_length=255, blank=True, default="")
    reviewed_by_name = models.CharField(max_length=255, blank=True, default="")
    requested_at = models.DateTimeField(default=timezone.now)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("organization_id", "-requested_at", "-id")
        permissions = [
            ("view_fees", "Can view fees"),
            ("manage_balance_transactions", "Can manage balance transactions"),
            ("review_balance_transactions", "Can review balance transactions"),
        ]

    def clean(self) -> None:
        super().clean()
        self.reference_code = self.reference_code.strip().upper()
        self.currency = self.currency.strip().upper() or "USD"
        self.requested_by_name = self.requested_by_name.strip()
        self.reviewed_by_name = self.reviewed_by_name.strip()
        self.notes = self.notes.strip()

        errors: dict[str, str] = {}
        if self.amount <= Decimal("0.00"):
            errors["amount"] = "Amount must be greater than zero."
        if self.customer_account_id and self.customer_account.organization_id != self.organization_id:
            errors["customer_account"] = "Customer account must belong to the same organization."
        if self.voucher_id and self.voucher.organization_id != self.organization_id:
            errors["voucher"] = "Voucher must belong to the same organization."
        if self.reviewed_at and self.reviewed_at < self.requested_at:
            errors["reviewed_at"] = "Reviewed time cannot be earlier than requested time."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.reference_code or f"{self.transaction_type}-{self.id}"


class Voucher(OrganizationScopedFeeModel):
    class VoucherType(models.TextChoices):
        RECHARGE = "RECHARGE", "Recharge"
        DEDUCTION = "DEDUCTION", "Deduction"
        CREDIT = "CREDIT", "Credit"
        ADJUSTMENT = "ADJUSTMENT", "Adjustment"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        ACTIVE = "ACTIVE", "Active"
        REDEEMED = "REDEEMED", "Redeemed"
        EXPIRED = "EXPIRED", "Expired"
        VOID = "VOID", "Void"

    customer_account = models.ForeignKey(
        CustomerAccount,
        on_delete=models.SET_NULL,
        related_name="vouchers",
        null=True,
        blank=True,
    )
    code = models.CharField(max_length=64)
    voucher_type = models.CharField(
        max_length=20,
        choices=VoucherType.choices,
        default=VoucherType.CREDIT,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    face_value = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    remaining_value = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    currency = models.CharField(max_length=8, blank=True, default="USD")
    valid_from = models.DateField(default=timezone.localdate)
    expires_on = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("organization_id", "code", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "code"),
                name="unique_voucher_code_per_organization",
            ),
        ]
        permissions = [
            ("manage_vouchers", "Can manage vouchers"),
        ]

    def clean(self) -> None:
        super().clean()
        self.code = self.code.strip().upper()
        self.currency = self.currency.strip().upper() or "USD"
        self.notes = self.notes.strip()
        if not self.code:
            raise ValidationError({"code": "Voucher code cannot be blank."})
        if self.face_value <= Decimal("0.00"):
            raise ValidationError({"face_value": "Face value must be greater than zero."})
        if self.remaining_value < Decimal("0.00"):
            raise ValidationError({"remaining_value": "Remaining value cannot be negative."})
        if self.remaining_value > self.face_value:
            raise ValidationError({"remaining_value": "Remaining value cannot exceed face value."})
        if self.customer_account_id and self.customer_account.organization_id != self.organization_id:
            raise ValidationError({"customer_account": "Customer account must belong to the same organization."})
        if self.expires_on and self.expires_on < self.valid_from:
            raise ValidationError({"expires_on": "Expiry date cannot be earlier than the valid-from date."})

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self.pk is None and self.remaining_value == Decimal("0.00") and self.face_value > Decimal("0.00"):
            self.remaining_value = self.face_value
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.code


class ChargeItem(OrganizationScopedFeeModel):
    class Category(models.TextChoices):
        STORAGE = "STORAGE", "Storage"
        HANDLING = "HANDLING", "Handling"
        RECHARGE = "RECHARGE", "Recharge"
        DEDUCTION = "DEDUCTION", "Deduction"
        RENT = "RENT", "Rent"
        LOGISTICS = "LOGISTICS", "Logistics"
        MANUAL = "MANUAL", "Manual"
        OTHER = "OTHER", "Other"

    class BillingBasis(models.TextChoices):
        FLAT = "FLAT", "Flat"
        QUANTITY = "QUANTITY", "Quantity"
        PER_DAY = "PER_DAY", "Per day"
        PER_MONTH = "PER_MONTH", "Per month"
        PER_ORDER = "PER_ORDER", "Per order"
        PER_PALLET = "PER_PALLET", "Per pallet"

    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.OTHER,
    )
    billing_basis = models.CharField(
        max_length=20,
        choices=BillingBasis.choices,
        default=BillingBasis.FLAT,
    )
    default_unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    currency = models.CharField(max_length=8, blank=True, default="USD")
    unit_label = models.CharField(max_length=50, blank=True, default="")
    is_taxable = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("organization_id", "category", "name", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "code"),
                name="unique_charge_item_code_per_organization",
            ),
        ]
        permissions = [
            ("manage_charge_catalog", "Can manage charge items and templates"),
        ]

    def clean(self) -> None:
        super().clean()
        self.code = self.code.strip().upper()
        self.name = self.name.strip()
        self.currency = self.currency.strip().upper() or "USD"
        self.unit_label = self.unit_label.strip()
        self.notes = self.notes.strip()

        errors: dict[str, str] = {}
        if not self.code:
            errors["code"] = "Charge item code cannot be blank."
        if not self.name:
            errors["name"] = "Charge item name cannot be blank."
        if self.default_unit_price < Decimal("0.00"):
            errors["default_unit_price"] = "Default unit price cannot be negative."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.code


class ChargeTemplate(OrganizationScopedFeeModel):
    charge_item = models.ForeignKey(
        ChargeItem,
        on_delete=models.PROTECT,
        related_name="templates",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.SET_NULL,
        related_name="charge_templates",
        null=True,
        blank=True,
    )
    customer_account = models.ForeignKey(
        CustomerAccount,
        on_delete=models.SET_NULL,
        related_name="charge_templates",
        null=True,
        blank=True,
    )
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    default_quantity = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("1.00"))
    default_unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    currency = models.CharField(max_length=8, blank=True, default="USD")
    notes = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("organization_id", "name", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "code"),
                name="unique_charge_template_code_per_organization",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        self.code = self.code.strip().upper()
        self.name = self.name.strip()
        self.currency = self.currency.strip().upper() or "USD"
        self.notes = self.notes.strip()

        errors: dict[str, str] = {}
        if not self.code:
            errors["code"] = "Charge template code cannot be blank."
        if not self.name:
            errors["name"] = "Charge template name cannot be blank."
        if self.default_quantity <= Decimal("0.00"):
            errors["default_quantity"] = "Default quantity must be greater than zero."
        if self.default_unit_price < Decimal("0.00"):
            errors["default_unit_price"] = "Default unit price cannot be negative."
        if self.charge_item.organization_id != self.organization_id:
            errors["charge_item"] = "Charge item must belong to the same organization."
        if self.warehouse_id and self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization."
        if self.customer_account_id and self.customer_account.organization_id != self.organization_id:
            errors["customer_account"] = "Customer account must belong to the same organization."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.code


class ManualCharge(OrganizationScopedFeeModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PENDING_REVIEW = "PENDING_REVIEW", "Pending review"
        APPROVED = "APPROVED", "Approved"
        POSTED = "POSTED", "Posted"
        VOID = "VOID", "Void"

    customer_account = models.ForeignKey(
        CustomerAccount,
        on_delete=models.SET_NULL,
        related_name="manual_charges",
        null=True,
        blank=True,
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.SET_NULL,
        related_name="manual_charges",
        null=True,
        blank=True,
    )
    charge_item = models.ForeignKey(
        ChargeItem,
        on_delete=models.SET_NULL,
        related_name="manual_charges",
        null=True,
        blank=True,
    )
    charge_template = models.ForeignKey(
        ChargeTemplate,
        on_delete=models.SET_NULL,
        related_name="manual_charges",
        null=True,
        blank=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING_REVIEW,
    )
    source_reference = models.CharField(max_length=100, blank=True, default="")
    description = models.CharField(max_length=255, blank=True, default="")
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("1.00"))
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    currency = models.CharField(max_length=8, blank=True, default="USD")
    charged_at = models.DateTimeField(default=timezone.now)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("organization_id", "-charged_at", "-id")
        permissions = [
            ("manage_manual_charges", "Can manage manual charges"),
        ]

    def clean(self) -> None:
        super().clean()
        self.source_reference = self.source_reference.strip().upper()
        self.description = self.description.strip()
        self.currency = self.currency.strip().upper() or "USD"
        self.notes = self.notes.strip()
        self.amount = self.quantity * self.unit_price

        errors: dict[str, str] = {}
        if self.quantity <= Decimal("0.00"):
            errors["quantity"] = "Quantity must be greater than zero."
        if self.unit_price < Decimal("0.00"):
            errors["unit_price"] = "Unit price cannot be negative."
        if self.customer_account_id and self.customer_account.organization_id != self.organization_id:
            errors["customer_account"] = "Customer account must belong to the same organization."
        if self.warehouse_id and self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization."
        if self.charge_item_id and self.charge_item.organization_id != self.organization_id:
            errors["charge_item"] = "Charge item must belong to the same organization."
        if self.charge_template_id and self.charge_template.organization_id != self.organization_id:
            errors["charge_template"] = "Charge template must belong to the same organization."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.source_reference or f"manual-charge-{self.id}"


class FundFlow(OrganizationScopedFeeModel):
    class FlowType(models.TextChoices):
        INBOUND = "INBOUND", "Inbound"
        OUTBOUND = "OUTBOUND", "Outbound"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        POSTED = "POSTED", "Posted"
        REVERSED = "REVERSED", "Reversed"

    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.SET_NULL,
        related_name="fund_flows",
        null=True,
        blank=True,
    )
    customer_account = models.ForeignKey(
        CustomerAccount,
        on_delete=models.SET_NULL,
        related_name="fund_flows",
        null=True,
        blank=True,
    )
    flow_type = models.CharField(
        max_length=20,
        choices=FlowType.choices,
        default=FlowType.INBOUND,
    )
    source_type = models.CharField(max_length=50, blank=True, default="")
    reference_code = models.CharField(max_length=100, blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.POSTED,
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    currency = models.CharField(max_length=8, blank=True, default="USD")
    occurred_at = models.DateTimeField(default=timezone.now)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("organization_id", "-occurred_at", "-id")
        permissions = [
            ("manage_fund_flows", "Can manage fund flows"),
        ]

    def clean(self) -> None:
        super().clean()
        self.source_type = self.source_type.strip().upper()
        self.reference_code = self.reference_code.strip().upper()
        self.currency = self.currency.strip().upper() or "USD"
        self.notes = self.notes.strip()

        errors: dict[str, str] = {}
        if self.amount <= Decimal("0.00"):
            errors["amount"] = "Amount must be greater than zero."
        if self.warehouse_id and self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization."
        if self.customer_account_id and self.customer_account.organization_id != self.organization_id:
            errors["customer_account"] = "Customer account must belong to the same organization."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.reference_code or f"fund-flow-{self.id}"


class RentDetail(OrganizationScopedFeeModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        ACCRUED = "ACCRUED", "Accrued"
        BILLED = "BILLED", "Billed"

    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="rent_details",
    )
    customer_account = models.ForeignKey(
        CustomerAccount,
        on_delete=models.SET_NULL,
        related_name="rent_details",
        null=True,
        blank=True,
    )
    period_start = models.DateField()
    period_end = models.DateField()
    pallet_positions = models.PositiveIntegerField(default=0)
    bin_positions = models.PositiveIntegerField(default=0)
    area_sqm = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    currency = models.CharField(max_length=8, blank=True, default="USD")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("organization_id", "-period_start", "-id")
        permissions = [
            ("manage_rent_details", "Can manage rent details"),
        ]

    def clean(self) -> None:
        super().clean()
        self.currency = self.currency.strip().upper() or "USD"
        self.notes = self.notes.strip()

        errors: dict[str, str] = {}
        if self.period_end < self.period_start:
            errors["period_end"] = "Period end cannot be earlier than period start."
        if self.amount < Decimal("0.00"):
            errors["amount"] = "Amount cannot be negative."
        if self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization."
        if self.customer_account_id and self.customer_account.organization_id != self.organization_id:
            errors["customer_account"] = "Customer account must belong to the same organization."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"rent-{self.warehouse_id}-{self.period_start}"


class BusinessExpense(OrganizationScopedFeeModel):
    class Category(models.TextChoices):
        RENT = "RENT", "Rent"
        UTILITIES = "UTILITIES", "Utilities"
        LABOR = "LABOR", "Labor"
        LOGISTICS = "LOGISTICS", "Logistics"
        SUPPLIES = "SUPPLIES", "Supplies"
        OTHER = "OTHER", "Other"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PENDING_REVIEW = "PENDING_REVIEW", "Pending review"
        APPROVED = "APPROVED", "Approved"
        POSTED = "POSTED", "Posted"
        VOID = "VOID", "Void"

    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.SET_NULL,
        related_name="business_expenses",
        null=True,
        blank=True,
    )
    vendor_name = models.CharField(max_length=255, blank=True, default="")
    expense_category = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.OTHER,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING_REVIEW,
    )
    expense_date = models.DateField(default=timezone.localdate)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    currency = models.CharField(max_length=8, blank=True, default="USD")
    reference_code = models.CharField(max_length=100, blank=True, default="")
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("organization_id", "-expense_date", "-id")
        permissions = [
            ("manage_business_expenses", "Can manage business expenses"),
        ]

    def clean(self) -> None:
        super().clean()
        self.vendor_name = self.vendor_name.strip()
        self.currency = self.currency.strip().upper() or "USD"
        self.reference_code = self.reference_code.strip().upper()
        self.notes = self.notes.strip()

        errors: dict[str, str] = {}
        if self.amount <= Decimal("0.00"):
            errors["amount"] = "Amount must be greater than zero."
        if self.warehouse_id and self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.reference_code or f"expense-{self.id}"


class ReceivableBill(OrganizationScopedFeeModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        OPEN = "OPEN", "Open"
        PARTIALLY_PAID = "PARTIALLY_PAID", "Partially paid"
        PAID = "PAID", "Paid"
        VOID = "VOID", "Void"

    customer_account = models.ForeignKey(
        CustomerAccount,
        on_delete=models.SET_NULL,
        related_name="receivable_bills",
        null=True,
        blank=True,
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.SET_NULL,
        related_name="receivable_bills",
        null=True,
        blank=True,
    )
    bill_number = models.CharField(max_length=64)
    period_start = models.DateField()
    period_end = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    subtotal_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    adjustment_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    currency = models.CharField(max_length=8, blank=True, default="USD")
    due_at = models.DateTimeField(null=True, blank=True)
    issued_at = models.DateTimeField(default=timezone.now)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("organization_id", "-issued_at", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "bill_number"),
                name="unique_receivable_bill_number_per_organization",
            ),
        ]
        permissions = [
            ("manage_receivable_bills", "Can manage receivable bills"),
        ]

    def clean(self) -> None:
        super().clean()
        self.bill_number = self.bill_number.strip().upper()
        self.currency = self.currency.strip().upper() or "USD"
        self.notes = self.notes.strip()
        self.total_amount = self.subtotal_amount + self.adjustment_amount

        errors: dict[str, str] = {}
        if not self.bill_number:
            errors["bill_number"] = "Bill number cannot be blank."
        if self.period_end < self.period_start:
            errors["period_end"] = "Period end cannot be earlier than period start."
        if self.customer_account_id and self.customer_account.organization_id != self.organization_id:
            errors["customer_account"] = "Customer account must belong to the same organization."
        if self.warehouse_id and self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.bill_number


class ProfitCalculation(OrganizationScopedFeeModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        FINALIZED = "FINALIZED", "Finalized"

    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.SET_NULL,
        related_name="profit_calculations",
        null=True,
        blank=True,
    )
    customer_account = models.ForeignKey(
        CustomerAccount,
        on_delete=models.SET_NULL,
        related_name="profit_calculations",
        null=True,
        blank=True,
    )
    period_start = models.DateField()
    period_end = models.DateField()
    revenue_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    expense_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    recharge_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    deduction_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    receivable_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    profit_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    margin_percent = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    generated_at = models.DateTimeField(default=timezone.now)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("organization_id", "-period_start", "-id")
        permissions = [
            ("manage_profit_calculations", "Can manage profit calculations"),
        ]

    def clean(self) -> None:
        super().clean()
        self.notes = self.notes.strip()
        self.profit_amount = self.revenue_amount + self.recharge_amount - self.deduction_amount - self.expense_amount
        if self.revenue_amount > Decimal("0.00"):
            self.margin_percent = (self.profit_amount / self.revenue_amount) * Decimal("100.00")
        else:
            self.margin_percent = Decimal("0.00")

        errors: dict[str, str] = {}
        if self.period_end < self.period_start:
            errors["period_end"] = "Period end cannot be earlier than period start."
        if self.warehouse_id and self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization."
        if self.customer_account_id and self.customer_account.organization_id != self.organization_id:
            errors["customer_account"] = "Customer account must belong to the same organization."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"profit-{self.period_start}"
