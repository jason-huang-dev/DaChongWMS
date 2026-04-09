from __future__ import annotations

from typing import Any

from django.core.exceptions import ValidationError
from django.db import models

from apps.organizations.models import MembershipType, Organization, OrganizationMembership


class CustomerAccount(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="customer_accounts",
    )
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)
    contact_name = models.CharField(max_length=255, blank=True, default="")
    contact_email = models.EmailField(blank=True, default="")
    contact_phone = models.CharField(max_length=64, blank=True, default="")
    billing_email = models.EmailField(blank=True, default="")
    shipping_method = models.CharField(max_length=100, blank=True, default="")
    allow_dropshipping_orders = models.BooleanField(default=True)
    allow_inbound_goods = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization_id", "name", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "code"),
                name="unique_customer_account_code_per_organization",
            ),
        ]
        permissions = [
            ("manage_customer_accounts", "Can manage customer accounts"),
            ("manage_client_account_access", "Can manage client account access"),
            ("view_inventory", "Can view customer inventory"),
            ("view_orders", "Can view customer orders"),
            ("view_charges", "Can view customer charges"),
            ("submit_dropshipping_orders", "Can submit dropshipping orders for customer account"),
            ("submit_inbound_goods", "Can submit inbound goods for customer account"),
        ]

    def _normalize_values(self) -> None:
        self.name = self.name.strip()
        self.code = self.code.strip().upper()
        self.contact_name = self.contact_name.strip()
        self.contact_email = self.contact_email.strip().lower()
        self.contact_phone = self.contact_phone.strip()
        self.billing_email = self.billing_email.strip().lower()
        self.shipping_method = self.shipping_method.strip()
        self.notes = self.notes.strip()

    def clean(self) -> None:
        super().clean()
        self._normalize_values()
        if not self.code:
            raise ValidationError({"code": "Customer account code cannot be blank."})

    def save(self, *args: Any, **kwargs: Any) -> None:
        self._normalize_values()
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.organization} / {self.code}"


class ClientAccountAccess(models.Model):
    membership = models.ForeignKey(
        OrganizationMembership,
        on_delete=models.CASCADE,
        related_name="client_account_accesses",
    )
    customer_account = models.ForeignKey(
        CustomerAccount,
        on_delete=models.CASCADE,
        related_name="client_accesses",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("customer_account_id", "membership_id", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("membership", "customer_account"),
                name="unique_membership_customer_account_access",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        errors: dict[str, str] = {}
        if self.membership.membership_type != MembershipType.CLIENT:
            errors["membership"] = "Only client memberships can be linked to customer accounts."
        if self.membership.organization_id != self.customer_account.organization_id:
            errors["customer_account"] = "Customer account must belong to the same organization."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)
