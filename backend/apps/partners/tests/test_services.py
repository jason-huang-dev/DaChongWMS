from __future__ import annotations

from django.test import TestCase

from apps.iam.models import Role
from apps.organizations.models import MembershipType
from apps.organizations.tests.test_factories import add_membership, make_organization, make_role, make_user
from apps.partners.services.customer_accounts import (
    CreateCustomerAccountInput,
    create_customer_account,
    get_customer_account_scope,
    grant_client_account_access,
)


class CustomerAccountServiceTests(TestCase):
    def test_create_customer_account_normalizes_code(self) -> None:
        account = create_customer_account(
            CreateCustomerAccountInput(
                organization=make_organization(),
                name="Acme Retail",
                code=" acm-1 ",
                contact_email=" SALES@acme.example ",
            )
        )
        self.assertEqual(account.code, "ACM-1")
        self.assertEqual(account.contact_email, "sales@acme.example")

    def test_grant_client_account_access_creates_scope_and_role_assignment(self) -> None:
        organization = make_organization()
        account = create_customer_account(
            CreateCustomerAccountInput(
                organization=organization,
                name="Acme Retail",
                code="ACM-1",
            )
        )
        membership = add_membership(
            make_user("client@example.com"),
            organization,
            membership_type=MembershipType.CLIENT,
        )
        make_role(Role.SystemCode.CLIENT_USER, membership_type=MembershipType.CLIENT)

        access = grant_client_account_access(
            membership=membership,
            customer_account=account,
        )

        scope = get_customer_account_scope(account)
        self.assertEqual(access.customer_account, account)
        self.assertTrue(
            membership.role_assignments.filter(
                role__code=Role.SystemCode.CLIENT_USER,
                scope=scope,
            ).exists()
        )
