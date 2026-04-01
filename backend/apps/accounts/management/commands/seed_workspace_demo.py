from __future__ import annotations

from dataclasses import dataclass

from django.core.management.base import BaseCommand, CommandError

from apps.accounts.services.demo_seed import seed_demo_workspace
from apps.accounts.services.session_service import ensure_operator_profile
from apps.organizations.models import OrganizationMembership
from apps.warehouse.models import Warehouse


@dataclass(frozen=True, slots=True)
class ResolvedWorkspace:
    membership: OrganizationMembership
    warehouse: Warehouse


class Command(BaseCommand):
    help = "Seed demo data into an existing workspace membership."

    def add_arguments(self, parser) -> None:  # type: ignore[no-untyped-def]
        parser.add_argument("--membership-id", type=int, help="Seed the workspace for this membership id.")
        parser.add_argument("--email", help="Filter memberships by user email.")
        parser.add_argument("--organization-id", type=int, help="Filter memberships by organization id.")
        parser.add_argument("--organization-slug", help="Filter memberships by organization slug.")
        parser.add_argument("--organization-name", help="Filter memberships by organization name.")
        parser.add_argument("--warehouse-id", type=int, help="Use this warehouse id inside the target organization.")
        parser.add_argument("--warehouse-code", help="Use this warehouse code inside the target organization.")
        parser.add_argument(
            "--list",
            action="store_true",
            help="List active memberships and warehouses without seeding.",
        )

    def handle(self, *args: object, **options: object) -> None:
        if bool(options["list"]):
            self._print_available_targets()
            return

        resolved = self._resolve_workspace(options)
        summary = seed_demo_workspace(
            organization=resolved.membership.organization,
            membership=resolved.membership,
            warehouse=resolved.warehouse,
            operator_name=resolved.membership.user.display_name,
        )
        profile = ensure_operator_profile(resolved.membership)
        if profile.default_warehouse_id is None:
            profile.default_warehouse = resolved.warehouse
            profile.save(update_fields=["default_warehouse"])

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded workspace '{resolved.membership.organization.name}' "
                f"for {resolved.membership.user.email} using warehouse {resolved.warehouse.code}."
            )
        )
        for key in sorted(summary):
            self.stdout.write(f"{key}: {summary[key]}")

    def _resolve_workspace(self, options: dict[str, object]) -> ResolvedWorkspace:
        memberships = (
            OrganizationMembership.objects.select_related("user", "organization", "staff_profile", "staff_profile__default_warehouse")
            .filter(is_active=True, organization__is_active=True)
            .order_by("organization__name", "user__email", "id")
        )

        membership_id = options.get("membership_id")
        if isinstance(membership_id, int):
            memberships = memberships.filter(id=membership_id)

        email = self._normalize_optional_text(options.get("email"))
        if email:
            memberships = memberships.filter(user__email__iexact=email)

        organization_id = options.get("organization_id")
        if isinstance(organization_id, int):
            memberships = memberships.filter(organization_id=organization_id)

        organization_slug = self._normalize_optional_text(options.get("organization_slug"))
        if organization_slug:
            memberships = memberships.filter(organization__slug__iexact=organization_slug)

        organization_name = self._normalize_optional_text(options.get("organization_name"))
        if organization_name:
            memberships = memberships.filter(organization__name__iexact=organization_name)

        matches = list(memberships[:5])
        if not matches:
            raise CommandError("No active workspace membership matched the provided filters.")
        if len(matches) > 1:
            formatted = "\n".join(
                f"- membership_id={membership.id} email={membership.user.email} "
                f"organization_id={membership.organization_id} organization={membership.organization.name}"
                for membership in matches
            )
            raise CommandError(
                "Multiple active memberships matched. Narrow the target with --membership-id or additional filters:\n"
                f"{formatted}"
            )

        membership = matches[0]
        warehouse = self._resolve_warehouse(membership, options)
        return ResolvedWorkspace(membership=membership, warehouse=warehouse)

    def _resolve_warehouse(self, membership: OrganizationMembership, options: dict[str, object]) -> Warehouse:
        warehouses = Warehouse.objects.filter(organization=membership.organization, is_active=True).order_by("name", "id")

        warehouse_id = options.get("warehouse_id")
        if isinstance(warehouse_id, int):
            warehouse = warehouses.filter(id=warehouse_id).first()
            if warehouse is None:
                raise CommandError(
                    f"Warehouse id {warehouse_id} does not belong to organization '{membership.organization.name}'."
                )
            return warehouse

        warehouse_code = self._normalize_optional_text(options.get("warehouse_code"))
        if warehouse_code:
            warehouse = warehouses.filter(code__iexact=warehouse_code).first()
            if warehouse is None:
                raise CommandError(
                    f"Warehouse code {warehouse_code} does not belong to organization '{membership.organization.name}'."
                )
            return warehouse

        profile = ensure_operator_profile(membership)
        if profile.default_warehouse_id is not None:
            default_warehouse = warehouses.filter(id=profile.default_warehouse_id).first()
            if default_warehouse is not None:
                return default_warehouse

        warehouse = warehouses.first()
        if warehouse is not None:
            return warehouse

        raise CommandError(
            f"Organization '{membership.organization.name}' has no active warehouse. Provide one before seeding demo data."
        )

    def _print_available_targets(self) -> None:
        memberships = (
            OrganizationMembership.objects.select_related("user", "organization")
            .filter(is_active=True, organization__is_active=True)
            .order_by("organization__name", "user__email", "id")
        )
        warehouses = Warehouse.objects.select_related("organization").filter(is_active=True).order_by("organization__name", "name", "id")

        self.stdout.write("Active memberships:")
        for membership in memberships:
            self.stdout.write(
                f"  membership_id={membership.id} email={membership.user.email} "
                f"organization_id={membership.organization_id} organization={membership.organization.name}"
            )

        self.stdout.write("Active warehouses:")
        for warehouse in warehouses:
            self.stdout.write(
                f"  warehouse_id={warehouse.id} organization_id={warehouse.organization_id} "
                f"name={warehouse.name} code={warehouse.code}"
            )

    def _normalize_optional_text(self, value: object) -> str:
        return value.strip() if isinstance(value, str) else ""
