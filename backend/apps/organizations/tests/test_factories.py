from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType

from apps.accounts.models import User
from apps.iam.models import Role, RoleAssignment, RolePermission
from apps.organizations.models import MembershipType, Organization, OrganizationMembership
from apps.partners.models import CustomerAccount


def make_user(email, password="testpass123", **extra):
    user = User.objects.create_user(
        email=email,
        password=password,
        full_name=extra.pop("full_name", "Test User"),
        **extra,
    )
    return user


def make_organization(name="Acme Inc", slug="acme"):
    return Organization.objects.create(name=name, slug=slug)


def add_membership(
    user,
    organization,
    membership_type=MembershipType.INTERNAL,
    *,
    is_active=True,
):
    return OrganizationMembership.objects.create(
        user=user,
        organization=organization,
        membership_type=membership_type,
        is_active=is_active,
    )


def make_permission(codename, *, app_label="iam", model="organizationmembership", name=None):
    content_type, _ = ContentType.objects.get_or_create(
        app_label=app_label,
        model=model,
    )
    permission, _ = Permission.objects.get_or_create(
        codename=codename,
        content_type=content_type,
        defaults={"name": name or codename.replace("_", " ").title()},
    )
    return permission


def make_role(
    code,
    *,
    name=None,
    organization=None,
    membership_type=MembershipType.INTERNAL,
    is_system=True,
):
    return Role.objects.create(
        code=code,
        name=name or code.replace("_", " ").title(),
        organization=organization,
        membership_type=membership_type,
        is_system=is_system,
    )


def grant_role_permission(role, permission):
    return RolePermission.objects.create(role=role, permission=permission)


def assign_role(membership, role, *, scope=None):
    return RoleAssignment.objects.create(membership=membership, role=role, scope=scope)


def make_customer_account(
    organization,
    *,
    name="Acme Retail",
    code="ACM-1",
    billing_email="billing@example.com",
):
    return CustomerAccount.objects.create(
        organization=organization,
        name=name,
        code=code,
        billing_email=billing_email,
    )
