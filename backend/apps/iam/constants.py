from __future__ import annotations

from dataclasses import dataclass
from typing import Final

from apps.organizations.models import MembershipType


class PermissionCode:
    MANAGE_MEMBERSHIPS: Final[str] = "iam.manage_memberships"
    MANAGE_CLIENT_USERS: Final[str] = "iam.manage_client_users"
    MANAGE_CUSTOMER_ACCOUNTS: Final[str] = "partners.manage_customer_accounts"
    MANAGE_CLIENT_ACCOUNT_ACCESS: Final[str] = "partners.manage_client_account_access"
    VIEW_CUSTOMER_ACCOUNT: Final[str] = "partners.view_customeraccount"
    VIEW_CUSTOMER_INVENTORY: Final[str] = "partners.view_inventory"
    VIEW_CUSTOMER_ORDERS: Final[str] = "partners.view_orders"
    VIEW_CUSTOMER_CHARGES: Final[str] = "partners.view_charges"
    SUBMIT_CUSTOMER_DROPSHIPPING_ORDERS: Final[str] = "partners.submit_dropshipping_orders"
    SUBMIT_CUSTOMER_INBOUND_GOODS: Final[str] = "partners.submit_inbound_goods"
    VIEW_PRODUCT: Final[str] = "products.view_product"
    MANAGE_PRODUCTS: Final[str] = "products.manage_products"
    MANAGE_DISTRIBUTION_PRODUCTS: Final[str] = "products.manage_distribution_products"
    MANAGE_SERIAL_MANAGEMENT: Final[str] = "products.manage_serial_management"
    MANAGE_PACKAGING: Final[str] = "products.manage_packaging"
    MANAGE_PRODUCT_MARKS: Final[str] = "products.manage_product_marks"
    VIEW_LOGISTICS: Final[str] = "logistics.view_logistics"
    MANAGE_LOGISTICS_PROVIDERS: Final[str] = "logistics.manage_logistics_providers"
    MANAGE_LOGISTICS_RULES: Final[str] = "logistics.manage_logistics_rules"
    MANAGE_LOGISTICS_CHARGING: Final[str] = "logistics.manage_logistics_charging"
    MANAGE_LOGISTICS_COSTS: Final[str] = "logistics.manage_logistics_costs"
    VIEW_FEES: Final[str] = "fees.view_fees"
    MANAGE_BALANCE_TRANSACTIONS: Final[str] = "fees.manage_balance_transactions"
    REVIEW_BALANCE_TRANSACTIONS: Final[str] = "fees.review_balance_transactions"
    MANAGE_VOUCHERS: Final[str] = "fees.manage_vouchers"
    MANAGE_CHARGE_CATALOG: Final[str] = "fees.manage_charge_catalog"
    MANAGE_MANUAL_CHARGES: Final[str] = "fees.manage_manual_charges"
    MANAGE_FUND_FLOWS: Final[str] = "fees.manage_fund_flows"
    MANAGE_RENT_DETAILS: Final[str] = "fees.manage_rent_details"
    MANAGE_BUSINESS_EXPENSES: Final[str] = "fees.manage_business_expenses"
    MANAGE_RECEIVABLE_BILLS: Final[str] = "fees.manage_receivable_bills"
    MANAGE_PROFIT_CALCULATIONS: Final[str] = "fees.manage_profit_calculations"
    VIEW_WORK_ORDER: Final[str] = "workorders.view_workorder"
    MANAGE_WORK_ORDER_TYPES: Final[str] = "workorders.manage_work_order_types"
    MANAGE_WORK_ORDERS: Final[str] = "workorders.manage_work_orders"
    VIEW_WAREHOUSE: Final[str] = "warehouse.view_warehouse"
    ADD_WAREHOUSE: Final[str] = "warehouse.add_warehouse"
    CHANGE_WAREHOUSE: Final[str] = "warehouse.change_warehouse"
    DELETE_WAREHOUSE: Final[str] = "warehouse.delete_warehouse"


@dataclass(frozen=True, slots=True)
class SystemRoleSpec:
    code: str
    name: str
    membership_type: str
    permissions: tuple[str, ...]


SYSTEM_ROLE_SPECS: Final[tuple[SystemRoleSpec, ...]] = (
    SystemRoleSpec(
        code="OWNER",
        name="Owner",
        membership_type=MembershipType.INTERNAL,
        permissions=(
            PermissionCode.MANAGE_MEMBERSHIPS,
            PermissionCode.MANAGE_CLIENT_USERS,
            PermissionCode.MANAGE_CUSTOMER_ACCOUNTS,
            PermissionCode.MANAGE_CLIENT_ACCOUNT_ACCESS,
            PermissionCode.VIEW_CUSTOMER_ACCOUNT,
            PermissionCode.VIEW_CUSTOMER_INVENTORY,
            PermissionCode.VIEW_CUSTOMER_ORDERS,
            PermissionCode.VIEW_CUSTOMER_CHARGES,
            PermissionCode.SUBMIT_CUSTOMER_DROPSHIPPING_ORDERS,
            PermissionCode.SUBMIT_CUSTOMER_INBOUND_GOODS,
            PermissionCode.VIEW_PRODUCT,
            PermissionCode.MANAGE_PRODUCTS,
            PermissionCode.MANAGE_DISTRIBUTION_PRODUCTS,
            PermissionCode.MANAGE_SERIAL_MANAGEMENT,
            PermissionCode.MANAGE_PACKAGING,
            PermissionCode.MANAGE_PRODUCT_MARKS,
            PermissionCode.VIEW_LOGISTICS,
            PermissionCode.MANAGE_LOGISTICS_PROVIDERS,
            PermissionCode.MANAGE_LOGISTICS_RULES,
            PermissionCode.MANAGE_LOGISTICS_CHARGING,
            PermissionCode.MANAGE_LOGISTICS_COSTS,
            PermissionCode.VIEW_FEES,
            PermissionCode.MANAGE_BALANCE_TRANSACTIONS,
            PermissionCode.REVIEW_BALANCE_TRANSACTIONS,
            PermissionCode.MANAGE_VOUCHERS,
            PermissionCode.MANAGE_CHARGE_CATALOG,
            PermissionCode.MANAGE_MANUAL_CHARGES,
            PermissionCode.MANAGE_FUND_FLOWS,
            PermissionCode.MANAGE_RENT_DETAILS,
            PermissionCode.MANAGE_BUSINESS_EXPENSES,
            PermissionCode.MANAGE_RECEIVABLE_BILLS,
            PermissionCode.MANAGE_PROFIT_CALCULATIONS,
            PermissionCode.VIEW_WORK_ORDER,
            PermissionCode.MANAGE_WORK_ORDER_TYPES,
            PermissionCode.MANAGE_WORK_ORDERS,
            PermissionCode.VIEW_WAREHOUSE,
            PermissionCode.ADD_WAREHOUSE,
            PermissionCode.CHANGE_WAREHOUSE,
            PermissionCode.DELETE_WAREHOUSE,
        ),
    ),
    SystemRoleSpec(
        code="MANAGER",
        name="Manager",
        membership_type=MembershipType.INTERNAL,
        permissions=(
            PermissionCode.MANAGE_MEMBERSHIPS,
            PermissionCode.MANAGE_CUSTOMER_ACCOUNTS,
            PermissionCode.MANAGE_CLIENT_ACCOUNT_ACCESS,
            PermissionCode.VIEW_CUSTOMER_ACCOUNT,
            PermissionCode.VIEW_CUSTOMER_INVENTORY,
            PermissionCode.VIEW_CUSTOMER_ORDERS,
            PermissionCode.VIEW_CUSTOMER_CHARGES,
            PermissionCode.SUBMIT_CUSTOMER_DROPSHIPPING_ORDERS,
            PermissionCode.VIEW_PRODUCT,
            PermissionCode.MANAGE_PRODUCTS,
            PermissionCode.MANAGE_DISTRIBUTION_PRODUCTS,
            PermissionCode.MANAGE_SERIAL_MANAGEMENT,
            PermissionCode.MANAGE_PACKAGING,
            PermissionCode.MANAGE_PRODUCT_MARKS,
            PermissionCode.VIEW_LOGISTICS,
            PermissionCode.MANAGE_LOGISTICS_PROVIDERS,
            PermissionCode.MANAGE_LOGISTICS_RULES,
            PermissionCode.MANAGE_LOGISTICS_CHARGING,
            PermissionCode.MANAGE_LOGISTICS_COSTS,
            PermissionCode.VIEW_FEES,
            PermissionCode.MANAGE_BALANCE_TRANSACTIONS,
            PermissionCode.REVIEW_BALANCE_TRANSACTIONS,
            PermissionCode.MANAGE_VOUCHERS,
            PermissionCode.MANAGE_CHARGE_CATALOG,
            PermissionCode.MANAGE_MANUAL_CHARGES,
            PermissionCode.MANAGE_FUND_FLOWS,
            PermissionCode.MANAGE_RENT_DETAILS,
            PermissionCode.MANAGE_BUSINESS_EXPENSES,
            PermissionCode.MANAGE_RECEIVABLE_BILLS,
            PermissionCode.MANAGE_PROFIT_CALCULATIONS,
            PermissionCode.VIEW_WORK_ORDER,
            PermissionCode.MANAGE_WORK_ORDER_TYPES,
            PermissionCode.MANAGE_WORK_ORDERS,
            PermissionCode.VIEW_WAREHOUSE,
            PermissionCode.ADD_WAREHOUSE,
            PermissionCode.CHANGE_WAREHOUSE,
        ),
    ),
    SystemRoleSpec(
        code="STAFF",
        name="Staff",
        membership_type=MembershipType.INTERNAL,
        permissions=(
            PermissionCode.VIEW_PRODUCT,
            PermissionCode.VIEW_LOGISTICS,
            PermissionCode.VIEW_FEES,
            PermissionCode.VIEW_WORK_ORDER,
            PermissionCode.MANAGE_WORK_ORDERS,
            PermissionCode.VIEW_WAREHOUSE,
        ),
    ),
    SystemRoleSpec(
        code="CLIENT_ADMIN",
        name="Client Admin",
        membership_type=MembershipType.CLIENT,
        permissions=(
            PermissionCode.MANAGE_CLIENT_USERS,
            PermissionCode.VIEW_CUSTOMER_ACCOUNT,
            PermissionCode.VIEW_CUSTOMER_INVENTORY,
            PermissionCode.VIEW_CUSTOMER_ORDERS,
            PermissionCode.VIEW_CUSTOMER_CHARGES,
            PermissionCode.SUBMIT_CUSTOMER_DROPSHIPPING_ORDERS,
            PermissionCode.SUBMIT_CUSTOMER_INBOUND_GOODS,
        ),
    ),
    SystemRoleSpec(
        code="CLIENT_USER",
        name="Client User",
        membership_type=MembershipType.CLIENT,
        permissions=(
            PermissionCode.VIEW_CUSTOMER_ACCOUNT,
            PermissionCode.VIEW_CUSTOMER_INVENTORY,
            PermissionCode.VIEW_CUSTOMER_ORDERS,
            PermissionCode.VIEW_CUSTOMER_CHARGES,
        ),
    ),
)
