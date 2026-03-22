function buildFeesBasePath(organizationId: number | string) {
  return `/api/v1/organizations/${organizationId}/fees/`;
}

export function buildBalanceTransactionsPath(organizationId: number | string) {
  return `${buildFeesBasePath(organizationId)}balance-transactions/`;
}

export function buildBalanceTransactionDetailPath(organizationId: number | string, balanceTransactionId: number) {
  return `${buildBalanceTransactionsPath(organizationId)}${balanceTransactionId}/`;
}

export function buildVouchersPath(organizationId: number | string) {
  return `${buildFeesBasePath(organizationId)}vouchers/`;
}

export function buildVoucherDetailPath(organizationId: number | string, voucherId: number) {
  return `${buildVouchersPath(organizationId)}${voucherId}/`;
}

export function buildChargeItemsPath(organizationId: number | string) {
  return `${buildFeesBasePath(organizationId)}charge-items/`;
}

export function buildChargeItemDetailPath(organizationId: number | string, chargeItemId: number) {
  return `${buildChargeItemsPath(organizationId)}${chargeItemId}/`;
}

export function buildChargeTemplatesPath(organizationId: number | string) {
  return `${buildFeesBasePath(organizationId)}charge-templates/`;
}

export function buildChargeTemplateDetailPath(organizationId: number | string, chargeTemplateId: number) {
  return `${buildChargeTemplatesPath(organizationId)}${chargeTemplateId}/`;
}

export function buildManualChargesPath(organizationId: number | string) {
  return `${buildFeesBasePath(organizationId)}manual-charges/`;
}

export function buildManualChargeDetailPath(organizationId: number | string, manualChargeId: number) {
  return `${buildManualChargesPath(organizationId)}${manualChargeId}/`;
}

export function buildFundFlowsPath(organizationId: number | string) {
  return `${buildFeesBasePath(organizationId)}fund-flows/`;
}

export function buildFundFlowDetailPath(organizationId: number | string, fundFlowId: number) {
  return `${buildFundFlowsPath(organizationId)}${fundFlowId}/`;
}

export function buildRentDetailsPath(organizationId: number | string) {
  return `${buildFeesBasePath(organizationId)}rent-details/`;
}

export function buildRentDetailDetailPath(organizationId: number | string, rentDetailId: number) {
  return `${buildRentDetailsPath(organizationId)}${rentDetailId}/`;
}

export function buildBusinessExpensesPath(organizationId: number | string) {
  return `${buildFeesBasePath(organizationId)}business-expenses/`;
}

export function buildBusinessExpenseDetailPath(organizationId: number | string, businessExpenseId: number) {
  return `${buildBusinessExpensesPath(organizationId)}${businessExpenseId}/`;
}

export function buildReceivableBillsPath(organizationId: number | string) {
  return `${buildFeesBasePath(organizationId)}receivable-bills/`;
}

export function buildReceivableBillDetailPath(organizationId: number | string, receivableBillId: number) {
  return `${buildReceivableBillsPath(organizationId)}${receivableBillId}/`;
}

export function buildProfitCalculationsPath(organizationId: number | string) {
  return `${buildFeesBasePath(organizationId)}profit-calculations/`;
}

export function buildProfitCalculationDetailPath(organizationId: number | string, profitCalculationId: number) {
  return `${buildProfitCalculationsPath(organizationId)}${profitCalculationId}/`;
}

export function buildOrganizationWarehousesPath(organizationId: number | string) {
  return `/api/v1/organizations/${organizationId}/warehouses/`;
}

