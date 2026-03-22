function buildLogisticsBasePath(organizationId: number | string) {
  return `/api/v1/organizations/${organizationId}/logistics/`;
}

export function buildLogisticsProvidersPath(organizationId: number | string) {
  return `${buildLogisticsBasePath(organizationId)}providers/`;
}

export function buildLogisticsProviderDetailPath(organizationId: number | string, providerId: number) {
  return `${buildLogisticsProvidersPath(organizationId)}${providerId}/`;
}

export function buildLogisticsGroupsPath(organizationId: number | string) {
  return `${buildLogisticsBasePath(organizationId)}groups/`;
}

export function buildLogisticsGroupDetailPath(organizationId: number | string, logisticsGroupId: number) {
  return `${buildLogisticsGroupsPath(organizationId)}${logisticsGroupId}/`;
}

export function buildLogisticsProviderChannelsPath(organizationId: number | string) {
  return `${buildLogisticsBasePath(organizationId)}provider-channels/`;
}

export function buildLogisticsProviderChannelDetailPath(organizationId: number | string, providerChannelId: number) {
  return `${buildLogisticsProviderChannelsPath(organizationId)}${providerChannelId}/`;
}

export function buildCustomerLogisticsChannelsPath(organizationId: number | string) {
  return `${buildLogisticsBasePath(organizationId)}customer-channels/`;
}

export function buildCustomerLogisticsChannelDetailPath(organizationId: number | string, customerChannelId: number) {
  return `${buildCustomerLogisticsChannelsPath(organizationId)}${customerChannelId}/`;
}

export function buildLogisticsRulesPath(organizationId: number | string) {
  return `${buildLogisticsBasePath(organizationId)}rules/`;
}

export function buildLogisticsRuleDetailPath(organizationId: number | string, logisticsRuleId: number) {
  return `${buildLogisticsRulesPath(organizationId)}${logisticsRuleId}/`;
}

export function buildPartitionRulesPath(organizationId: number | string) {
  return `${buildLogisticsBasePath(organizationId)}partition-rules/`;
}

export function buildPartitionRuleDetailPath(organizationId: number | string, partitionRuleId: number) {
  return `${buildPartitionRulesPath(organizationId)}${partitionRuleId}/`;
}

export function buildRemoteAreaRulesPath(organizationId: number | string) {
  return `${buildLogisticsBasePath(organizationId)}remote-area-rules/`;
}

export function buildRemoteAreaRuleDetailPath(organizationId: number | string, remoteAreaRuleId: number) {
  return `${buildRemoteAreaRulesPath(organizationId)}${remoteAreaRuleId}/`;
}

export function buildFuelRulesPath(organizationId: number | string) {
  return `${buildLogisticsBasePath(organizationId)}fuel-rules/`;
}

export function buildFuelRuleDetailPath(organizationId: number | string, fuelRuleId: number) {
  return `${buildFuelRulesPath(organizationId)}${fuelRuleId}/`;
}

export function buildWaybillWatermarksPath(organizationId: number | string) {
  return `${buildLogisticsBasePath(organizationId)}waybill-watermarks/`;
}

export function buildWaybillWatermarkDetailPath(organizationId: number | string, waybillWatermarkId: number) {
  return `${buildWaybillWatermarksPath(organizationId)}${waybillWatermarkId}/`;
}

export function buildChargingStrategiesPath(organizationId: number | string) {
  return `${buildLogisticsBasePath(organizationId)}charging-strategies/`;
}

export function buildChargingStrategyDetailPath(organizationId: number | string, chargingStrategyId: number) {
  return `${buildChargingStrategiesPath(organizationId)}${chargingStrategyId}/`;
}

export function buildSpecialCustomerChargingPath(organizationId: number | string) {
  return `${buildLogisticsBasePath(organizationId)}special-customer-charging/`;
}

export function buildSpecialCustomerChargingDetailPath(organizationId: number | string, specialCustomerChargingId: number) {
  return `${buildSpecialCustomerChargingPath(organizationId)}${specialCustomerChargingId}/`;
}

export function buildLogisticsChargesPath(organizationId: number | string) {
  return `${buildLogisticsBasePath(organizationId)}charges/`;
}

export function buildLogisticsChargeDetailPath(organizationId: number | string, logisticsChargeId: number) {
  return `${buildLogisticsChargesPath(organizationId)}${logisticsChargeId}/`;
}

export function buildLogisticsCostsPath(organizationId: number | string) {
  return `${buildLogisticsBasePath(organizationId)}costs/`;
}

export function buildLogisticsCostDetailPath(organizationId: number | string, logisticsCostId: number) {
  return `${buildLogisticsCostsPath(organizationId)}${logisticsCostId}/`;
}

export function buildOrganizationWarehousesPath(organizationId: number | string) {
  return `/api/v1/organizations/${organizationId}/warehouses/`;
}

