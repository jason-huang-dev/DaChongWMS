import type { AuthSession } from "@/shared/types/domain";

export const permissionCodes = {
  MANAGE_MEMBERSHIPS: "iam.manage_memberships",
  MANAGE_CLIENT_USERS: "iam.manage_client_users",
  MANAGE_CUSTOMER_ACCOUNTS: "partners.manage_customer_accounts",
  VIEW_CUSTOMER_ACCOUNT: "partners.view_customeraccount",
  VIEW_PRODUCT: "products.view_product",
  MANAGE_PRODUCTS: "products.manage_products",
  MANAGE_DISTRIBUTION_PRODUCTS: "products.manage_distribution_products",
  MANAGE_SERIAL_MANAGEMENT: "products.manage_serial_management",
  MANAGE_PACKAGING: "products.manage_packaging",
  MANAGE_PRODUCT_MARKS: "products.manage_product_marks",
  VIEW_LOGISTICS: "logistics.view_logistics",
  MANAGE_LOGISTICS_PROVIDERS: "logistics.manage_logistics_providers",
  MANAGE_LOGISTICS_RULES: "logistics.manage_logistics_rules",
  MANAGE_LOGISTICS_CHARGING: "logistics.manage_logistics_charging",
  MANAGE_LOGISTICS_COSTS: "logistics.manage_logistics_costs",
  VIEW_FEES: "fees.view_fees",
  MANAGE_BALANCE_TRANSACTIONS: "fees.manage_balance_transactions",
  REVIEW_BALANCE_TRANSACTIONS: "fees.review_balance_transactions",
  MANAGE_VOUCHERS: "fees.manage_vouchers",
  MANAGE_CHARGE_CATALOG: "fees.manage_charge_catalog",
  MANAGE_MANUAL_CHARGES: "fees.manage_manual_charges",
  MANAGE_FUND_FLOWS: "fees.manage_fund_flows",
  MANAGE_RENT_DETAILS: "fees.manage_rent_details",
  MANAGE_BUSINESS_EXPENSES: "fees.manage_business_expenses",
  MANAGE_RECEIVABLE_BILLS: "fees.manage_receivable_bills",
  MANAGE_PROFIT_CALCULATIONS: "fees.manage_profit_calculations",
  VIEW_WORK_ORDER: "workorders.view_workorder",
  MANAGE_WORK_ORDER_TYPES: "workorders.manage_work_order_types",
  MANAGE_WORK_ORDERS: "workorders.manage_work_orders",
  VIEW_REPORTING: "reporting.view_reporting",
  MANAGE_REPORTING: "reporting.manage_reporting",
  VIEW_WAREHOUSE: "warehouse.view_warehouse",
  ADD_WAREHOUSE: "warehouse.add_warehouse",
  CHANGE_WAREHOUSE: "warehouse.change_warehouse",
  DELETE_WAREHOUSE: "warehouse.delete_warehouse",
  VIEW_LOCATIONS: "locations.view_locations",
  MANAGE_LOCATION_TOPOLOGY: "locations.manage_location_topology",
  MANAGE_LOCATION_LOCKS: "locations.manage_location_locks",
  VIEW_INVENTORY: "inventory.view_inventory",
  MANAGE_INVENTORY_RECORDS: "inventory.manage_inventory_records",
  MANAGE_INVENTORY_CONFIGURATION: "inventory.manage_inventory_configuration",
  VIEW_TRANSFERS: "transfers.view_transfers",
  MANAGE_TRANSFER_ORDERS: "transfers.manage_transfer_orders",
  MANAGE_REPLENISHMENT: "transfers.manage_replenishment",
  VIEW_COUNTING: "counting.view_counting",
  MANAGE_COUNTING: "counting.manage_counting",
  MANAGE_COUNT_APPROVALS: "counting.manage_count_approvals",
  VIEW_INBOUND: "inbound.view_inbound",
  MANAGE_INBOUND_ORDERS: "inbound.manage_inbound_orders",
  MANAGE_INBOUND_EXECUTION: "inbound.manage_inbound_execution",
  VIEW_OUTBOUND: "outbound.view_outbound",
  MANAGE_OUTBOUND_ORDERS: "outbound.manage_outbound_orders",
  MANAGE_OUTBOUND_EXECUTION: "outbound.manage_outbound_execution",
  VIEW_RETURNS: "returns.view_returns",
  MANAGE_RETURN_ORDERS: "returns.manage_return_orders",
  MANAGE_RETURN_EXECUTION: "returns.manage_return_execution",
} as const;

export type PermissionCode = (typeof permissionCodes)[keyof typeof permissionCodes];

interface AccessRequirements {
  permissionCodes?: readonly string[];
  permissionGroups?: readonly (readonly string[])[];
}

export function hasAnyPermission(session: AuthSession | null, requiredPermissionCodes?: readonly string[]): boolean {
  if (!requiredPermissionCodes || requiredPermissionCodes.length === 0) {
    return true;
  }
  if (!session) {
    return false;
  }

  const grantedPermissionCodes = new Set(session.permissionCodes ?? []);
  return requiredPermissionCodes.some((permissionCode) => grantedPermissionCodes.has(permissionCode));
}

export function hasEveryPermissionGroup(
  session: AuthSession | null,
  permissionGroups?: readonly (readonly string[])[],
): boolean {
  if (!permissionGroups || permissionGroups.length === 0) {
    return true;
  }

  return permissionGroups.every((permissionGroup) => hasAnyPermission(session, permissionGroup));
}

export function canAccessSurface(session: AuthSession | null, requirements: AccessRequirements): boolean {
  if (requirements.permissionGroups && requirements.permissionGroups.length > 0) {
    return hasEveryPermissionGroup(session, requirements.permissionGroups);
  }
  if (requirements.permissionCodes && requirements.permissionCodes.length > 0) {
    return hasAnyPermission(session, requirements.permissionCodes);
  }
  return true;
}
