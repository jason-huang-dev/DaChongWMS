import { permissionCodes } from "@/shared/utils/permissions";

export const securityManagementPermissionCodes = [
  permissionCodes.MANAGE_MEMBERSHIPS,
  permissionCodes.MANAGE_CLIENT_USERS,
] as const;

export const inventoryAccessPermissionCodes = [
  permissionCodes.VIEW_INVENTORY,
  permissionCodes.MANAGE_INVENTORY_RECORDS,
  permissionCodes.MANAGE_INVENTORY_CONFIGURATION,
] as const;

export const inboundAccessPermissionCodes = [
  permissionCodes.VIEW_INBOUND,
  permissionCodes.MANAGE_INBOUND_ORDERS,
  permissionCodes.MANAGE_INBOUND_EXECUTION,
] as const;

export const outboundAccessPermissionCodes = [
  permissionCodes.VIEW_OUTBOUND,
  permissionCodes.MANAGE_OUTBOUND_ORDERS,
  permissionCodes.MANAGE_OUTBOUND_EXECUTION,
] as const;

export const transfersAccessPermissionCodes = [
  permissionCodes.VIEW_TRANSFERS,
  permissionCodes.MANAGE_TRANSFER_ORDERS,
  permissionCodes.MANAGE_REPLENISHMENT,
] as const;

export const returnsAccessPermissionCodes = [
  permissionCodes.VIEW_RETURNS,
  permissionCodes.MANAGE_RETURN_ORDERS,
  permissionCodes.MANAGE_RETURN_EXECUTION,
] as const;

export const clientsAccessPermissionCodes = [
  permissionCodes.MANAGE_CUSTOMER_ACCOUNTS,
] as const;

export const productsAccessPermissionCodes = [
  permissionCodes.VIEW_PRODUCT,
  permissionCodes.MANAGE_PRODUCTS,
  permissionCodes.MANAGE_DISTRIBUTION_PRODUCTS,
  permissionCodes.MANAGE_SERIAL_MANAGEMENT,
  permissionCodes.MANAGE_PACKAGING,
  permissionCodes.MANAGE_PRODUCT_MARKS,
] as const;

export const logisticsAccessPermissionCodes = [
  permissionCodes.VIEW_LOGISTICS,
  permissionCodes.MANAGE_LOGISTICS_PROVIDERS,
  permissionCodes.MANAGE_LOGISTICS_RULES,
  permissionCodes.MANAGE_LOGISTICS_CHARGING,
  permissionCodes.MANAGE_LOGISTICS_COSTS,
] as const;

export const workOrdersAccessPermissionCodes = [
  permissionCodes.VIEW_WORK_ORDER,
  permissionCodes.MANAGE_WORK_ORDERS,
  permissionCodes.MANAGE_WORK_ORDER_TYPES,
] as const;

export const countingAccessPermissionCodes = [
  permissionCodes.VIEW_COUNTING,
  permissionCodes.MANAGE_COUNTING,
  permissionCodes.MANAGE_COUNT_APPROVALS,
] as const;

export const feesAccessPermissionCodes = [
  permissionCodes.VIEW_FEES,
  permissionCodes.MANAGE_BALANCE_TRANSACTIONS,
  permissionCodes.REVIEW_BALANCE_TRANSACTIONS,
  permissionCodes.MANAGE_VOUCHERS,
  permissionCodes.MANAGE_CHARGE_CATALOG,
  permissionCodes.MANAGE_MANUAL_CHARGES,
  permissionCodes.MANAGE_FUND_FLOWS,
  permissionCodes.MANAGE_RENT_DETAILS,
  permissionCodes.MANAGE_BUSINESS_EXPENSES,
  permissionCodes.MANAGE_RECEIVABLE_BILLS,
  permissionCodes.MANAGE_PROFIT_CALCULATIONS,
] as const;

export const reportingAccessPermissionCodes = [
  permissionCodes.VIEW_REPORTING,
  permissionCodes.MANAGE_REPORTING,
] as const;

export const automationAccessPermissionCodes = [
  ...reportingAccessPermissionCodes,
  ...feesAccessPermissionCodes,
] as const;

export const integrationsAccessPermissionCodes = [
  ...inventoryAccessPermissionCodes,
  ...inboundAccessPermissionCodes,
  ...outboundAccessPermissionCodes,
  ...productsAccessPermissionCodes,
  ...logisticsAccessPermissionCodes,
] as const;

export const dashboardOperationsPermissionGroups = [
  countingAccessPermissionCodes,
  inboundAccessPermissionCodes,
  outboundAccessPermissionCodes,
  returnsAccessPermissionCodes,
] as const;

export const b2bPermissionGroups = [
  inboundAccessPermissionCodes,
  outboundAccessPermissionCodes,
] as const;

export const statisticsPermissionGroups = [
  inventoryAccessPermissionCodes,
  inboundAccessPermissionCodes,
  outboundAccessPermissionCodes,
  returnsAccessPermissionCodes,
] as const;
