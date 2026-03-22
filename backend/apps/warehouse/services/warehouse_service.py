from __future__ import annotations

from dataclasses import dataclass

from apps.organizations.models import Organization
from apps.warehouse.models import Warehouse


@dataclass(frozen=True, slots=True)
class CreateWarehouseInput:
    organization: Organization
    name: str
    code: str
    is_active: bool = True


def list_organization_warehouses(*, organization: Organization) -> list[Warehouse]:
    return list(
        Warehouse.objects.filter(organization=organization).order_by("name", "id")
    )


def create_warehouse(payload: CreateWarehouseInput) -> Warehouse:
    warehouse = Warehouse(
        organization=payload.organization,
        name=payload.name,
        code=payload.code,
        is_active=payload.is_active,
    )
    warehouse.save()
    return warehouse


def update_warehouse(
    warehouse: Warehouse,
    *,
    name: str | None = None,
    code: str | None = None,
    is_active: bool | None = None,
) -> Warehouse:
    if name is not None:
        warehouse.name = name
    if code is not None:
        warehouse.code = code
    if is_active is not None:
        warehouse.is_active = is_active
    warehouse.save()
    return warehouse
