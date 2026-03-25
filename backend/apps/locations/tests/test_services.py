from __future__ import annotations

from decimal import Decimal

from django.test import TestCase

from apps.locations.models import LocationStatus
from apps.locations.services.location_service import (
    CreateLocationInput,
    CreateLocationLockInput,
    CreateLocationTypeInput,
    CreateZoneInput,
    create_location,
    create_location_lock,
    create_location_type,
    create_zone,
    update_location_lock,
)
from apps.organizations.tests.test_factories import make_organization
from apps.warehouse.models import Warehouse


class LocationServiceTests(TestCase):
    def setUp(self) -> None:
        self.organization = make_organization()
        self.warehouse = Warehouse.objects.create(
            organization=self.organization,
            name="Primary",
            code="WH-A",
        )

    def test_create_location_normalizes_codes(self) -> None:
        zone = create_zone(
            CreateZoneInput(
                organization=self.organization,
                warehouse=self.warehouse,
                code=" recv ",
                name="Receiving",
            )
        )
        location_type = create_location_type(
            CreateLocationTypeInput(
                organization=self.organization,
                code=" pick ",
                name="Pick Face",
            )
        )

        location = create_location(
            CreateLocationInput(
                organization=self.organization,
                warehouse=self.warehouse,
                zone=zone,
                location_type=location_type,
                code=" a-01-01 ",
                max_weight=Decimal("20.00"),
                max_volume=Decimal("1.5000"),
            )
        )

        self.assertEqual(zone.code, "RECV")
        self.assertEqual(location_type.code, "PICK")
        self.assertEqual(location.code, "A-01-01")

    def test_location_lock_syncs_lock_state(self) -> None:
        zone = create_zone(
            CreateZoneInput(
                organization=self.organization,
                warehouse=self.warehouse,
                code="STOR",
                name="Storage",
            )
        )
        location_type = create_location_type(
            CreateLocationTypeInput(
                organization=self.organization,
                code="BULK",
                name="Bulk",
            )
        )
        location = create_location(
            CreateLocationInput(
                organization=self.organization,
                warehouse=self.warehouse,
                zone=zone,
                location_type=location_type,
                code="B-01-01",
            )
        )

        location_lock = create_location_lock(
            CreateLocationLockInput(
                organization=self.organization,
                location=location,
                reason="Cycle count",
                locked_by="manager@example.com",
            )
        )
        location.refresh_from_db()
        self.assertTrue(location.is_locked)
        self.assertEqual(location.status, LocationStatus.BLOCKED)

        update_location_lock(
            location_lock,
            is_active=False,
            released_by="manager@example.com",
        )
        location.refresh_from_db()
        self.assertFalse(location.is_locked)
        self.assertEqual(location.status, LocationStatus.AVAILABLE)

