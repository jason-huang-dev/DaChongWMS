from django.test import TestCase

from apps.organizations.models import MembershipType

from .test_factories import add_membership, make_organization, make_user


class OrganizationMembershipModelTests(TestCase):
    def test_membership_str_contains_user_and_organization(self):
        organization = make_organization()
        user = make_user("member@example.com")
        membership = add_membership(
            user,
            organization,
            membership_type=MembershipType.CLIENT,
        )

        self.assertIn("member@example.com", str(membership))
        self.assertIn("Acme Inc", str(membership))
