import type {
  CustomerLogisticsChannelFormValues,
  CustomerLogisticsChannelRecord,
  FuelRuleFormValues,
  FuelRuleRecord,
  LogisticsChargeFormValues,
  LogisticsChargeRecord,
  LogisticsChargingStrategyFormValues,
  LogisticsChargingStrategyRecord,
  LogisticsCostFormValues,
  LogisticsCostRecord,
  LogisticsGroupFormValues,
  LogisticsGroupRecord,
  LogisticsProviderChannelFormValues,
  LogisticsProviderChannelRecord,
  LogisticsProviderFormValues,
  LogisticsProviderRecord,
  LogisticsRuleFormValues,
  LogisticsRuleRecord,
  PartitionRuleFormValues,
  PartitionRuleRecord,
  RemoteAreaRuleFormValues,
  RemoteAreaRuleRecord,
  SpecialCustomerLogisticsChargingFormValues,
  SpecialCustomerLogisticsChargingRecord,
  WaybillWatermarkFormValues,
  WaybillWatermarkRecord,
} from "@/features/logistics/model/types";

function stringifyId(value: number | null | undefined) {
  return value ? String(value) : "";
}

export const defaultLogisticsProviderFormValues: LogisticsProviderFormValues = {
  code: "",
  name: "",
  provider_type: "CARRIER",
  integration_mode: "HYBRID",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  account_number: "",
  api_base_url: "",
  tracking_base_url: "",
  supports_online_booking: true,
  supports_offline_booking: true,
  notes: "",
  is_active: true,
};

export function mapLogisticsProviderToFormValues(record: LogisticsProviderRecord): LogisticsProviderFormValues {
  return { ...defaultLogisticsProviderFormValues, ...record };
}

export const defaultLogisticsGroupFormValues: LogisticsGroupFormValues = {
  code: "",
  name: "",
  description: "",
  is_active: true,
};

export function mapLogisticsGroupToFormValues(record: LogisticsGroupRecord): LogisticsGroupFormValues {
  return {
    code: record.code,
    name: record.name,
    description: record.description,
    is_active: record.is_active,
  };
}

export const defaultLogisticsProviderChannelFormValues: LogisticsProviderChannelFormValues = {
  provider: "",
  logistics_group: "",
  code: "",
  name: "",
  channel_mode: "ONLINE",
  transport_mode: "EXPRESS",
  service_level: "",
  billing_code: "",
  supports_waybill: true,
  supports_tracking: true,
  supports_scanform: false,
  supports_manifest: false,
  supports_relabel: false,
  is_default: false,
  is_active: true,
  notes: "",
};

export function mapLogisticsProviderChannelToFormValues(
  record: LogisticsProviderChannelRecord,
): LogisticsProviderChannelFormValues {
  return {
    provider: String(record.provider),
    logistics_group: stringifyId(record.logistics_group),
    code: record.code,
    name: record.name,
    channel_mode: record.channel_mode,
    transport_mode: record.transport_mode,
    service_level: record.service_level,
    billing_code: record.billing_code,
    supports_waybill: record.supports_waybill,
    supports_tracking: record.supports_tracking,
    supports_scanform: record.supports_scanform,
    supports_manifest: record.supports_manifest,
    supports_relabel: record.supports_relabel,
    is_default: record.is_default,
    is_active: record.is_active,
    notes: record.notes,
  };
}

export const defaultCustomerLogisticsChannelFormValues: CustomerLogisticsChannelFormValues = {
  customer_account: "",
  provider_channel: "",
  client_channel_name: "",
  external_account_number: "",
  priority: "50",
  is_default: false,
  is_active: true,
  notes: "",
};

export function mapCustomerLogisticsChannelToFormValues(
  record: CustomerLogisticsChannelRecord,
): CustomerLogisticsChannelFormValues {
  return {
    customer_account: String(record.customer_account),
    provider_channel: String(record.provider_channel),
    client_channel_name: record.client_channel_name,
    external_account_number: record.external_account_number,
    priority: String(record.priority),
    is_default: record.is_default,
    is_active: record.is_active,
    notes: record.notes,
  };
}

export const defaultLogisticsRuleFormValues: LogisticsRuleFormValues = {
  logistics_group: "",
  provider_channel: "",
  warehouse: "",
  name: "",
  rule_scope: "GENERAL",
  destination_country: "",
  destination_state: "",
  shipping_method: "",
  min_weight_kg: "0.00",
  max_weight_kg: "0.00",
  min_order_value: "0.00",
  max_order_value: "0.00",
  priority: "50",
  is_active: true,
  notes: "",
};

export function mapLogisticsRuleToFormValues(record: LogisticsRuleRecord): LogisticsRuleFormValues {
  return {
    logistics_group: stringifyId(record.logistics_group),
    provider_channel: stringifyId(record.provider_channel),
    warehouse: stringifyId(record.warehouse),
    name: record.name,
    rule_scope: record.rule_scope,
    destination_country: record.destination_country,
    destination_state: record.destination_state,
    shipping_method: record.shipping_method,
    min_weight_kg: record.min_weight_kg,
    max_weight_kg: record.max_weight_kg,
    min_order_value: record.min_order_value,
    max_order_value: record.max_order_value,
    priority: String(record.priority),
    is_active: record.is_active,
    notes: record.notes,
  };
}

export const defaultPartitionRuleFormValues: PartitionRuleFormValues = {
  logistics_group: "",
  provider_channel: "",
  name: "",
  partition_key: "",
  partition_value: "",
  handling_action: "",
  priority: "50",
  is_active: true,
  notes: "",
};

export function mapPartitionRuleToFormValues(record: PartitionRuleRecord): PartitionRuleFormValues {
  return {
    logistics_group: stringifyId(record.logistics_group),
    provider_channel: stringifyId(record.provider_channel),
    name: record.name,
    partition_key: record.partition_key,
    partition_value: record.partition_value,
    handling_action: record.handling_action,
    priority: String(record.priority),
    is_active: record.is_active,
    notes: record.notes,
  };
}

export const defaultRemoteAreaRuleFormValues: RemoteAreaRuleFormValues = {
  provider_channel: "",
  country_code: "",
  postal_code_pattern: "",
  city_name: "",
  surcharge_amount: "0.00",
  currency: "USD",
  is_active: true,
};

export function mapRemoteAreaRuleToFormValues(record: RemoteAreaRuleRecord): RemoteAreaRuleFormValues {
  return {
    provider_channel: stringifyId(record.provider_channel),
    country_code: record.country_code,
    postal_code_pattern: record.postal_code_pattern,
    city_name: record.city_name,
    surcharge_amount: record.surcharge_amount,
    currency: record.currency,
    is_active: record.is_active,
  };
}

export const defaultFuelRuleFormValues: FuelRuleFormValues = {
  provider_channel: "",
  effective_from: "",
  effective_to: "",
  surcharge_percent: "0.00",
  minimum_charge: "0.00",
  maximum_charge: "0.00",
  is_active: true,
};

export function mapFuelRuleToFormValues(record: FuelRuleRecord): FuelRuleFormValues {
  return {
    provider_channel: stringifyId(record.provider_channel),
    effective_from: record.effective_from,
    effective_to: record.effective_to ?? "",
    surcharge_percent: record.surcharge_percent,
    minimum_charge: record.minimum_charge,
    maximum_charge: record.maximum_charge,
    is_active: record.is_active,
  };
}

export const defaultWaybillWatermarkFormValues: WaybillWatermarkFormValues = {
  name: "",
  watermark_text: "",
  position: "DIAGONAL",
  opacity_percent: "30",
  applies_to_online: true,
  applies_to_offline: true,
  is_active: true,
};

export function mapWaybillWatermarkToFormValues(record: WaybillWatermarkRecord): WaybillWatermarkFormValues {
  return {
    name: record.name,
    watermark_text: record.watermark_text,
    position: record.position,
    opacity_percent: String(record.opacity_percent),
    applies_to_online: record.applies_to_online,
    applies_to_offline: record.applies_to_offline,
    is_active: record.is_active,
  };
}

export const defaultLogisticsChargingStrategyFormValues: LogisticsChargingStrategyFormValues = {
  logistics_group: "",
  provider_channel: "",
  name: "",
  charging_basis: "PER_ORDER",
  currency: "USD",
  base_fee: "0.00",
  unit_fee: "0.00",
  minimum_charge: "0.00",
  includes_fuel_rule: true,
  includes_remote_area_fee: true,
  is_active: true,
  notes: "",
};

export function mapLogisticsChargingStrategyToFormValues(
  record: LogisticsChargingStrategyRecord,
): LogisticsChargingStrategyFormValues {
  return {
    logistics_group: stringifyId(record.logistics_group),
    provider_channel: stringifyId(record.provider_channel),
    name: record.name,
    charging_basis: record.charging_basis,
    currency: record.currency,
    base_fee: record.base_fee,
    unit_fee: record.unit_fee,
    minimum_charge: record.minimum_charge,
    includes_fuel_rule: record.includes_fuel_rule,
    includes_remote_area_fee: record.includes_remote_area_fee,
    is_active: record.is_active,
    notes: record.notes,
  };
}

export const defaultSpecialCustomerLogisticsChargingFormValues: SpecialCustomerLogisticsChargingFormValues = {
  customer_account: "",
  provider_channel: "",
  charging_strategy: "",
  base_fee_override: "0.00",
  unit_fee_override: "0.00",
  minimum_charge_override: "0.00",
  is_active: true,
  notes: "",
};

export function mapSpecialCustomerLogisticsChargingToFormValues(
  record: SpecialCustomerLogisticsChargingRecord,
): SpecialCustomerLogisticsChargingFormValues {
  return {
    customer_account: String(record.customer_account),
    provider_channel: stringifyId(record.provider_channel),
    charging_strategy: stringifyId(record.charging_strategy),
    base_fee_override: record.base_fee_override,
    unit_fee_override: record.unit_fee_override,
    minimum_charge_override: record.minimum_charge_override,
    is_active: record.is_active,
    notes: record.notes,
  };
}

export const defaultLogisticsChargeFormValues: LogisticsChargeFormValues = {
  customer_account: "",
  provider_channel: "",
  charging_strategy: "",
  warehouse: "",
  source_reference: "",
  billing_reference: "",
  status: "DRAFT",
  currency: "USD",
  base_amount: "0.00",
  fuel_amount: "0.00",
  remote_area_amount: "0.00",
  surcharge_amount: "0.00",
  charged_at: "",
  notes: "",
};

export function mapLogisticsChargeToFormValues(record: LogisticsChargeRecord): LogisticsChargeFormValues {
  return {
    customer_account: stringifyId(record.customer_account),
    provider_channel: stringifyId(record.provider_channel),
    charging_strategy: stringifyId(record.charging_strategy),
    warehouse: stringifyId(record.warehouse),
    source_reference: record.source_reference,
    billing_reference: record.billing_reference,
    status: record.status,
    currency: record.currency,
    base_amount: record.base_amount,
    fuel_amount: record.fuel_amount,
    remote_area_amount: record.remote_area_amount,
    surcharge_amount: record.surcharge_amount,
    charged_at: record.charged_at.slice(0, 16),
    notes: record.notes,
  };
}

export const defaultLogisticsCostFormValues: LogisticsCostFormValues = {
  provider_channel: "",
  warehouse: "",
  source_reference: "",
  cost_reference: "",
  status: "DRAFT",
  currency: "USD",
  linehaul_amount: "0.00",
  fuel_amount: "0.00",
  remote_area_amount: "0.00",
  other_amount: "0.00",
  incurred_at: "",
  notes: "",
};

export function mapLogisticsCostToFormValues(record: LogisticsCostRecord): LogisticsCostFormValues {
  return {
    provider_channel: stringifyId(record.provider_channel),
    warehouse: stringifyId(record.warehouse),
    source_reference: record.source_reference,
    cost_reference: record.cost_reference,
    status: record.status,
    currency: record.currency,
    linehaul_amount: record.linehaul_amount,
    fuel_amount: record.fuel_amount,
    remote_area_amount: record.remote_area_amount,
    other_amount: record.other_amount,
    incurred_at: record.incurred_at.slice(0, 16),
    notes: record.notes,
  };
}

