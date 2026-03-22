from __future__ import annotations

from dataclasses import dataclass

from apps.iam.models import AccessScope, Role, RoleAssignment
from apps.organizations.models import MembershipType, Organization, OrganizationMembership
from apps.partners.models import ClientAccountAccess, CustomerAccount


CUSTOMER_ACCOUNT_RESOURCE_TYPE = "customer_account"


@dataclass(frozen=True, slots=True)
class CreateCustomerAccountInput:
    organization: Organization
    name: str
    code: str
    contact_name: str = ""
    contact_email: str = ""
    contact_phone: str = ""
    billing_email: str = ""
    shipping_method: str = ""
    allow_dropshipping_orders: bool = True
    allow_inbound_goods: bool = True
    notes: str = ""
    is_active: bool = True


def create_customer_account(payload: CreateCustomerAccountInput) -> CustomerAccount:
    account = CustomerAccount(
        organization=payload.organization,
        name=payload.name,
        code=payload.code,
        contact_name=payload.contact_name,
        contact_email=payload.contact_email,
        contact_phone=payload.contact_phone,
        billing_email=payload.billing_email,
        shipping_method=payload.shipping_method,
        allow_dropshipping_orders=payload.allow_dropshipping_orders,
        allow_inbound_goods=payload.allow_inbound_goods,
        notes=payload.notes,
        is_active=payload.is_active,
    )
    account.save()
    return account


def update_customer_account(
    account: CustomerAccount,
    *,
    name: str | None = None,
    code: str | None = None,
    contact_name: str | None = None,
    contact_email: str | None = None,
    contact_phone: str | None = None,
    billing_email: str | None = None,
    shipping_method: str | None = None,
    allow_dropshipping_orders: bool | None = None,
    allow_inbound_goods: bool | None = None,
    notes: str | None = None,
    is_active: bool | None = None,
) -> CustomerAccount:
    if name is not None:
        account.name = name
    if code is not None:
        account.code = code
    if contact_name is not None:
        account.contact_name = contact_name
    if contact_email is not None:
        account.contact_email = contact_email
    if contact_phone is not None:
        account.contact_phone = contact_phone
    if billing_email is not None:
        account.billing_email = billing_email
    if shipping_method is not None:
        account.shipping_method = shipping_method
    if allow_dropshipping_orders is not None:
        account.allow_dropshipping_orders = allow_dropshipping_orders
    if allow_inbound_goods is not None:
        account.allow_inbound_goods = allow_inbound_goods
    if notes is not None:
        account.notes = notes
    if is_active is not None:
        account.is_active = is_active
    account.save()
    return account


def get_customer_account_scope(customer_account: CustomerAccount) -> AccessScope:
    scope, _ = AccessScope.objects.get_or_create(
        organization=customer_account.organization,
        scope_type=AccessScope.ScopeType.RESOURCE,
        resource_type=CUSTOMER_ACCOUNT_RESOURCE_TYPE,
        resource_key=str(customer_account.pk),
        defaults={"name": customer_account.name},
    )
    if scope.name != customer_account.name:
        scope.name = customer_account.name
        scope.save(update_fields=["name"])
    return scope


def grant_client_account_access(
    *,
    membership: OrganizationMembership,
    customer_account: CustomerAccount,
    role_code: str = Role.SystemCode.CLIENT_USER,
) -> ClientAccountAccess:
    if membership.membership_type != MembershipType.CLIENT:
        raise ValueError("Only client memberships can receive customer account access.")
    if membership.organization_id != customer_account.organization_id:
        raise ValueError("Membership and customer account must belong to the same organization.")

    access, _ = ClientAccountAccess.objects.get_or_create(
        membership=membership,
        customer_account=customer_account,
        defaults={"is_active": True},
    )
    if not access.is_active:
        access.is_active = True
        access.save(update_fields=["is_active"])

    scope = get_customer_account_scope(customer_account)
    role = Role.objects.filter(
        code=role_code,
        is_active=True,
    ).filter(
        organization__isnull=True,
    ).first() or Role.objects.filter(
        organization=customer_account.organization,
        code=role_code,
        is_active=True,
    ).first()
    if role is None:
        raise ValueError(f"Role '{role_code}' does not exist.")
    if role.membership_type != MembershipType.CLIENT:
        raise ValueError("Only client roles can be assigned to customer account access.")

    RoleAssignment.objects.get_or_create(
        membership=membership,
        role=role,
        scope=scope,
    )
    return access


def list_visible_customer_accounts(membership: OrganizationMembership) -> list[CustomerAccount]:
    if membership.membership_type == MembershipType.CLIENT:
        queryset = CustomerAccount.objects.filter(
            organization=membership.organization,
            client_accesses__membership=membership,
            client_accesses__is_active=True,
            is_active=True,
        )
    else:
        queryset = CustomerAccount.objects.filter(
            organization=membership.organization,
            is_active=True,
        )
    return list(queryset.order_by("name", "id").distinct())
