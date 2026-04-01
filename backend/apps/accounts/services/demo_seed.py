from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.common.operation_types import OperationOrderType
from apps.counting.models import (
    CountApproval,
    CountApprovalStatus,
    CycleCount,
    CycleCountLine,
    CycleCountLineStatus,
    CycleCountStatus,
    ScannerTaskStatus,
    ScannerTaskType,
)
from apps.fees.models import (
    BalanceTransaction,
    BusinessExpense,
    ChargeItem,
    ChargeTemplate,
    FundFlow,
    ManualCharge,
    ProfitCalculation,
    ReceivableBill,
    RentDetail,
    Voucher,
)
from apps.inbound.models import (
    AdvanceShipmentNotice,
    AdvanceShipmentNoticeLine,
    AdvanceShipmentNoticeStatus,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseOrderLineStatus,
    PurchaseOrderStatus,
    PutawayTask,
    PutawayTaskStatus,
    Receipt,
    ReceiptLine,
    ReceiptStatus,
)
from apps.inventory.models import (
    AdjustmentDirection,
    InventoryAdjustmentApprovalRule,
    InventoryAdjustmentReason,
    InventoryBalance,
    InventoryHold,
    InventoryMovement,
    InventoryStatus,
    MovementType,
)
from apps.locations.models import Location, LocationLock, LocationStatus, LocationType, Zone, ZoneUsage
from apps.logistics.models import (
    CustomerLogisticsChannel,
    FuelRule,
    LogisticsCharge,
    LogisticsChargingStrategy,
    LogisticsCost,
    LogisticsGroup,
    LogisticsProvider,
    LogisticsProviderChannel,
    LogisticsRule,
    PartitionRule,
    RemoteAreaRule,
    SpecialCustomerLogisticsCharging,
    WaybillWatermark,
)
from apps.organizations.models import Organization, OrganizationMembership
from apps.outbound.models import (
    PickTask,
    PickTaskStatus,
    SalesOrder,
    SalesOrderExceptionState,
    SalesOrderFulfillmentStage,
    SalesOrderLine,
    SalesOrderLineStatus,
    SalesOrderStatus,
    Shipment,
    ShipmentLine,
    ShipmentStatus,
)
from apps.partners.models import CustomerAccount
from apps.products.models import (
    DistributionProduct,
    Product,
    ProductMark,
    ProductPackaging,
    ProductSerialConfig,
)
from apps.reporting.models import (
    OperationalReportExport,
    OperationalReportStatus,
    OperationalReportType,
    WarehouseKpiSnapshot,
)
from apps.returns.models import (
    ReturnDisposition,
    ReturnDispositionType,
    ReturnLine,
    ReturnLineStatus,
    ReturnOrder,
    ReturnOrderStatus,
    ReturnReceipt,
)
from apps.transfers.models import (
    ReplenishmentRule,
    ReplenishmentTask,
    ReplenishmentTaskStatus,
    TransferLine,
    TransferLineStatus,
    TransferOrder,
    TransferOrderStatus,
)
from apps.warehouse.models import Warehouse
from apps.workorders.models import WorkOrder, WorkOrderType

DemoSeedSummary = dict[str, int]

ZERO_QUANTITY = Decimal("0.0000")
ONE_QUANTITY = Decimal("1.0000")
TWO_QUANTITY = Decimal("2.0000")
THREE_QUANTITY = Decimal("3.0000")
FOUR_QUANTITY = Decimal("4.0000")
FIVE_QUANTITY = Decimal("5.0000")
SIX_QUANTITY = Decimal("6.0000")
EIGHT_QUANTITY = Decimal("8.0000")
TEN_QUANTITY = Decimal("10.0000")
TWELVE_QUANTITY = Decimal("12.0000")
TWENTY_FOUR_QUANTITY = Decimal("24.0000")


def _bump(summary: DemoSeedSummary, key: str, created: bool) -> None:
    if created:
        summary[key] += 1


def _upsert_zone(
    *,
    summary: DemoSeedSummary,
    organization: Organization,
    warehouse: Warehouse,
    code: str,
    name: str,
    usage: str,
    sequence: int,
) -> Zone:
    zone, created = Zone.objects.update_or_create(
        warehouse=warehouse,
        code=code,
        defaults={
            "organization": organization,
            "name": name,
            "usage": usage,
            "sequence": sequence,
            "is_active": True,
        },
    )
    _bump(summary, "locations", created)
    return zone


def _upsert_location(
    *,
    summary: DemoSeedSummary,
    organization: Organization,
    warehouse: Warehouse,
    zone: Zone,
    location_type: LocationType,
    code: str,
    name: str,
    barcode: str,
    aisle: str,
    bay: str,
    level: str,
    slot: str,
    capacity_qty: int,
    pick_sequence: int,
    is_pick_face: bool,
    status: str = LocationStatus.AVAILABLE,
    is_locked: bool = False,
) -> Location:
    location, created = Location.objects.update_or_create(
        warehouse=warehouse,
        code=code,
        defaults={
            "organization": organization,
            "zone": zone,
            "location_type": location_type,
            "name": name,
            "barcode": barcode,
            "aisle": aisle,
            "bay": bay,
            "level": level,
            "slot": slot,
            "capacity_qty": capacity_qty,
            "max_weight": Decimal("500.00"),
            "max_volume": Decimal("12.5000"),
            "pick_sequence": pick_sequence,
            "is_pick_face": is_pick_face,
            "status": status,
            "is_locked": is_locked,
            "is_active": True,
        },
    )
    _bump(summary, "locations", created)
    return location


def _upsert_customer_account(
    *,
    summary: DemoSeedSummary,
    organization: Organization,
    code: str,
    name: str,
    contact_name: str,
    contact_email: str,
    contact_phone: str,
    billing_email: str,
    shipping_method: str,
    notes: str,
) -> CustomerAccount:
    customer_account, created = CustomerAccount.objects.update_or_create(
        organization=organization,
        code=code,
        defaults={
            "name": name,
            "contact_name": contact_name,
            "contact_email": contact_email,
            "contact_phone": contact_phone,
            "billing_email": billing_email,
            "shipping_method": shipping_method,
            "allow_dropshipping_orders": True,
            "allow_inbound_goods": True,
            "notes": notes,
            "is_active": True,
        },
    )
    _bump(summary, "customer_accounts", created)
    return customer_account


def _upsert_product(
    *,
    summary: DemoSeedSummary,
    organization: Organization,
    sku: str,
    name: str,
    barcode: str,
    unit_of_measure: str,
    category: str,
    brand: str,
    description: str,
) -> Product:
    product, created = Product.objects.update_or_create(
        organization=organization,
        sku=sku,
        defaults={
            "name": name,
            "barcode": barcode,
            "unit_of_measure": unit_of_measure,
            "category": category,
            "brand": brand,
            "description": description,
            "is_active": True,
        },
    )
    _bump(summary, "products", created)
    return product


def _upsert_distribution_product(
    *,
    summary: DemoSeedSummary,
    product: Product,
    customer_account: CustomerAccount,
    external_sku: str,
    external_name: str,
    channel_name: str,
) -> DistributionProduct:
    distribution_product, created = DistributionProduct.objects.update_or_create(
        product=product,
        customer_account=customer_account,
        external_sku=external_sku,
        defaults={
            "external_name": external_name,
            "channel_name": channel_name,
            "allow_dropshipping_orders": True,
            "allow_inbound_goods": True,
            "is_active": True,
        },
    )
    _bump(summary, "products", created)
    return distribution_product


def _upsert_inventory_balance(
    *,
    summary: DemoSeedSummary,
    organization: Organization,
    warehouse: Warehouse,
    location: Location,
    product: Product,
    stock_status: str,
    lot_number: str,
    on_hand_qty: Decimal,
    allocated_qty: Decimal,
    hold_qty: Decimal,
    unit_cost: Decimal,
    currency: str,
    last_movement_at,
) -> InventoryBalance:
    inventory_balance, created = InventoryBalance.objects.update_or_create(
        organization=organization,
        warehouse=warehouse,
        location=location,
        product=product,
        stock_status=stock_status,
        lot_number=lot_number,
        serial_number="",
        defaults={
            "on_hand_qty": on_hand_qty,
            "allocated_qty": allocated_qty,
            "hold_qty": hold_qty,
            "unit_cost": unit_cost,
            "currency": currency,
            "last_movement_at": last_movement_at,
        },
    )
    _bump(summary, "inventory", created)
    return inventory_balance


@transaction.atomic
def seed_demo_workspace(
    *,
    organization: Organization,
    membership: OrganizationMembership,
    warehouse: Warehouse,
    operator_name: str,
) -> DemoSeedSummary:
    now = timezone.now()
    today = timezone.localdate()
    next_week = today + timedelta(days=7)
    next_month = today + timedelta(days=30)
    summary: DemoSeedSummary = {
        "customer_accounts": 0,
        "products": 0,
        "locations": 0,
        "inventory": 0,
        "transfers": 0,
        "counting": 0,
        "inbound": 0,
        "outbound": 0,
        "returns": 0,
        "logistics": 0,
        "fees": 0,
        "workorders": 0,
        "reporting": 0,
    }

    customer_account = _upsert_customer_account(
        summary=summary,
        organization=organization,
        code="DEMO-CLIENT",
        name="Demo Client Account",
        contact_name="Ava Chen",
        contact_email="ops@demo-client.test",
        contact_phone="555-0100",
        billing_email="billing@demo-client.test",
        shipping_method="YunExpress Standard",
        notes="Seeded client account for the development workspace.",
    )
    retail_partner_account = _upsert_customer_account(
        summary=summary,
        organization=organization,
        code="NOVA-RETAIL",
        name="Nova Retail Group",
        contact_name="Mina Park",
        contact_email="ops@nova-retail.test",
        contact_phone="555-0104",
        billing_email="ap@nova-retail.test",
        shipping_method="Air parcel",
        notes="Seeded marketplace client account for multi-client inventory demos.",
    )
    wholesale_account = _upsert_customer_account(
        summary=summary,
        organization=organization,
        code="TRAIL-MART",
        name="TrailMart Wholesale",
        contact_name="Luis Ortega",
        contact_email="inbound@trailmart.test",
        contact_phone="555-0105",
        billing_email="finance@trailmart.test",
        shipping_method="LTL freight",
        notes="Seeded wholesale client account for open inbound and outbound inventory demos.",
    )

    product = _upsert_product(
        summary=summary,
        organization=organization,
        sku="SKU-DEMO-001",
        name="Demo Multi-Channel Widget",
        barcode="BC-DEMO-001",
        unit_of_measure="EA",
        category="Electronics",
        brand="DaChong",
        description="Seeded product used across inbound, outbound, returns, and finance demos.",
    )
    insulated_bottle = _upsert_product(
        summary=summary,
        organization=organization,
        sku="SKU-DEMO-002",
        name="AeroSip Insulated Bottle",
        barcode="BC-DEMO-002",
        unit_of_measure="EA",
        category="Home",
        brand="Northstar",
        description="Seeded product with active client demand, quarantine stock, and inbound replenishment.",
    )
    trail_light = _upsert_product(
        summary=summary,
        organization=organization,
        sku="SKU-DEMO-003",
        name="TrailLight Headlamp",
        barcode="BC-DEMO-003",
        unit_of_measure="EA",
        category="Outdoor",
        brand="Summit",
        description="Seeded product used to demonstrate pending inbound, allocated outbound, and multi-shelf inventory.",
    )

    _upsert_distribution_product(
        summary=summary,
        product=product,
        customer_account=customer_account,
        external_sku="CLIENT-SKU-001",
        external_name="Demo Client Widget",
        channel_name="Shopify",
    )
    _upsert_distribution_product(
        summary=summary,
        product=insulated_bottle,
        customer_account=retail_partner_account,
        external_sku="NOVA-BOTTLE-20OZ",
        external_name="Nova AeroSip Bottle",
        channel_name="TikTok Shop",
    )
    _upsert_distribution_product(
        summary=summary,
        product=insulated_bottle,
        customer_account=customer_account,
        external_sku="CLIENT-BOTTLE-20OZ",
        external_name="Demo Client Bottle",
        channel_name="Shopify",
    )
    _upsert_distribution_product(
        summary=summary,
        product=trail_light,
        customer_account=wholesale_account,
        external_sku="TRAIL-HEADLAMP-PRO",
        external_name="TrailLight Pro Headlamp",
        channel_name="Wholesale EDI",
    )

    serial_config, created = ProductSerialConfig.objects.update_or_create(
        product=product,
        defaults={
            "tracking_mode": ProductSerialConfig.TrackingMode.OPTIONAL,
            "serial_pattern": "DC-{YYYY}-{RAND4}",
            "requires_uniqueness": True,
            "capture_on_inbound": True,
            "capture_on_outbound": True,
            "capture_on_returns": True,
        },
    )
    _bump(summary, "products", created)

    packaging, created = ProductPackaging.objects.update_or_create(
        product=product,
        package_code="UNIT-BOX",
        defaults={
            "package_type": ProductPackaging.PackageType.CARTON,
            "units_per_package": 24,
            "length_cm": Decimal("40.00"),
            "width_cm": Decimal("30.00"),
            "height_cm": Decimal("20.00"),
            "weight_kg": Decimal("6.50"),
            "is_default": True,
            "is_active": True,
        },
    )
    _bump(summary, "products", created)

    product_mark, created = ProductMark.objects.update_or_create(
        product=product,
        mark_type=ProductMark.MarkType.FRAGILE,
        value="Handle with care",
        defaults={
            "notes": "Seeded product mark for packaging and outbound demos.",
            "is_active": True,
        },
    )
    _bump(summary, "products", created)

    receiving_zone = _upsert_zone(
        summary=summary,
        organization=organization,
        warehouse=warehouse,
        code="RCV",
        name="Receiving Zone",
        usage=ZoneUsage.RECEIVING,
        sequence=10,
    )
    storage_zone = _upsert_zone(
        summary=summary,
        organization=organization,
        warehouse=warehouse,
        code="STO",
        name="Storage Zone",
        usage=ZoneUsage.STORAGE,
        sequence=20,
    )
    picking_zone = _upsert_zone(
        summary=summary,
        organization=organization,
        warehouse=warehouse,
        code="PCK",
        name="Picking Zone",
        usage=ZoneUsage.PICKING,
        sequence=30,
    )
    shipping_zone = _upsert_zone(
        summary=summary,
        organization=organization,
        warehouse=warehouse,
        code="SHP",
        name="Shipping Zone",
        usage=ZoneUsage.SHIPPING,
        sequence=40,
    )
    returns_zone = _upsert_zone(
        summary=summary,
        organization=organization,
        warehouse=warehouse,
        code="RET",
        name="Returns Zone",
        usage=ZoneUsage.RETURNS,
        sequence=50,
    )
    quarantine_zone = _upsert_zone(
        summary=summary,
        organization=organization,
        warehouse=warehouse,
        code="QUA",
        name="Quarantine Zone",
        usage=ZoneUsage.QUARANTINE,
        sequence=60,
    )

    location_type, created = LocationType.objects.update_or_create(
        organization=organization,
        code="STD",
        defaults={
            "name": "Standard Rack",
            "picking_enabled": True,
            "putaway_enabled": True,
            "allow_mixed_sku": False,
            "max_weight": Decimal("500.00"),
            "max_volume": Decimal("12.5000"),
            "is_active": True,
        },
    )
    _bump(summary, "locations", created)

    receiving_location = _upsert_location(
        summary=summary,
        organization=organization,
        warehouse=warehouse,
        zone=receiving_zone,
        location_type=location_type,
        code="RCV-01",
        name="Receiving Dock 01",
        barcode="RCV-01",
        aisle="R",
        bay="01",
        level="01",
        slot="01",
        capacity_qty=200,
        pick_sequence=10,
        is_pick_face=False,
    )
    storage_location = _upsert_location(
        summary=summary,
        organization=organization,
        warehouse=warehouse,
        zone=storage_zone,
        location_type=location_type,
        code="STO-01",
        name="Primary Storage 01",
        barcode="STO-01",
        aisle="S",
        bay="01",
        level="01",
        slot="01",
        capacity_qty=500,
        pick_sequence=20,
        is_pick_face=False,
    )
    picking_location = _upsert_location(
        summary=summary,
        organization=organization,
        warehouse=warehouse,
        zone=picking_zone,
        location_type=location_type,
        code="PCK-01",
        name="Pick Face 01",
        barcode="PCK-01",
        aisle="P",
        bay="01",
        level="01",
        slot="01",
        capacity_qty=120,
        pick_sequence=30,
        is_pick_face=True,
    )
    shipping_location = _upsert_location(
        summary=summary,
        organization=organization,
        warehouse=warehouse,
        zone=shipping_zone,
        location_type=location_type,
        code="SHP-01",
        name="Shipping Staging 01",
        barcode="SHP-01",
        aisle="H",
        bay="01",
        level="01",
        slot="01",
        capacity_qty=180,
        pick_sequence=40,
        is_pick_face=False,
    )
    returns_location = _upsert_location(
        summary=summary,
        organization=organization,
        warehouse=warehouse,
        zone=returns_zone,
        location_type=location_type,
        code="RET-01",
        name="Returns Intake 01",
        barcode="RET-01",
        aisle="T",
        bay="01",
        level="01",
        slot="01",
        capacity_qty=120,
        pick_sequence=50,
        is_pick_face=False,
    )
    quarantine_location = _upsert_location(
        summary=summary,
        organization=organization,
        warehouse=warehouse,
        zone=quarantine_zone,
        location_type=location_type,
        code="QUA-01",
        name="Quarantine 01",
        barcode="QUA-01",
        aisle="Q",
        bay="01",
        level="01",
        slot="01",
        capacity_qty=80,
        pick_sequence=60,
        is_pick_face=False,
        status=LocationStatus.BLOCKED,
        is_locked=True,
    )

    location_lock, created = LocationLock.objects.update_or_create(
        location=quarantine_location,
        defaults={
            "organization": organization,
            "reason": "Quality hold",
            "notes": "Seeded quarantine hold for location-lock views.",
            "locked_by": operator_name,
            "released_by": "",
            "is_active": True,
            "end_time": None,
            "released_at": None,
        },
    )
    _bump(summary, "locations", created)
    if not quarantine_location.is_locked or quarantine_location.status != LocationStatus.BLOCKED:
        quarantine_location.is_locked = True
        quarantine_location.status = LocationStatus.BLOCKED
        quarantine_location.save(update_fields=["is_locked", "status"])

    storage_balance = _upsert_inventory_balance(
        summary=summary,
        organization=organization,
        warehouse=warehouse,
        location=storage_location,
        product=product,
        stock_status=InventoryStatus.AVAILABLE,
        lot_number="LOT-DEMO-001",
        on_hand_qty=TWENTY_FOUR_QUANTITY,
        allocated_qty=THREE_QUANTITY,
        hold_qty=ONE_QUANTITY,
        unit_cost=Decimal("6.5000"),
        currency="USD",
        last_movement_at=now - timedelta(days=1),
    )

    picking_balance = _upsert_inventory_balance(
        summary=summary,
        organization=organization,
        warehouse=warehouse,
        location=picking_location,
        product=product,
        stock_status=InventoryStatus.AVAILABLE,
        lot_number="LOT-DEMO-001",
        on_hand_qty=SIX_QUANTITY,
        allocated_qty=ONE_QUANTITY,
        hold_qty=ZERO_QUANTITY,
        unit_cost=Decimal("6.5000"),
        currency="USD",
        last_movement_at=now - timedelta(hours=12),
    )

    bottle_storage_balance = _upsert_inventory_balance(
        summary=summary,
        organization=organization,
        warehouse=warehouse,
        location=storage_location,
        product=insulated_bottle,
        stock_status=InventoryStatus.AVAILABLE,
        lot_number="LOT-DEMO-002",
        on_hand_qty=Decimal("18.0000"),
        allocated_qty=Decimal("4.0000"),
        hold_qty=Decimal("2.0000"),
        unit_cost=Decimal("8.2500"),
        currency="USD",
        last_movement_at=now - timedelta(hours=18),
    )
    bottle_picking_balance = _upsert_inventory_balance(
        summary=summary,
        organization=organization,
        warehouse=warehouse,
        location=picking_location,
        product=insulated_bottle,
        stock_status=InventoryStatus.AVAILABLE,
        lot_number="LOT-DEMO-002",
        on_hand_qty=Decimal("5.0000"),
        allocated_qty=Decimal("1.0000"),
        hold_qty=ZERO_QUANTITY,
        unit_cost=Decimal("8.2500"),
        currency="USD",
        last_movement_at=now - timedelta(hours=6),
    )
    bottle_quarantine_balance = _upsert_inventory_balance(
        summary=summary,
        organization=organization,
        warehouse=warehouse,
        location=quarantine_location,
        product=insulated_bottle,
        stock_status=InventoryStatus.DAMAGED,
        lot_number="LOT-DEMO-002-QC",
        on_hand_qty=Decimal("3.0000"),
        allocated_qty=ZERO_QUANTITY,
        hold_qty=ZERO_QUANTITY,
        unit_cost=Decimal("8.2500"),
        currency="USD",
        last_movement_at=now - timedelta(hours=4),
    )
    trail_storage_balance = _upsert_inventory_balance(
        summary=summary,
        organization=organization,
        warehouse=warehouse,
        location=storage_location,
        product=trail_light,
        stock_status=InventoryStatus.AVAILABLE,
        lot_number="LOT-DEMO-003",
        on_hand_qty=Decimal("14.0000"),
        allocated_qty=ZERO_QUANTITY,
        hold_qty=ZERO_QUANTITY,
        unit_cost=Decimal("11.7500"),
        currency="USD",
        last_movement_at=now - timedelta(hours=20),
    )
    trail_picking_balance = _upsert_inventory_balance(
        summary=summary,
        organization=organization,
        warehouse=warehouse,
        location=picking_location,
        product=trail_light,
        stock_status=InventoryStatus.AVAILABLE,
        lot_number="LOT-DEMO-003",
        on_hand_qty=Decimal("8.0000"),
        allocated_qty=Decimal("2.0000"),
        hold_qty=ZERO_QUANTITY,
        unit_cost=Decimal("11.7500"),
        currency="USD",
        last_movement_at=now - timedelta(hours=9),
    )

    opening_movement, created = InventoryMovement.objects.update_or_create(
        organization=organization,
        reference_code="DEMO-INV-OPENING",
        movement_type=MovementType.OPENING,
        defaults={
            "warehouse": warehouse,
            "product": product,
            "from_location": None,
            "to_location": storage_location,
            "stock_status": InventoryStatus.AVAILABLE,
            "lot_number": "LOT-DEMO-001",
            "serial_number": "",
            "quantity": TWENTY_FOUR_QUANTITY,
            "unit_cost": Decimal("6.5000"),
            "currency": "USD",
            "reason": "Opening demo balance",
            "performed_by": operator_name,
            "occurred_at": now - timedelta(days=3),
            "resulting_from_qty": None,
            "resulting_to_qty": TWENTY_FOUR_QUANTITY,
        },
    )
    _bump(summary, "inventory", created)

    hold_record, created = InventoryHold.objects.update_or_create(
        organization=organization,
        inventory_balance=storage_balance,
        reference_code="DEMO-HOLD-001",
        defaults={
            "quantity": ONE_QUANTITY,
            "reason": "Awaiting QA review",
            "notes": "Seeded active hold for demo inventory screens.",
            "held_by": operator_name,
            "released_by": "",
            "released_at": None,
            "is_active": True,
        },
    )
    _bump(summary, "inventory", created)

    hold_movement, created = InventoryMovement.objects.update_or_create(
        organization=organization,
        reference_code="DEMO-HOLD-001",
        movement_type=MovementType.HOLD,
        defaults={
            "warehouse": warehouse,
            "product": product,
            "from_location": storage_location,
            "to_location": None,
            "stock_status": InventoryStatus.AVAILABLE,
            "lot_number": "LOT-DEMO-001",
            "serial_number": "",
            "quantity": ONE_QUANTITY,
            "unit_cost": Decimal("6.5000"),
            "currency": "USD",
            "reason": "Awaiting QA review",
            "performed_by": operator_name,
            "occurred_at": now - timedelta(days=2),
            "resulting_from_qty": TWENTY_FOUR_QUANTITY,
            "resulting_to_qty": None,
        },
    )
    _bump(summary, "inventory", created)

    adjustment_reason, created = InventoryAdjustmentReason.objects.update_or_create(
        organization=organization,
        code="COUNT_VAR",
        defaults={
            "name": "Count variance",
            "description": "Used when a cycle count variance requires a stock correction.",
            "direction": AdjustmentDirection.BOTH,
            "requires_approval": True,
            "is_active": True,
        },
    )
    _bump(summary, "inventory", created)

    approval_rule, created = InventoryAdjustmentApprovalRule.objects.update_or_create(
        organization=organization,
        adjustment_reason=adjustment_reason,
        warehouse=warehouse,
        minimum_variance_qty=ONE_QUANTITY,
        approver_role="Manager",
        defaults={
            "is_active": True,
            "notes": "Seeded approval threshold for count variances.",
        },
    )
    _bump(summary, "inventory", created)

    transfer_order, created = TransferOrder.objects.update_or_create(
        organization=organization,
        transfer_number="TR-DEMO-001",
        defaults={
            "warehouse": warehouse,
            "requested_date": today,
            "reference_code": "MOVE-DEMO",
            "status": TransferOrderStatus.OPEN,
            "notes": "Seeded internal move order for demo workspace.",
        },
    )
    _bump(summary, "transfers", created)

    transfer_line, created = TransferLine.objects.update_or_create(
        transfer_order=transfer_order,
        line_number=1,
        defaults={
            "organization": organization,
            "product": product,
            "from_location": storage_location,
            "to_location": picking_location,
            "requested_qty": FOUR_QUANTITY,
            "moved_qty": ZERO_QUANTITY,
            "stock_status": InventoryStatus.AVAILABLE,
            "lot_number": "LOT-DEMO-001",
            "serial_number": "",
            "status": TransferLineStatus.OPEN,
            "assigned_membership": membership,
            "completed_by": "",
            "completed_at": None,
            "inventory_movement": None,
            "notes": "Seeded replenishment-backed internal move.",
        },
    )
    _bump(summary, "transfers", created)

    replenishment_rule, created = ReplenishmentRule.objects.update_or_create(
        organization=organization,
        warehouse=warehouse,
        product=product,
        source_location=storage_location,
        target_location=picking_location,
        stock_status=InventoryStatus.AVAILABLE,
        defaults={
            "minimum_qty": TWO_QUANTITY,
            "target_qty": EIGHT_QUANTITY,
            "priority": 20,
            "is_active": True,
            "notes": "Seeded pick-face replenishment rule.",
        },
    )
    _bump(summary, "transfers", created)

    replenishment_task, created = ReplenishmentTask.objects.update_or_create(
        organization=organization,
        task_number="RPL-DEMO-001",
        defaults={
            "replenishment_rule": replenishment_rule,
            "warehouse": warehouse,
            "source_balance": storage_balance,
            "product": product,
            "from_location": storage_location,
            "to_location": picking_location,
            "quantity": TWO_QUANTITY,
            "priority": 20,
            "stock_status": InventoryStatus.AVAILABLE,
            "lot_number": "LOT-DEMO-001",
            "serial_number": "",
            "status": ReplenishmentTaskStatus.OPEN,
            "assigned_membership": membership,
            "completed_by": "",
            "completed_at": None,
            "inventory_movement": None,
            "notes": "Seeded replenishment task.",
            "generated_at": now - timedelta(hours=6),
        },
    )
    _bump(summary, "transfers", created)

    completed_transfer_order, created = TransferOrder.objects.update_or_create(
        organization=organization,
        transfer_number="TR-DEMO-002",
        defaults={
            "warehouse": warehouse,
            "requested_date": today - timedelta(days=1),
            "reference_code": "MOVE-DEMO-DONE",
            "status": TransferOrderStatus.COMPLETED,
            "notes": "Seeded completed internal move order.",
        },
    )
    _bump(summary, "transfers", created)

    completed_transfer_line, created = TransferLine.objects.update_or_create(
        transfer_order=completed_transfer_order,
        line_number=1,
        defaults={
            "organization": organization,
            "product": product,
            "from_location": storage_location,
            "to_location": picking_location,
            "requested_qty": TWO_QUANTITY,
            "moved_qty": TWO_QUANTITY,
            "stock_status": InventoryStatus.AVAILABLE,
            "lot_number": "LOT-DEMO-001",
            "serial_number": "",
            "status": TransferLineStatus.COMPLETED,
            "assigned_membership": membership,
            "completed_by": operator_name,
            "completed_at": now - timedelta(hours=12),
            "inventory_movement": None,
            "notes": "Seeded completed transfer line.",
        },
    )
    _bump(summary, "transfers", created)

    cycle_count, created = CycleCount.objects.update_or_create(
        organization=organization,
        count_number="CC-DEMO-001",
        defaults={
            "warehouse": warehouse,
            "scheduled_date": today,
            "is_blind_count": True,
            "status": CycleCountStatus.PENDING_APPROVAL,
            "notes": "Seeded cycle count pending approval.",
            "submitted_by": operator_name,
            "submitted_at": now - timedelta(hours=4),
            "completed_at": None,
        },
    )
    _bump(summary, "counting", created)

    cycle_count_line, created = CycleCountLine.objects.update_or_create(
        cycle_count=cycle_count,
        line_number=1,
        defaults={
            "organization": organization,
            "inventory_balance": storage_balance,
            "location": storage_location,
            "product": product,
            "stock_status": InventoryStatus.AVAILABLE,
            "lot_number": "LOT-DEMO-001",
            "serial_number": "",
            "system_qty": TWENTY_FOUR_QUANTITY,
            "counted_qty": TWENTY_FOUR_QUANTITY - ONE_QUANTITY,
            "variance_qty": Decimal("-1.0000"),
            "adjustment_reason": adjustment_reason,
            "status": CycleCountLineStatus.PENDING_APPROVAL,
            "assigned_membership": membership,
            "assigned_at": now - timedelta(hours=8),
            "scanner_task_type": ScannerTaskType.COUNT,
            "scanner_task_status": ScannerTaskStatus.COMPLETED,
            "scanner_task_acknowledged_at": now - timedelta(hours=7),
            "scanner_task_started_at": now - timedelta(hours=7),
            "scanner_task_completed_at": now - timedelta(hours=6),
            "scanner_task_last_operator": operator_name,
            "counted_by": operator_name,
            "counted_at": now - timedelta(hours=6),
            "recount_assigned_membership": membership,
            "recount_assigned_at": now - timedelta(hours=5),
            "recount_counted_qty": TWENTY_FOUR_QUANTITY - ONE_QUANTITY,
            "recounted_by": operator_name,
            "recounted_at": now - timedelta(hours=5),
            "adjustment_movement": None,
            "notes": "Seeded variance awaiting approval.",
        },
    )
    _bump(summary, "counting", created)

    count_approval, created = CountApproval.objects.update_or_create(
        cycle_count_line=cycle_count_line,
        defaults={
            "organization": organization,
            "approval_rule": approval_rule,
            "status": CountApprovalStatus.PENDING,
            "requested_by": operator_name,
            "requested_at": now - timedelta(hours=4),
            "approved_by": "",
            "approved_at": None,
            "rejected_by": "",
            "rejected_at": None,
            "notes": "Seeded pending count approval.",
        },
    )
    _bump(summary, "counting", created)

    completed_cycle_count, created = CycleCount.objects.update_or_create(
        organization=organization,
        count_number="CC-DEMO-002",
        defaults={
            "warehouse": warehouse,
            "scheduled_date": today - timedelta(days=1),
            "is_blind_count": False,
            "status": CycleCountStatus.COMPLETED,
            "notes": "Seeded completed cycle count.",
            "submitted_by": operator_name,
            "submitted_at": now - timedelta(days=1, hours=2),
            "completed_at": now - timedelta(days=1),
        },
    )
    _bump(summary, "counting", created)

    completed_cycle_count_line, created = CycleCountLine.objects.update_or_create(
        cycle_count=completed_cycle_count,
        line_number=1,
        defaults={
            "organization": organization,
            "inventory_balance": picking_balance,
            "location": picking_location,
            "product": product,
            "stock_status": InventoryStatus.AVAILABLE,
            "lot_number": "LOT-DEMO-001",
            "serial_number": "",
            "system_qty": SIX_QUANTITY,
            "counted_qty": SIX_QUANTITY,
            "variance_qty": ZERO_QUANTITY,
            "adjustment_reason": adjustment_reason,
            "status": CycleCountLineStatus.RECONCILED,
            "assigned_membership": membership,
            "assigned_at": now - timedelta(days=1, hours=5),
            "scanner_task_type": ScannerTaskType.COUNT,
            "scanner_task_status": ScannerTaskStatus.COMPLETED,
            "scanner_task_acknowledged_at": now - timedelta(days=1, hours=4),
            "scanner_task_started_at": now - timedelta(days=1, hours=4),
            "scanner_task_completed_at": now - timedelta(days=1, hours=4),
            "scanner_task_last_operator": operator_name,
            "counted_by": operator_name,
            "counted_at": now - timedelta(days=1, hours=4),
            "recount_assigned_membership": None,
            "recount_assigned_at": None,
            "recount_counted_qty": None,
            "recounted_by": "",
            "recounted_at": None,
            "adjustment_movement": None,
            "notes": "Seeded completed count line.",
        },
    )
    _bump(summary, "counting", created)

    completed_count_approval, created = CountApproval.objects.update_or_create(
        cycle_count_line=completed_cycle_count_line,
        defaults={
            "organization": organization,
            "approval_rule": approval_rule,
            "status": CountApprovalStatus.APPROVED,
            "requested_by": operator_name,
            "requested_at": now - timedelta(days=1, hours=3),
            "approved_by": operator_name,
            "approved_at": now - timedelta(days=1, hours=2),
            "rejected_by": "",
            "rejected_at": None,
            "notes": "Seeded approved count approval.",
        },
    )
    _bump(summary, "counting", created)

    purchase_order, created = PurchaseOrder.objects.update_or_create(
        organization=organization,
        po_number="PO-DEMO-001",
        defaults={
            "warehouse": warehouse,
            "customer_account": customer_account,
            "order_type": OperationOrderType.STANDARD,
            "customer_code": customer_account.code,
            "customer_name": customer_account.name,
            "supplier_code": "SUP-DEMO",
            "supplier_name": "Demo Supplier",
            "supplier_contact_name": "Dock Lead",
            "supplier_contact_phone": "555-0101",
            "expected_arrival_date": today,
            "reference_code": "INB-DEMO",
            "status": PurchaseOrderStatus.OPEN,
            "notes": "Seeded standard inbound order.",
        },
    )
    _bump(summary, "inbound", created)

    purchase_order_line, created = PurchaseOrderLine.objects.update_or_create(
        purchase_order=purchase_order,
        line_number=1,
        defaults={
            "organization": organization,
            "product": product,
            "ordered_qty": TEN_QUANTITY,
            "received_qty": FIVE_QUANTITY,
            "unit_cost": Decimal("5.2500"),
            "stock_status": InventoryStatus.AVAILABLE,
            "status": PurchaseOrderLineStatus.PARTIAL,
        },
    )
    _bump(summary, "inbound", created)

    b2b_purchase_order, created = PurchaseOrder.objects.update_or_create(
        organization=organization,
        po_number="PO-B2B-001",
        defaults={
            "warehouse": warehouse,
            "customer_account": customer_account,
            "order_type": OperationOrderType.B2B,
            "customer_code": customer_account.code,
            "customer_name": customer_account.name,
            "supplier_code": "SUP-B2B",
            "supplier_name": "B2B Supplier",
            "supplier_contact_name": "Crossdock Lead",
            "supplier_contact_phone": "555-0102",
            "expected_arrival_date": today + timedelta(days=1),
            "reference_code": "B2B-INB",
            "status": PurchaseOrderStatus.OPEN,
            "notes": "Seeded B2B inbound order.",
        },
    )
    _bump(summary, "inbound", created)

    PurchaseOrderLine.objects.update_or_create(
        purchase_order=b2b_purchase_order,
        line_number=1,
        defaults={
            "organization": organization,
            "product": product,
            "ordered_qty": EIGHT_QUANTITY,
            "received_qty": ZERO_QUANTITY,
            "unit_cost": Decimal("5.2500"),
            "stock_status": InventoryStatus.AVAILABLE,
            "status": PurchaseOrderLineStatus.OPEN,
        },
    )

    asn, created = AdvanceShipmentNotice.objects.update_or_create(
        organization=organization,
        asn_number="ASN-DEMO-001",
        defaults={
            "purchase_order": purchase_order,
            "warehouse": warehouse,
            "customer_account": customer_account,
            "order_type": OperationOrderType.STANDARD,
            "expected_arrival_date": today,
            "status": AdvanceShipmentNoticeStatus.PARTIAL,
            "reference_code": "ASN-DEMO",
            "notes": "Seeded advance shipment notice.",
        },
    )
    _bump(summary, "inbound", created)

    asn_line, created = AdvanceShipmentNoticeLine.objects.update_or_create(
        asn=asn,
        line_number=1,
        defaults={
            "organization": organization,
            "purchase_order_line": purchase_order_line,
            "product": product,
            "expected_qty": TEN_QUANTITY,
            "received_qty": FIVE_QUANTITY,
            "stock_status": InventoryStatus.AVAILABLE,
            "expected_lpn_code": "LPN-DEMO-001",
            "notes": "Seeded ASN line.",
        },
    )
    _bump(summary, "inbound", created)

    receipt, created = Receipt.objects.update_or_create(
        organization=organization,
        receipt_number="RCPT-DEMO-001",
        defaults={
            "asn": asn,
            "purchase_order": purchase_order,
            "warehouse": warehouse,
            "receipt_location": receiving_location,
            "status": ReceiptStatus.POSTED,
            "received_by": operator_name,
            "received_at": now - timedelta(hours=3),
            "notes": "Seeded inbound receipt.",
        },
    )
    _bump(summary, "inbound", created)

    receipt_line, created = ReceiptLine.objects.update_or_create(
        receipt=receipt,
        purchase_order_line=purchase_order_line,
        defaults={
            "organization": organization,
            "asn_line": asn_line,
            "product": product,
            "receipt_location": receiving_location,
            "received_qty": FIVE_QUANTITY,
            "stock_status": InventoryStatus.AVAILABLE,
            "lot_number": "LOT-DEMO-001",
            "serial_number": "",
            "unit_cost": Decimal("5.2500"),
            "inventory_movement": None,
        },
    )
    _bump(summary, "inbound", created)

    putaway_task, created = PutawayTask.objects.update_or_create(
        organization=organization,
        task_number="PT-DEMO-001",
        defaults={
            "receipt_line": receipt_line,
            "warehouse": warehouse,
            "product": product,
            "from_location": receiving_location,
            "quantity": THREE_QUANTITY,
            "stock_status": InventoryStatus.AVAILABLE,
            "lot_number": "LOT-DEMO-001",
            "serial_number": "",
            "status": PutawayTaskStatus.OPEN,
            "assigned_membership": membership,
            "completed_by": "",
            "completed_at": None,
            "inventory_movement": None,
            "notes": "Seeded open putaway task.",
        },
    )
    _bump(summary, "inbound", created)

    completed_purchase_order, created = PurchaseOrder.objects.update_or_create(
        organization=organization,
        po_number="PO-DEMO-002",
        defaults={
            "warehouse": warehouse,
            "customer_account": customer_account,
            "order_type": OperationOrderType.STANDARD,
            "customer_code": customer_account.code,
            "customer_name": customer_account.name,
            "supplier_code": "SUP-DONE",
            "supplier_name": "Completed Supplier",
            "supplier_contact_name": "Receiving Lead",
            "supplier_contact_phone": "555-0103",
            "expected_arrival_date": today - timedelta(days=1),
            "reference_code": "INB-DEMO-DONE",
            "status": PurchaseOrderStatus.CLOSED,
            "notes": "Seeded completed inbound order.",
        },
    )
    _bump(summary, "inbound", created)

    completed_purchase_order_line, created = PurchaseOrderLine.objects.update_or_create(
        purchase_order=completed_purchase_order,
        line_number=1,
        defaults={
            "organization": organization,
            "product": product,
            "ordered_qty": FOUR_QUANTITY,
            "received_qty": FOUR_QUANTITY,
            "unit_cost": Decimal("5.0000"),
            "stock_status": InventoryStatus.AVAILABLE,
            "status": PurchaseOrderLineStatus.CLOSED,
        },
    )
    _bump(summary, "inbound", created)

    completed_asn, created = AdvanceShipmentNotice.objects.update_or_create(
        organization=organization,
        asn_number="ASN-DEMO-002",
        defaults={
            "purchase_order": completed_purchase_order,
            "warehouse": warehouse,
            "customer_account": customer_account,
            "order_type": OperationOrderType.STANDARD,
            "expected_arrival_date": today - timedelta(days=1),
            "status": AdvanceShipmentNoticeStatus.RECEIVED,
            "reference_code": "ASN-DEMO-DONE",
            "notes": "Seeded completed ASN.",
        },
    )
    _bump(summary, "inbound", created)

    completed_asn_line, created = AdvanceShipmentNoticeLine.objects.update_or_create(
        asn=completed_asn,
        line_number=1,
        defaults={
            "organization": organization,
            "purchase_order_line": completed_purchase_order_line,
            "product": product,
            "expected_qty": FOUR_QUANTITY,
            "received_qty": FOUR_QUANTITY,
            "stock_status": InventoryStatus.AVAILABLE,
            "expected_lpn_code": "LPN-DEMO-002",
            "notes": "Seeded completed ASN line.",
        },
    )
    _bump(summary, "inbound", created)

    completed_receipt, created = Receipt.objects.update_or_create(
        organization=organization,
        receipt_number="RCPT-DEMO-002",
        defaults={
            "asn": completed_asn,
            "purchase_order": completed_purchase_order,
            "warehouse": warehouse,
            "receipt_location": receiving_location,
            "status": ReceiptStatus.POSTED,
            "reference_code": "RCPT-DEMO-DONE",
            "notes": "Seeded completed receipt.",
            "received_by": operator_name,
            "received_at": now - timedelta(days=1, hours=1),
        },
    )
    _bump(summary, "inbound", created)

    completed_receipt_line, created = ReceiptLine.objects.update_or_create(
        receipt=completed_receipt,
        purchase_order_line=completed_purchase_order_line,
        defaults={
            "organization": organization,
            "asn_line": completed_asn_line,
            "product": product,
            "receipt_location": receiving_location,
            "received_qty": FOUR_QUANTITY,
            "stock_status": InventoryStatus.AVAILABLE,
            "lot_number": "LOT-DEMO-002",
            "serial_number": "",
            "unit_cost": Decimal("5.0000"),
            "inventory_movement": None,
        },
    )
    _bump(summary, "inbound", created)

    completed_putaway_task, created = PutawayTask.objects.update_or_create(
        organization=organization,
        task_number="PT-DEMO-002",
        defaults={
            "receipt_line": completed_receipt_line,
            "warehouse": warehouse,
            "product": product,
            "from_location": receiving_location,
            "to_location": storage_location,
            "quantity": FOUR_QUANTITY,
            "stock_status": InventoryStatus.AVAILABLE,
            "lot_number": "LOT-DEMO-002",
            "serial_number": "",
            "status": PutawayTaskStatus.COMPLETED,
            "assigned_membership": membership,
            "completed_by": operator_name,
            "completed_at": now - timedelta(days=1),
            "inventory_movement": None,
            "notes": "Seeded completed putaway task.",
        },
    )
    _bump(summary, "inbound", created)

    bottle_purchase_order, created = PurchaseOrder.objects.update_or_create(
        organization=organization,
        po_number="PO-DEMO-003",
        defaults={
            "warehouse": warehouse,
            "customer_account": retail_partner_account,
            "order_type": OperationOrderType.STANDARD,
            "customer_code": retail_partner_account.code,
            "customer_name": retail_partner_account.name,
            "supplier_code": "SUP-NOVA",
            "supplier_name": "Nova Housewares",
            "supplier_contact_name": "Inbound Planner",
            "supplier_contact_phone": "555-0106",
            "expected_arrival_date": today + timedelta(days=2),
            "reference_code": "INB-DEMO-BOTTLE",
            "status": PurchaseOrderStatus.OPEN,
            "notes": "Seeded replenishment order for insulated bottle inventory demos.",
        },
    )
    _bump(summary, "inbound", created)

    bottle_purchase_order_line, created = PurchaseOrderLine.objects.update_or_create(
        purchase_order=bottle_purchase_order,
        line_number=1,
        defaults={
            "organization": organization,
            "product": insulated_bottle,
            "ordered_qty": Decimal("18.0000"),
            "received_qty": Decimal("6.0000"),
            "unit_cost": Decimal("7.8500"),
            "stock_status": InventoryStatus.AVAILABLE,
            "status": PurchaseOrderLineStatus.PARTIAL,
        },
    )
    _bump(summary, "inbound", created)

    trail_purchase_order, created = PurchaseOrder.objects.update_or_create(
        organization=organization,
        po_number="PO-DEMO-004",
        defaults={
            "warehouse": warehouse,
            "customer_account": wholesale_account,
            "order_type": OperationOrderType.B2B,
            "customer_code": wholesale_account.code,
            "customer_name": wholesale_account.name,
            "supplier_code": "SUP-TRAIL",
            "supplier_name": "Summit Outdoor Supply",
            "supplier_contact_name": "Allocations Desk",
            "supplier_contact_phone": "555-0107",
            "expected_arrival_date": today + timedelta(days=4),
            "reference_code": "INB-DEMO-HEADLAMP",
            "status": PurchaseOrderStatus.OPEN,
            "notes": "Seeded inbound headlamp order to populate pending receival filters.",
        },
    )
    _bump(summary, "inbound", created)

    trail_purchase_order_line, created = PurchaseOrderLine.objects.update_or_create(
        purchase_order=trail_purchase_order,
        line_number=1,
        defaults={
            "organization": organization,
            "product": trail_light,
            "ordered_qty": Decimal("15.0000"),
            "received_qty": ZERO_QUANTITY,
            "unit_cost": Decimal("10.9500"),
            "stock_status": InventoryStatus.AVAILABLE,
            "status": PurchaseOrderLineStatus.OPEN,
        },
    )
    _bump(summary, "inbound", created)

    dropship_order, created = SalesOrder.objects.update_or_create(
        organization=organization,
        order_number="SO-DEMO-001",
        defaults={
            "warehouse": warehouse,
            "customer_account": customer_account,
            "staging_location": shipping_location,
            "order_type": OperationOrderType.DROPSHIP,
            "order_time": now - timedelta(hours=8),
            "requested_ship_date": today,
            "expires_at": now + timedelta(days=2),
            "reference_code": "WEB-1001",
            "status": SalesOrderStatus.PICKING,
            "fulfillment_stage": SalesOrderFulfillmentStage.IN_PROCESS,
            "exception_state": SalesOrderExceptionState.NORMAL,
            "customer_code": customer_account.code,
            "customer_name": customer_account.name,
            "customer_contact_name": customer_account.contact_name,
            "customer_contact_email": customer_account.contact_email,
            "customer_contact_phone": customer_account.contact_phone,
            "package_count": 1,
            "package_type": "Carton",
            "package_weight": Decimal("1.5000"),
            "package_length": Decimal("30.0000"),
            "package_width": Decimal("20.0000"),
            "package_height": Decimal("15.0000"),
            "package_volume": Decimal("0.0090"),
            "logistics_provider": "YUNEXPRESS",
            "shipping_method": "Standard",
            "tracking_number": "YTDEMO123456789",
            "waybill_number": "WB-DEMO-001",
            "waybill_printed": True,
            "waybill_printed_at": now - timedelta(hours=7),
            "deliverer_name": "Demo Deliverer",
            "deliverer_phone": "555-0111",
            "receiver_name": "Taylor Lee",
            "receiver_phone": "555-0112",
            "receiver_country": "US",
            "receiver_state": "CA",
            "receiver_city": "San Francisco",
            "receiver_address": "1 Market Street",
            "receiver_postal_code": "94105",
            "picking_started_at": now - timedelta(hours=6),
            "picking_completed_at": None,
            "packed_at": None,
            "exception_notes": "",
            "notes": "Seeded dropship order.",
        },
    )
    _bump(summary, "outbound", created)

    dropship_line, created = SalesOrderLine.objects.update_or_create(
        sales_order=dropship_order,
        line_number=1,
        defaults={
            "organization": organization,
            "product": product,
            "ordered_qty": THREE_QUANTITY,
            "allocated_qty": TWO_QUANTITY,
            "picked_qty": ONE_QUANTITY,
            "shipped_qty": ZERO_QUANTITY,
            "unit_price": Decimal("18.5000"),
            "stock_status": InventoryStatus.AVAILABLE,
            "status": SalesOrderLineStatus.ALLOCATED,
        },
    )
    _bump(summary, "outbound", created)

    b2b_order, created = SalesOrder.objects.update_or_create(
        organization=organization,
        order_number="SO-B2B-001",
        defaults={
            "warehouse": warehouse,
            "customer_account": customer_account,
            "staging_location": shipping_location,
            "order_type": OperationOrderType.B2B,
            "order_time": now - timedelta(hours=5),
            "requested_ship_date": today + timedelta(days=1),
            "expires_at": now + timedelta(days=5),
            "reference_code": "B2B-REF-001",
            "status": SalesOrderStatus.OPEN,
            "fulfillment_stage": SalesOrderFulfillmentStage.GET_TRACKING_NO,
            "exception_state": SalesOrderExceptionState.NORMAL,
            "customer_code": customer_account.code,
            "customer_name": customer_account.name,
            "customer_contact_name": customer_account.contact_name,
            "customer_contact_email": customer_account.contact_email,
            "customer_contact_phone": customer_account.contact_phone,
            "package_count": 2,
            "package_type": "Pallet",
            "package_weight": Decimal("12.5000"),
            "package_length": Decimal("80.0000"),
            "package_width": Decimal("60.0000"),
            "package_height": Decimal("55.0000"),
            "package_volume": Decimal("0.2640"),
            "logistics_provider": "YUNEXPRESS",
            "shipping_method": "B2B Linehaul",
            "tracking_number": "",
            "waybill_number": "",
            "waybill_printed": False,
            "deliverer_name": "Linehaul Partner",
            "deliverer_phone": "555-0113",
            "receiver_name": "Retail DC",
            "receiver_phone": "555-0114",
            "receiver_country": "US",
            "receiver_state": "NV",
            "receiver_city": "Reno",
            "receiver_address": "200 Distribution Way",
            "receiver_postal_code": "89501",
            "picking_started_at": None,
            "picking_completed_at": None,
            "packed_at": None,
            "exception_notes": "",
            "notes": "Seeded B2B outbound order.",
        },
    )
    _bump(summary, "outbound", created)

    SalesOrderLine.objects.update_or_create(
        sales_order=b2b_order,
        line_number=1,
        defaults={
            "organization": organization,
            "product": product,
            "ordered_qty": FOUR_QUANTITY,
            "allocated_qty": ZERO_QUANTITY,
            "picked_qty": ZERO_QUANTITY,
            "shipped_qty": ZERO_QUANTITY,
            "unit_price": Decimal("16.0000"),
            "stock_status": InventoryStatus.AVAILABLE,
            "status": SalesOrderLineStatus.OPEN,
        },
    )

    bottle_order, created = SalesOrder.objects.update_or_create(
        organization=organization,
        order_number="SO-DEMO-003",
        defaults={
            "warehouse": warehouse,
            "customer_account": retail_partner_account,
            "staging_location": shipping_location,
            "order_type": OperationOrderType.STANDARD,
            "order_time": now - timedelta(hours=4),
            "requested_ship_date": today + timedelta(days=1),
            "expires_at": now + timedelta(days=3),
            "reference_code": "NOVA-2001",
            "status": SalesOrderStatus.OPEN,
            "fulfillment_stage": SalesOrderFulfillmentStage.IN_PROCESS,
            "exception_state": SalesOrderExceptionState.NORMAL,
            "customer_code": retail_partner_account.code,
            "customer_name": retail_partner_account.name,
            "customer_contact_name": retail_partner_account.contact_name,
            "customer_contact_email": retail_partner_account.contact_email,
            "customer_contact_phone": retail_partner_account.contact_phone,
            "package_count": 2,
            "package_type": "Carton",
            "package_weight": Decimal("4.8000"),
            "package_length": Decimal("38.0000"),
            "package_width": Decimal("26.0000"),
            "package_height": Decimal("24.0000"),
            "package_volume": Decimal("0.0237"),
            "logistics_provider": "YUNEXPRESS",
            "shipping_method": "Standard",
            "tracking_number": "",
            "waybill_number": "",
            "waybill_printed": False,
            "deliverer_name": "Demo Deliverer",
            "deliverer_phone": "555-0117",
            "receiver_name": "Nova Retail Fulfillment",
            "receiver_phone": "555-0118",
            "receiver_country": "US",
            "receiver_state": "TX",
            "receiver_city": "Austin",
            "receiver_address": "250 Commerce Boulevard",
            "receiver_postal_code": "78701",
            "picking_started_at": None,
            "picking_completed_at": None,
            "packed_at": None,
            "exception_notes": "",
            "notes": "Seeded open bottle order for client filter demos.",
        },
    )
    _bump(summary, "outbound", created)

    bottle_order_line, created = SalesOrderLine.objects.update_or_create(
        sales_order=bottle_order,
        line_number=1,
        defaults={
            "organization": organization,
            "product": insulated_bottle,
            "ordered_qty": Decimal("6.0000"),
            "allocated_qty": Decimal("6.0000"),
            "picked_qty": ZERO_QUANTITY,
            "shipped_qty": ZERO_QUANTITY,
            "unit_price": Decimal("22.0000"),
            "stock_status": InventoryStatus.AVAILABLE,
            "status": SalesOrderLineStatus.ALLOCATED,
        },
    )
    _bump(summary, "outbound", created)

    bottle_restock_order, created = SalesOrder.objects.update_or_create(
        organization=organization,
        order_number="SO-DEMO-004",
        defaults={
            "warehouse": warehouse,
            "customer_account": customer_account,
            "staging_location": shipping_location,
            "order_type": OperationOrderType.B2B,
            "order_time": now - timedelta(hours=3),
            "requested_ship_date": today + timedelta(days=2),
            "expires_at": now + timedelta(days=6),
            "reference_code": "CLIENT-RESTOCK-01",
            "status": SalesOrderStatus.OPEN,
            "fulfillment_stage": SalesOrderFulfillmentStage.GET_TRACKING_NO,
            "exception_state": SalesOrderExceptionState.NORMAL,
            "customer_code": customer_account.code,
            "customer_name": customer_account.name,
            "customer_contact_name": customer_account.contact_name,
            "customer_contact_email": customer_account.contact_email,
            "customer_contact_phone": customer_account.contact_phone,
            "package_count": 1,
            "package_type": "Master carton",
            "package_weight": Decimal("5.2000"),
            "package_length": Decimal("40.0000"),
            "package_width": Decimal("30.0000"),
            "package_height": Decimal("28.0000"),
            "package_volume": Decimal("0.0336"),
            "logistics_provider": "YUNEXPRESS",
            "shipping_method": "B2B Linehaul",
            "tracking_number": "",
            "waybill_number": "",
            "waybill_printed": False,
            "deliverer_name": "Linehaul Partner",
            "deliverer_phone": "555-0119",
            "receiver_name": "Demo Client Replenishment",
            "receiver_phone": "555-0120",
            "receiver_country": "US",
            "receiver_state": "CA",
            "receiver_city": "Los Angeles",
            "receiver_address": "88 Harbor Drive",
            "receiver_postal_code": "90012",
            "picking_started_at": None,
            "picking_completed_at": None,
            "packed_at": None,
            "exception_notes": "",
            "notes": "Seeded second active bottle order so one SKU shows multiple clients.",
        },
    )
    _bump(summary, "outbound", created)

    bottle_restock_order_line, created = SalesOrderLine.objects.update_or_create(
        sales_order=bottle_restock_order,
        line_number=1,
        defaults={
            "organization": organization,
            "product": insulated_bottle,
            "ordered_qty": Decimal("2.0000"),
            "allocated_qty": Decimal("2.0000"),
            "picked_qty": ZERO_QUANTITY,
            "shipped_qty": ZERO_QUANTITY,
            "unit_price": Decimal("21.2500"),
            "stock_status": InventoryStatus.AVAILABLE,
            "status": SalesOrderLineStatus.ALLOCATED,
        },
    )
    _bump(summary, "outbound", created)

    trail_order, created = SalesOrder.objects.update_or_create(
        organization=organization,
        order_number="SO-DEMO-005",
        defaults={
            "warehouse": warehouse,
            "customer_account": wholesale_account,
            "staging_location": shipping_location,
            "order_type": OperationOrderType.B2B,
            "order_time": now - timedelta(hours=2),
            "requested_ship_date": today + timedelta(days=2),
            "expires_at": now + timedelta(days=7),
            "reference_code": "TRAIL-ALLOC-01",
            "status": SalesOrderStatus.OPEN,
            "fulfillment_stage": SalesOrderFulfillmentStage.GET_TRACKING_NO,
            "exception_state": SalesOrderExceptionState.NORMAL,
            "customer_code": wholesale_account.code,
            "customer_name": wholesale_account.name,
            "customer_contact_name": wholesale_account.contact_name,
            "customer_contact_email": wholesale_account.contact_email,
            "customer_contact_phone": wholesale_account.contact_phone,
            "package_count": 1,
            "package_type": "Carton",
            "package_weight": Decimal("3.4000"),
            "package_length": Decimal("32.0000"),
            "package_width": Decimal("24.0000"),
            "package_height": Decimal("18.0000"),
            "package_volume": Decimal("0.0138"),
            "logistics_provider": "YUNEXPRESS",
            "shipping_method": "Freight consolidation",
            "tracking_number": "",
            "waybill_number": "",
            "waybill_printed": False,
            "deliverer_name": "Wholesale Carrier",
            "deliverer_phone": "555-0121",
            "receiver_name": "TrailMart Regional Hub",
            "receiver_phone": "555-0122",
            "receiver_country": "US",
            "receiver_state": "CO",
            "receiver_city": "Denver",
            "receiver_address": "75 Outdoor Park",
            "receiver_postal_code": "80202",
            "picking_started_at": None,
            "picking_completed_at": None,
            "packed_at": None,
            "exception_notes": "",
            "notes": "Seeded open headlamp order for allocated inventory demos.",
        },
    )
    _bump(summary, "outbound", created)

    trail_order_line, created = SalesOrderLine.objects.update_or_create(
        sales_order=trail_order,
        line_number=1,
        defaults={
            "organization": organization,
            "product": trail_light,
            "ordered_qty": Decimal("4.0000"),
            "allocated_qty": Decimal("4.0000"),
            "picked_qty": ZERO_QUANTITY,
            "shipped_qty": ZERO_QUANTITY,
            "unit_price": Decimal("29.5000"),
            "stock_status": InventoryStatus.AVAILABLE,
            "status": SalesOrderLineStatus.ALLOCATED,
        },
    )
    _bump(summary, "outbound", created)

    pick_task, created = PickTask.objects.update_or_create(
        organization=organization,
        task_number="PK-DEMO-001",
        defaults={
            "sales_order_line": dropship_line,
            "warehouse": warehouse,
            "from_location": storage_location,
            "to_location": shipping_location,
            "quantity": TWO_QUANTITY,
            "stock_status": InventoryStatus.AVAILABLE,
            "lot_number": "LOT-DEMO-001",
            "serial_number": "",
            "status": PickTaskStatus.ASSIGNED,
            "assigned_membership": membership,
            "completed_by": "",
            "completed_at": None,
            "inventory_movement": None,
            "notes": "Seeded pick task.",
        },
    )
    _bump(summary, "outbound", created)

    shipment, created = Shipment.objects.update_or_create(
        organization=organization,
        shipment_number="SHP-DEMO-001",
        defaults={
            "sales_order": dropship_order,
            "warehouse": warehouse,
            "status": ShipmentStatus.POSTED,
            "tracking_number": "YTDEMO123456789",
            "shipped_by": operator_name,
            "shipped_at": now - timedelta(hours=1),
        },
    )
    _bump(summary, "outbound", created)

    shipment_line, created = ShipmentLine.objects.update_or_create(
        shipment=shipment,
        sales_order_line=dropship_line,
        defaults={
            "organization": organization,
            "quantity": ONE_QUANTITY,
            "inventory_movement": None,
        },
    )
    _bump(summary, "outbound", created)

    shipped_order, created = SalesOrder.objects.update_or_create(
        organization=organization,
        order_number="SO-DEMO-002",
        defaults={
            "warehouse": warehouse,
            "customer_account": customer_account,
            "staging_location": shipping_location,
            "order_type": OperationOrderType.STANDARD,
            "order_time": now - timedelta(days=1, hours=2),
            "requested_ship_date": today - timedelta(days=1),
            "expires_at": now + timedelta(days=1),
            "reference_code": "SO-DONE-001",
            "status": SalesOrderStatus.SHIPPED,
            "fulfillment_stage": SalesOrderFulfillmentStage.SHIPPED,
            "exception_state": SalesOrderExceptionState.NORMAL,
            "customer_code": customer_account.code,
            "customer_name": customer_account.name,
            "customer_contact_name": customer_account.contact_name,
            "customer_contact_email": customer_account.contact_email,
            "customer_contact_phone": customer_account.contact_phone,
            "package_count": 1,
            "package_type": "Mailer",
            "package_weight": Decimal("0.9000"),
            "package_length": Decimal("25.0000"),
            "package_width": Decimal("18.0000"),
            "package_height": Decimal("6.0000"),
            "package_volume": Decimal("0.0027"),
            "logistics_provider": "YUNEXPRESS",
            "shipping_method": "Economy",
            "tracking_number": "YTDEMO987654321",
            "waybill_number": "WB-DEMO-002",
            "waybill_printed": True,
            "waybill_printed_at": now - timedelta(days=1, hours=2),
            "deliverer_name": "Demo Deliverer",
            "deliverer_phone": "555-0115",
            "receiver_name": "Jordan Kim",
            "receiver_phone": "555-0116",
            "receiver_country": "US",
            "receiver_state": "WA",
            "receiver_city": "Seattle",
            "receiver_address": "500 Pine Street",
            "receiver_postal_code": "98101",
            "picking_started_at": now - timedelta(days=1, hours=3),
            "picking_completed_at": now - timedelta(days=1, hours=2),
            "packed_at": now - timedelta(days=1, hours=2),
            "exception_notes": "",
            "notes": "Seeded shipped outbound order.",
        },
    )
    _bump(summary, "outbound", created)

    shipped_order_line, created = SalesOrderLine.objects.update_or_create(
        sales_order=shipped_order,
        line_number=1,
        defaults={
            "organization": organization,
            "product": product,
            "ordered_qty": TWO_QUANTITY,
            "allocated_qty": TWO_QUANTITY,
            "picked_qty": TWO_QUANTITY,
            "shipped_qty": TWO_QUANTITY,
            "unit_price": Decimal("17.0000"),
            "stock_status": InventoryStatus.AVAILABLE,
            "status": SalesOrderLineStatus.SHIPPED,
        },
    )
    _bump(summary, "outbound", created)

    shipped_pick_task, created = PickTask.objects.update_or_create(
        organization=organization,
        task_number="PK-DEMO-002",
        defaults={
            "sales_order_line": shipped_order_line,
            "warehouse": warehouse,
            "from_location": storage_location,
            "to_location": shipping_location,
            "quantity": TWO_QUANTITY,
            "stock_status": InventoryStatus.AVAILABLE,
            "lot_number": "LOT-DEMO-001",
            "serial_number": "",
            "status": PickTaskStatus.COMPLETED,
            "assigned_membership": membership,
            "completed_by": operator_name,
            "completed_at": now - timedelta(days=1, hours=2),
            "inventory_movement": None,
            "notes": "Seeded completed pick task.",
        },
    )
    _bump(summary, "outbound", created)

    shipped_shipment, created = Shipment.objects.update_or_create(
        organization=organization,
        shipment_number="SHP-DEMO-002",
        defaults={
            "sales_order": shipped_order,
            "warehouse": warehouse,
            "status": ShipmentStatus.POSTED,
            "tracking_number": "YTDEMO987654321",
            "shipped_by": operator_name,
            "shipped_at": now - timedelta(days=1, hours=1),
        },
    )
    _bump(summary, "outbound", created)

    shipped_shipment_line, created = ShipmentLine.objects.update_or_create(
        shipment=shipped_shipment,
        sales_order_line=shipped_order_line,
        defaults={
            "organization": organization,
            "quantity": TWO_QUANTITY,
            "inventory_movement": None,
        },
    )
    _bump(summary, "outbound", created)

    return_order, created = ReturnOrder.objects.update_or_create(
        organization=organization,
        return_number="RMA-DEMO-001",
        defaults={
            "warehouse": warehouse,
            "customer_account": customer_account,
            "sales_order": dropship_order,
            "order_type": OperationOrderType.DROPSHIP,
            "customer_code": customer_account.code,
            "customer_name": customer_account.name,
            "customer_contact_name": customer_account.contact_name,
            "customer_contact_email": customer_account.contact_email,
            "customer_contact_phone": customer_account.contact_phone,
            "requested_date": today,
            "reference_code": "RET-DEMO",
            "status": ReturnOrderStatus.RECEIVED,
            "notes": "Seeded return order.",
        },
    )
    _bump(summary, "returns", created)

    return_line, created = ReturnLine.objects.update_or_create(
        return_order=return_order,
        line_number=1,
        defaults={
            "organization": organization,
            "product": product,
            "expected_qty": TWO_QUANTITY,
            "received_qty": TWO_QUANTITY,
            "disposed_qty": ONE_QUANTITY,
            "return_reason": "Damaged carton",
            "notes": "Seeded return line.",
            "status": ReturnLineStatus.RECEIVED,
        },
    )
    _bump(summary, "returns", created)

    return_receipt, created = ReturnReceipt.objects.update_or_create(
        organization=organization,
        receipt_number="RTRC-DEMO-001",
        defaults={
            "return_line": return_line,
            "warehouse": warehouse,
            "receipt_location": returns_location,
            "received_qty": TWO_QUANTITY,
            "disposed_qty": ONE_QUANTITY,
            "stock_status": InventoryStatus.AVAILABLE,
            "lot_number": "LOT-DEMO-001",
            "serial_number": "",
            "notes": "Seeded return receipt.",
            "received_by": operator_name,
            "received_at": now - timedelta(hours=2),
            "inventory_movement": None,
        },
    )
    _bump(summary, "returns", created)

    return_disposition, created = ReturnDisposition.objects.update_or_create(
        organization=organization,
        disposition_number="RTDP-DEMO-001",
        defaults={
            "return_receipt": return_receipt,
            "warehouse": warehouse,
            "disposition_type": ReturnDispositionType.RESTOCK,
            "quantity": ONE_QUANTITY,
            "to_location": storage_location,
            "notes": "Seeded return disposition.",
            "completed_by": operator_name,
            "completed_at": now - timedelta(hours=1),
            "inventory_movement": None,
        },
    )
    _bump(summary, "returns", created)

    completed_return_order, created = ReturnOrder.objects.update_or_create(
        organization=organization,
        return_number="RMA-DEMO-002",
        defaults={
            "warehouse": warehouse,
            "customer_account": customer_account,
            "sales_order": shipped_order,
            "order_type": OperationOrderType.STANDARD,
            "customer_code": customer_account.code,
            "customer_name": customer_account.name,
            "customer_contact_name": customer_account.contact_name,
            "customer_contact_email": customer_account.contact_email,
            "customer_contact_phone": customer_account.contact_phone,
            "requested_date": today - timedelta(days=1),
            "reference_code": "RET-DEMO-DONE",
            "status": ReturnOrderStatus.COMPLETED,
            "notes": "Seeded completed return order.",
        },
    )
    _bump(summary, "returns", created)

    completed_return_line, created = ReturnLine.objects.update_or_create(
        return_order=completed_return_order,
        line_number=1,
        defaults={
            "organization": organization,
            "product": product,
            "expected_qty": ONE_QUANTITY,
            "received_qty": ONE_QUANTITY,
            "disposed_qty": ONE_QUANTITY,
            "return_reason": "Relabeled and restocked",
            "notes": "Seeded completed return line.",
            "status": ReturnLineStatus.COMPLETED,
        },
    )
    _bump(summary, "returns", created)

    completed_return_receipt, created = ReturnReceipt.objects.update_or_create(
        organization=organization,
        receipt_number="RTRC-DEMO-002",
        defaults={
            "return_line": completed_return_line,
            "warehouse": warehouse,
            "receipt_location": returns_location,
            "received_qty": ONE_QUANTITY,
            "disposed_qty": ONE_QUANTITY,
            "stock_status": InventoryStatus.AVAILABLE,
            "lot_number": "LOT-DEMO-003",
            "serial_number": "",
            "notes": "Seeded completed return receipt.",
            "received_by": operator_name,
            "received_at": now - timedelta(days=1, hours=1),
            "inventory_movement": None,
        },
    )
    _bump(summary, "returns", created)

    completed_return_disposition, created = ReturnDisposition.objects.update_or_create(
        organization=organization,
        disposition_number="RTDP-DEMO-002",
        defaults={
            "return_receipt": completed_return_receipt,
            "warehouse": warehouse,
            "disposition_type": ReturnDispositionType.RESTOCK,
            "quantity": ONE_QUANTITY,
            "to_location": storage_location,
            "notes": "Seeded completed return disposition.",
            "completed_by": operator_name,
            "completed_at": now - timedelta(days=1),
            "inventory_movement": None,
        },
    )
    _bump(summary, "returns", created)

    logistics_provider, created = LogisticsProvider.objects.update_or_create(
        organization=organization,
        code="YUNEXPRESS",
        defaults={
            "name": "YunExpress",
            "provider_type": LogisticsProvider.ProviderType.CARRIER,
            "integration_mode": LogisticsProvider.IntegrationMode.HYBRID,
            "contact_name": "Carrier Manager",
            "contact_email": "support@yunexpress.test",
            "contact_phone": "555-0120",
            "account_number": "YUN-ACCT-001",
            "api_base_url": "https://api.yunexpress.test",
            "tracking_base_url": "https://tracking.yunexpress.test",
            "supports_online_booking": True,
            "supports_offline_booking": True,
            "notes": "Seeded provider for logistics demos.",
            "is_active": True,
        },
    )
    _bump(summary, "logistics", created)

    logistics_group, created = LogisticsGroup.objects.update_or_create(
        organization=organization,
        code="DEFAULT-DROPSHIP",
        defaults={
            "name": "Default Dropship Routing",
            "description": "Seeded default routing group.",
            "is_active": True,
        },
    )
    _bump(summary, "logistics", created)

    online_channel, created = LogisticsProviderChannel.objects.update_or_create(
        organization=organization,
        provider=logistics_provider,
        code="YUN-US-ONLINE",
        defaults={
            "logistics_group": logistics_group,
            "name": "YunExpress US Online",
            "channel_mode": LogisticsProviderChannel.ChannelMode.ONLINE,
            "transport_mode": LogisticsProviderChannel.TransportMode.EXPRESS,
            "service_level": "US Standard",
            "billing_code": "YUN-STD",
            "supports_waybill": True,
            "supports_tracking": True,
            "supports_scanform": True,
            "supports_manifest": True,
            "supports_relabel": True,
            "is_default": True,
            "is_active": True,
            "notes": "Seeded online channel.",
        },
    )
    _bump(summary, "logistics", created)

    offline_channel, created = LogisticsProviderChannel.objects.update_or_create(
        organization=organization,
        provider=logistics_provider,
        code="YUN-US-OFFLINE",
        defaults={
            "logistics_group": logistics_group,
            "name": "YunExpress US Offline",
            "channel_mode": LogisticsProviderChannel.ChannelMode.OFFLINE,
            "transport_mode": LogisticsProviderChannel.TransportMode.GROUND,
            "service_level": "Offline Injection",
            "billing_code": "YUN-OFF",
            "supports_waybill": True,
            "supports_tracking": True,
            "supports_scanform": False,
            "supports_manifest": True,
            "supports_relabel": True,
            "is_default": False,
            "is_active": True,
            "notes": "Seeded offline channel.",
        },
    )
    _bump(summary, "logistics", created)

    customer_channel, created = CustomerLogisticsChannel.objects.update_or_create(
        organization=organization,
        customer_account=customer_account,
        provider_channel=online_channel,
        defaults={
            "client_channel_name": "Primary Client Channel",
            "external_account_number": "CLIENT-LOG-001",
            "priority": 90,
            "is_default": True,
            "is_active": True,
            "notes": "Seeded customer logistics mapping.",
        },
    )
    _bump(summary, "logistics", created)

    secondary_customer_channel, created = CustomerLogisticsChannel.objects.update_or_create(
        organization=organization,
        customer_account=customer_account,
        provider_channel=offline_channel,
        defaults={
            "client_channel_name": "Fallback Offline Channel",
            "external_account_number": "CLIENT-LOG-002",
            "priority": 60,
            "is_default": False,
            "is_active": True,
            "notes": "Seeded secondary customer logistics mapping.",
        },
    )
    _bump(summary, "logistics", created)

    logistics_rule, created = LogisticsRule.objects.update_or_create(
        organization=organization,
        name="US standard online routing",
        defaults={
            "logistics_group": logistics_group,
            "provider_channel": online_channel,
            "warehouse": warehouse,
            "rule_scope": LogisticsRule.RuleScope.ONLINE,
            "destination_country": "US",
            "destination_state": "CA",
            "shipping_method": "Standard",
            "min_weight_kg": Decimal("0.00"),
            "max_weight_kg": Decimal("30.00"),
            "min_order_value": Decimal("0.00"),
            "max_order_value": Decimal("500.00"),
            "priority": 80,
            "is_active": True,
            "notes": "Seeded routing rule.",
        },
    )
    _bump(summary, "logistics", created)

    partition_rule, created = PartitionRule.objects.update_or_create(
        organization=organization,
        name="B2B partition",
        defaults={
            "logistics_group": logistics_group,
            "provider_channel": offline_channel,
            "partition_key": "ORDER_TYPE",
            "partition_value": OperationOrderType.B2B,
            "handling_action": "Route to offline B2B handling",
            "priority": 75,
            "is_active": True,
            "notes": "Seeded B2B partition.",
        },
    )
    _bump(summary, "logistics", created)

    remote_area_rule, created = RemoteAreaRule.objects.update_or_create(
        organization=organization,
        provider_channel=online_channel,
        country_code="US",
        postal_code_pattern="995*",
        defaults={
            "city_name": "Anchorage",
            "surcharge_amount": Decimal("12.50"),
            "currency": "USD",
            "is_active": True,
        },
    )
    _bump(summary, "logistics", created)

    fuel_rule, created = FuelRule.objects.update_or_create(
        organization=organization,
        provider_channel=online_channel,
        effective_from=today.replace(day=1),
        defaults={
            "effective_to": today.replace(day=1) + timedelta(days=30),
            "surcharge_percent": Decimal("8.50"),
            "minimum_charge": Decimal("0.00"),
            "maximum_charge": Decimal("25.00"),
            "is_active": True,
        },
    )
    _bump(summary, "logistics", created)

    watermark, created = WaybillWatermark.objects.update_or_create(
        organization=organization,
        name="Fragile label",
        defaults={
            "watermark_text": "FRAGILE / HANDLE WITH CARE",
            "position": WaybillWatermark.Position.DIAGONAL,
            "opacity_percent": 28,
            "applies_to_online": True,
            "applies_to_offline": False,
            "is_active": True,
        },
    )
    _bump(summary, "logistics", created)

    charging_strategy, created = LogisticsChargingStrategy.objects.update_or_create(
        organization=organization,
        name="US standard rated shipping",
        defaults={
            "logistics_group": logistics_group,
            "provider_channel": online_channel,
            "charging_basis": LogisticsChargingStrategy.ChargingBasis.PER_PACKAGE,
            "currency": "USD",
            "base_fee": Decimal("2.00"),
            "unit_fee": Decimal("0.75"),
            "minimum_charge": Decimal("3.50"),
            "includes_fuel_rule": True,
            "includes_remote_area_fee": True,
            "is_active": True,
            "notes": "Seeded charging strategy.",
        },
    )
    _bump(summary, "logistics", created)

    special_charging, created = SpecialCustomerLogisticsCharging.objects.update_or_create(
        organization=organization,
        customer_account=customer_account,
        provider_channel=online_channel,
        defaults={
            "charging_strategy": charging_strategy,
            "base_fee_override": Decimal("1.50"),
            "unit_fee_override": Decimal("0.50"),
            "minimum_charge_override": Decimal("2.50"),
            "is_active": True,
            "notes": "Seeded customer-specific logistics charging.",
        },
    )
    _bump(summary, "logistics", created)

    logistics_charge, created = LogisticsCharge.objects.update_or_create(
        organization=organization,
        source_reference="SO-DEMO-001",
        defaults={
            "customer_account": customer_account,
            "provider_channel": online_channel,
            "charging_strategy": charging_strategy,
            "warehouse": warehouse,
            "billing_reference": "BILL-DEMO-001",
            "status": LogisticsCharge.ChargeStatus.PENDING_REVIEW,
            "currency": "USD",
            "base_amount": Decimal("2.00"),
            "fuel_amount": Decimal("0.20"),
            "remote_area_amount": Decimal("0.00"),
            "surcharge_amount": Decimal("0.15"),
            "charged_at": now - timedelta(hours=1),
            "notes": "Seeded logistics charge.",
        },
    )
    _bump(summary, "logistics", created)

    logistics_cost, created = LogisticsCost.objects.update_or_create(
        organization=organization,
        source_reference="SO-DEMO-001",
        defaults={
            "provider_channel": online_channel,
            "warehouse": warehouse,
            "cost_reference": "COST-DEMO-001",
            "status": LogisticsCost.CostStatus.POSTED,
            "currency": "USD",
            "linehaul_amount": Decimal("1.60"),
            "fuel_amount": Decimal("0.18"),
            "remote_area_amount": Decimal("0.00"),
            "other_amount": Decimal("0.10"),
            "incurred_at": now - timedelta(hours=1),
            "notes": "Seeded logistics cost.",
        },
    )
    _bump(summary, "logistics", created)

    completed_logistics_charge, created = LogisticsCharge.objects.update_or_create(
        organization=organization,
        source_reference="SO-DEMO-002",
        defaults={
            "customer_account": customer_account,
            "provider_channel": offline_channel,
            "charging_strategy": charging_strategy,
            "warehouse": warehouse,
            "billing_reference": "BILL-DEMO-002",
            "status": LogisticsCharge.ChargeStatus.APPROVED,
            "currency": "USD",
            "base_amount": Decimal("3.10"),
            "fuel_amount": Decimal("0.25"),
            "remote_area_amount": Decimal("1.25"),
            "surcharge_amount": Decimal("0.00"),
            "charged_at": now - timedelta(days=1, hours=1),
            "notes": "Seeded approved logistics charge.",
        },
    )
    _bump(summary, "logistics", created)

    reconciled_logistics_cost, created = LogisticsCost.objects.update_or_create(
        organization=organization,
        source_reference="SO-DEMO-002",
        defaults={
            "provider_channel": offline_channel,
            "warehouse": warehouse,
            "cost_reference": "COST-DEMO-002",
            "status": LogisticsCost.CostStatus.RECONCILED,
            "currency": "USD",
            "linehaul_amount": Decimal("2.40"),
            "fuel_amount": Decimal("0.20"),
            "remote_area_amount": Decimal("1.00"),
            "other_amount": Decimal("0.15"),
            "incurred_at": now - timedelta(days=1),
            "notes": "Seeded reconciled logistics cost.",
        },
    )
    _bump(summary, "logistics", created)

    charge_item, created = ChargeItem.objects.update_or_create(
        organization=organization,
        code="STORAGE_DAY",
        defaults={
            "name": "Daily storage",
            "category": ChargeItem.Category.STORAGE,
            "billing_basis": ChargeItem.BillingBasis.PER_DAY,
            "default_unit_price": Decimal("2.50"),
            "currency": "USD",
            "unit_label": "day",
            "is_taxable": True,
            "is_active": True,
            "notes": "Seeded fee catalog item.",
        },
    )
    _bump(summary, "fees", created)

    handling_charge_item, created = ChargeItem.objects.update_or_create(
        organization=organization,
        code="HANDLING_ORDER",
        defaults={
            "name": "Order handling",
            "category": ChargeItem.Category.HANDLING,
            "billing_basis": ChargeItem.BillingBasis.PER_ORDER,
            "default_unit_price": Decimal("4.50"),
            "currency": "USD",
            "unit_label": "order",
            "is_taxable": True,
            "is_active": True,
            "notes": "Seeded handling fee item.",
        },
    )
    _bump(summary, "fees", created)

    voucher, created = Voucher.objects.update_or_create(
        organization=organization,
        code="RCG-DEMO-001",
        defaults={
            "customer_account": customer_account,
            "voucher_type": Voucher.VoucherType.RECHARGE,
            "status": Voucher.Status.ACTIVE,
            "face_value": Decimal("500.00"),
            "remaining_value": Decimal("420.00"),
            "currency": "USD",
            "valid_from": today,
            "expires_on": next_month,
            "notes": "Seeded active recharge voucher.",
        },
    )
    _bump(summary, "fees", created)

    redeemed_voucher, created = Voucher.objects.update_or_create(
        organization=organization,
        code="CRD-DEMO-001",
        defaults={
            "customer_account": customer_account,
            "voucher_type": Voucher.VoucherType.CREDIT,
            "status": Voucher.Status.REDEEMED,
            "face_value": Decimal("120.00"),
            "remaining_value": Decimal("0.00"),
            "currency": "USD",
            "valid_from": today - timedelta(days=30),
            "expires_on": today + timedelta(days=30),
            "notes": "Seeded redeemed credit voucher.",
        },
    )
    _bump(summary, "fees", created)

    recharge_transaction, created = BalanceTransaction.objects.update_or_create(
        organization=organization,
        reference_code="BAL-DEMO-RECHARGE",
        defaults={
            "customer_account": customer_account,
            "voucher": voucher,
            "transaction_type": BalanceTransaction.TransactionType.RECHARGE,
            "status": BalanceTransaction.Status.PENDING_REVIEW,
            "amount": Decimal("500.00"),
            "currency": "USD",
            "requested_by_name": operator_name,
            "reviewed_by_name": "",
            "requested_at": now - timedelta(hours=2),
            "reviewed_at": None,
            "notes": "Seeded recharge request.",
        },
    )
    _bump(summary, "fees", created)

    deduction_transaction, created = BalanceTransaction.objects.update_or_create(
        organization=organization,
        reference_code="BAL-DEMO-DEDUCTION",
        defaults={
            "customer_account": customer_account,
            "voucher": None,
            "transaction_type": BalanceTransaction.TransactionType.DEDUCTION,
            "status": BalanceTransaction.Status.PENDING_REVIEW,
            "amount": Decimal("45.00"),
            "currency": "USD",
            "requested_by_name": operator_name,
            "reviewed_by_name": "",
            "requested_at": now - timedelta(hours=1),
            "reviewed_at": None,
            "notes": "Seeded deduction request.",
        },
    )
    _bump(summary, "fees", created)

    posted_transaction, created = BalanceTransaction.objects.update_or_create(
        organization=organization,
        reference_code="BAL-DEMO-POSTED",
        defaults={
            "customer_account": customer_account,
            "voucher": redeemed_voucher,
            "transaction_type": BalanceTransaction.TransactionType.RECHARGE,
            "status": BalanceTransaction.Status.POSTED,
            "amount": Decimal("120.00"),
            "currency": "USD",
            "requested_by_name": operator_name,
            "reviewed_by_name": operator_name,
            "requested_at": now - timedelta(days=1, hours=2),
            "reviewed_at": now - timedelta(days=1, hours=1),
            "notes": "Seeded posted balance transaction.",
        },
    )
    _bump(summary, "fees", created)

    charge_template, created = ChargeTemplate.objects.update_or_create(
        organization=organization,
        code="STORAGE_STD",
        defaults={
            "charge_item": charge_item,
            "warehouse": warehouse,
            "customer_account": customer_account,
            "name": "Standard storage template",
            "default_quantity": Decimal("1.00"),
            "default_unit_price": Decimal("2.50"),
            "currency": "USD",
            "notes": "Seeded fee template.",
            "is_active": True,
        },
    )
    _bump(summary, "fees", created)

    handling_charge_template, created = ChargeTemplate.objects.update_or_create(
        organization=organization,
        code="HANDLING_STD",
        defaults={
            "charge_item": handling_charge_item,
            "warehouse": warehouse,
            "customer_account": customer_account,
            "name": "Standard handling template",
            "default_quantity": Decimal("1.00"),
            "default_unit_price": Decimal("4.50"),
            "currency": "USD",
            "notes": "Seeded handling fee template.",
            "is_active": True,
        },
    )
    _bump(summary, "fees", created)

    manual_charge, created = ManualCharge.objects.update_or_create(
        organization=organization,
        source_reference="MCH-DEMO-001",
        defaults={
            "customer_account": customer_account,
            "warehouse": warehouse,
            "charge_item": charge_item,
            "charge_template": charge_template,
            "status": ManualCharge.Status.PENDING_REVIEW,
            "description": "Manual storage correction",
            "quantity": Decimal("3.00"),
            "unit_price": Decimal("2.50"),
            "currency": "USD",
            "charged_at": now - timedelta(hours=1),
            "notes": "Seeded manual charge.",
        },
    )
    _bump(summary, "fees", created)

    posted_manual_charge, created = ManualCharge.objects.update_or_create(
        organization=organization,
        source_reference="MCH-DEMO-002",
        defaults={
            "customer_account": customer_account,
            "warehouse": warehouse,
            "charge_item": handling_charge_item,
            "charge_template": handling_charge_template,
            "status": ManualCharge.Status.POSTED,
            "description": "Completed handling charge",
            "quantity": Decimal("1.00"),
            "unit_price": Decimal("4.50"),
            "currency": "USD",
            "charged_at": now - timedelta(days=1),
            "notes": "Seeded posted manual charge.",
        },
    )
    _bump(summary, "fees", created)

    fund_flow, created = FundFlow.objects.update_or_create(
        organization=organization,
        reference_code="FLOW-DEMO-001",
        defaults={
            "warehouse": warehouse,
            "customer_account": customer_account,
            "flow_type": FundFlow.FlowType.INBOUND,
            "source_type": "RECHARGE",
            "status": FundFlow.Status.POSTED,
            "amount": Decimal("500.00"),
            "currency": "USD",
            "occurred_at": now - timedelta(hours=1),
            "notes": "Seeded fund flow.",
        },
    )
    _bump(summary, "fees", created)

    outbound_fund_flow, created = FundFlow.objects.update_or_create(
        organization=organization,
        reference_code="FLOW-DEMO-002",
        defaults={
            "warehouse": warehouse,
            "customer_account": customer_account,
            "flow_type": FundFlow.FlowType.OUTBOUND,
            "source_type": "BILLING",
            "status": FundFlow.Status.POSTED,
            "amount": Decimal("135.00"),
            "currency": "USD",
            "occurred_at": now - timedelta(days=1),
            "notes": "Seeded outbound fund flow.",
        },
    )
    _bump(summary, "fees", created)

    rent_detail, created = RentDetail.objects.update_or_create(
        organization=organization,
        warehouse=warehouse,
        customer_account=customer_account,
        period_start=today.replace(day=1),
        period_end=next_month,
        defaults={
            "pallet_positions": 10,
            "bin_positions": 5,
            "area_sqm": Decimal("25.50"),
            "amount": Decimal("1200.00"),
            "currency": "USD",
            "status": RentDetail.Status.ACCRUED,
            "notes": "Seeded rent detail.",
        },
    )
    _bump(summary, "fees", created)

    billed_rent_detail, created = RentDetail.objects.update_or_create(
        organization=organization,
        warehouse=warehouse,
        customer_account=customer_account,
        period_start=(today.replace(day=1) - timedelta(days=30)),
        period_end=today.replace(day=1) - timedelta(days=1),
        defaults={
            "pallet_positions": 8,
            "bin_positions": 4,
            "area_sqm": Decimal("20.00"),
            "amount": Decimal("980.00"),
            "currency": "USD",
            "status": RentDetail.Status.BILLED,
            "notes": "Seeded billed rent detail.",
        },
    )
    _bump(summary, "fees", created)

    business_expense, created = BusinessExpense.objects.update_or_create(
        organization=organization,
        reference_code="EXP-DEMO-001",
        defaults={
            "warehouse": warehouse,
            "vendor_name": "Utility Co",
            "expense_category": "UTILITIES",
            "status": BusinessExpense.Status.PENDING_REVIEW,
            "expense_date": today,
            "amount": Decimal("220.00"),
            "currency": "USD",
            "notes": "Seeded warehouse expense.",
        },
    )
    _bump(summary, "fees", created)

    approved_business_expense, created = BusinessExpense.objects.update_or_create(
        organization=organization,
        reference_code="EXP-DEMO-002",
        defaults={
            "warehouse": warehouse,
            "vendor_name": "Packaging Supplies Co",
            "expense_category": "SUPPLIES",
            "status": BusinessExpense.Status.APPROVED,
            "expense_date": today - timedelta(days=1),
            "amount": Decimal("140.00"),
            "currency": "USD",
            "notes": "Seeded approved business expense.",
        },
    )
    _bump(summary, "fees", created)

    receivable_bill, created = ReceivableBill.objects.update_or_create(
        organization=organization,
        bill_number="ARB-DEMO-001",
        defaults={
            "customer_account": customer_account,
            "warehouse": warehouse,
            "period_start": today.replace(day=1),
            "period_end": next_month,
            "status": ReceivableBill.Status.OPEN,
            "subtotal_amount": Decimal("1400.00"),
            "adjustment_amount": Decimal("-50.00"),
            "currency": "USD",
            "due_at": now + timedelta(days=30),
            "notes": "Seeded receivable bill.",
        },
    )
    _bump(summary, "fees", created)

    paid_receivable_bill, created = ReceivableBill.objects.update_or_create(
        organization=organization,
        bill_number="ARB-DEMO-002",
        defaults={
            "customer_account": customer_account,
            "warehouse": warehouse,
            "period_start": today.replace(day=1) - timedelta(days=30),
            "period_end": today.replace(day=1) - timedelta(days=1),
            "status": ReceivableBill.Status.PAID,
            "subtotal_amount": Decimal("1100.00"),
            "adjustment_amount": Decimal("0.00"),
            "currency": "USD",
            "due_at": now - timedelta(days=2),
            "issued_at": now - timedelta(days=10),
            "notes": "Seeded paid receivable bill.",
        },
    )
    _bump(summary, "fees", created)

    profit_calculation, created = ProfitCalculation.objects.update_or_create(
        organization=organization,
        warehouse=warehouse,
        customer_account=customer_account,
        period_start=today.replace(day=1),
        period_end=next_month,
        defaults={
            "revenue_amount": Decimal("1500.00"),
            "expense_amount": Decimal("300.00"),
            "recharge_amount": Decimal("500.00"),
            "deduction_amount": Decimal("100.00"),
            "receivable_amount": Decimal("1350.00"),
            "status": ProfitCalculation.Status.FINALIZED,
            "generated_at": now,
            "notes": "Seeded profit calculation.",
        },
    )
    _bump(summary, "fees", created)

    draft_profit_calculation, created = ProfitCalculation.objects.update_or_create(
        organization=organization,
        warehouse=warehouse,
        customer_account=customer_account,
        period_start=(today.replace(day=1) - timedelta(days=30)),
        period_end=today.replace(day=1) - timedelta(days=1),
        defaults={
            "revenue_amount": Decimal("1200.00"),
            "expense_amount": Decimal("260.00"),
            "recharge_amount": Decimal("300.00"),
            "deduction_amount": Decimal("60.00"),
            "receivable_amount": Decimal("1100.00"),
            "status": ProfitCalculation.Status.DRAFT,
            "generated_at": now - timedelta(days=2),
            "notes": "Seeded draft profit calculation.",
        },
    )
    _bump(summary, "fees", created)

    work_order_type, created = WorkOrderType.objects.update_or_create(
        organization=organization,
        code="dropship-rush",
        defaults={
            "name": "Dropship rush",
            "description": "High-priority dropship fulfillment tasks.",
            "workstream": WorkOrderType.Workstream.OUTBOUND,
            "default_urgency": WorkOrderType.Urgency.CRITICAL,
            "default_priority_score": 95,
            "target_sla_hours": 6,
            "is_active": True,
        },
    )
    _bump(summary, "workorders", created)

    work_order, created = WorkOrder.objects.update_or_create(
        organization=organization,
        title="Fulfill SO-DEMO-001 first",
        defaults={
            "work_order_type": work_order_type,
            "warehouse": warehouse,
            "customer_account": customer_account,
            "source_reference": dropship_order.order_number,
            "status": WorkOrder.Status.READY,
            "urgency": WorkOrderType.Urgency.CRITICAL,
            "priority_score": 95,
            "assignee_name": "Shift A",
            "scheduled_start_at": now + timedelta(minutes=30),
            "due_at": now + timedelta(hours=6),
            "started_at": None,
            "completed_at": None,
            "estimated_duration_minutes": 45,
            "notes": "Seeded work order for scheduling demo.",
        },
    )
    _bump(summary, "workorders", created)

    completed_work_order, created = WorkOrder.objects.update_or_create(
        organization=organization,
        title="Cycle count CC-DEMO-002 closeout",
        defaults={
            "work_order_type": work_order_type,
            "warehouse": warehouse,
            "customer_account": customer_account,
            "source_reference": completed_cycle_count.count_number,
            "status": WorkOrder.Status.COMPLETED,
            "urgency": WorkOrderType.Urgency.MEDIUM,
            "priority_score": 60,
            "assignee_name": "Shift B",
            "scheduled_start_at": now - timedelta(days=1, hours=3),
            "due_at": now - timedelta(days=1, hours=1),
            "started_at": now - timedelta(days=1, hours=3),
            "completed_at": now - timedelta(days=1, hours=2),
            "estimated_duration_minutes": 30,
            "notes": "Seeded completed work order.",
        },
    )
    _bump(summary, "workorders", created)

    kpi_snapshot, created = WarehouseKpiSnapshot.objects.update_or_create(
        organization=organization,
        warehouse=warehouse,
        snapshot_date=today,
        defaults={
            "generated_at": now,
            "generated_by": operator_name,
            "on_hand_qty": (
                storage_balance.on_hand_qty
                + picking_balance.on_hand_qty
                + bottle_storage_balance.on_hand_qty
                + bottle_picking_balance.on_hand_qty
                + bottle_quarantine_balance.on_hand_qty
                + trail_storage_balance.on_hand_qty
                + trail_picking_balance.on_hand_qty
            ),
            "available_qty": (
                storage_balance.available_qty
                + picking_balance.available_qty
                + bottle_storage_balance.available_qty
                + bottle_picking_balance.available_qty
                + bottle_quarantine_balance.available_qty
                + trail_storage_balance.available_qty
                + trail_picking_balance.available_qty
            ),
            "allocated_qty": (
                storage_balance.allocated_qty
                + picking_balance.allocated_qty
                + bottle_storage_balance.allocated_qty
                + bottle_picking_balance.allocated_qty
                + bottle_quarantine_balance.allocated_qty
                + trail_storage_balance.allocated_qty
                + trail_picking_balance.allocated_qty
            ),
            "hold_qty": (
                storage_balance.hold_qty
                + picking_balance.hold_qty
                + bottle_storage_balance.hold_qty
                + bottle_picking_balance.hold_qty
                + bottle_quarantine_balance.hold_qty
                + trail_storage_balance.hold_qty
                + trail_picking_balance.hold_qty
            ),
            "open_purchase_orders": 4,
            "open_sales_orders": 5,
            "open_putaway_tasks": 1,
            "open_pick_tasks": 1,
            "pending_count_approvals": 1,
            "pending_return_orders": 1,
        },
    )
    _bump(summary, "reporting", created)

    report_export, created = OperationalReportExport.objects.update_or_create(
        organization=organization,
        file_name="inventory-aging-demo.csv",
        defaults={
            "warehouse": warehouse,
            "report_type": OperationalReportType.INVENTORY_AGING,
            "status": OperationalReportStatus.GENERATED,
            "export_format": "csv",
            "date_from": today - timedelta(days=30),
            "date_to": today,
            "parameters": {"warehouse_id": warehouse.id, "stock_status": InventoryStatus.AVAILABLE},
            "row_count": 4,
            "generated_at": now,
            "generated_by": operator_name,
            "content": (
                "sku,location,on_hand_qty\n"
                "SKU-DEMO-001,STO-01,24.0000\n"
                "SKU-DEMO-002,STO-01,18.0000\n"
                "SKU-DEMO-002,QUA-01,3.0000\n"
                "SKU-DEMO-003,STO-01,14.0000\n"
            ),
        },
    )
    _bump(summary, "reporting", created)

    previous_kpi_snapshot, created = WarehouseKpiSnapshot.objects.update_or_create(
        organization=organization,
        warehouse=warehouse,
        snapshot_date=today - timedelta(days=1),
        defaults={
            "generated_at": now - timedelta(days=1),
            "generated_by": operator_name,
            "on_hand_qty": Decimal("72.0000"),
            "available_qty": Decimal("58.0000"),
            "allocated_qty": Decimal("10.0000"),
            "hold_qty": Decimal("4.0000"),
            "open_purchase_orders": 3,
            "open_sales_orders": 4,
            "open_putaway_tasks": 1,
            "open_pick_tasks": 1,
            "pending_count_approvals": 0,
            "pending_return_orders": 0,
        },
    )
    _bump(summary, "reporting", created)

    shipping_report_export, created = OperationalReportExport.objects.update_or_create(
        organization=organization,
        file_name="shipping-throughput-demo.csv",
        defaults={
            "warehouse": warehouse,
            "report_type": OperationalReportType.SHIPPING_THROUGHPUT,
            "status": OperationalReportStatus.GENERATED,
            "export_format": "csv",
            "date_from": today - timedelta(days=7),
            "date_to": today,
            "parameters": {"warehouse_id": warehouse.id, "stage": "shipped"},
            "row_count": 2,
            "generated_at": now - timedelta(hours=2),
            "generated_by": operator_name,
            "content": "order_number,status,shipped_at\nSO-DEMO-001,PICKING,\nSO-DEMO-002,SHIPPED,2026-03-24T12:00:00Z\n",
        },
    )
    _bump(summary, "reporting", created)

    # Keep seeded balances aligned with the seeded hold and workbench counts.
    expected_storage_hold = hold_record.quantity if hold_record.is_active else ZERO_QUANTITY
    if storage_balance.hold_qty != expected_storage_hold:
        storage_balance.hold_qty = expected_storage_hold
        storage_balance.save(update_fields=["hold_qty"])

    return summary
