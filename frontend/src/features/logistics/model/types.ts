export interface LogisticsProviderRecord {
  id: number;
  organization_id: number;
  code: string;
  name: string;
  provider_type: string;
  integration_mode: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  account_number: string;
  api_base_url: string;
  tracking_base_url: string;
  supports_online_booking: boolean;
  supports_offline_booking: boolean;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LogisticsProviderFormValues {
  code: string;
  name: string;
  provider_type: string;
  integration_mode: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  account_number: string;
  api_base_url: string;
  tracking_base_url: string;
  supports_online_booking: boolean;
  supports_offline_booking: boolean;
  notes: string;
  is_active: boolean;
}

export interface LogisticsGroupRecord {
  id: number;
  organization_id: number;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LogisticsGroupFormValues {
  code: string;
  name: string;
  description: string;
  is_active: boolean;
}

export interface LogisticsProviderChannelRecord {
  id: number;
  organization_id: number;
  provider: number;
  provider_name: string;
  provider_code: string;
  logistics_group: number | null;
  logistics_group_name: string;
  code: string;
  name: string;
  channel_mode: string;
  transport_mode: string;
  service_level: string;
  billing_code: string;
  supports_waybill: boolean;
  supports_tracking: boolean;
  supports_scanform: boolean;
  supports_manifest: boolean;
  supports_relabel: boolean;
  is_default: boolean;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface LogisticsProviderChannelFormValues {
  provider: string;
  logistics_group: string;
  code: string;
  name: string;
  channel_mode: string;
  transport_mode: string;
  service_level: string;
  billing_code: string;
  supports_waybill: boolean;
  supports_tracking: boolean;
  supports_scanform: boolean;
  supports_manifest: boolean;
  supports_relabel: boolean;
  is_default: boolean;
  is_active: boolean;
  notes: string;
}

export interface CustomerLogisticsChannelRecord {
  id: number;
  organization_id: number;
  customer_account: number;
  customer_account_name: string;
  customer_account_code: string;
  provider_channel: number;
  provider_channel_name: string;
  provider_channel_code: string;
  client_channel_name: string;
  external_account_number: string;
  priority: number;
  is_default: boolean;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerLogisticsChannelFormValues {
  customer_account: string;
  provider_channel: string;
  client_channel_name: string;
  external_account_number: string;
  priority: string;
  is_default: boolean;
  is_active: boolean;
  notes: string;
}

export interface LogisticsRuleRecord {
  id: number;
  organization_id: number;
  logistics_group: number | null;
  logistics_group_name: string;
  provider_channel: number | null;
  provider_channel_name: string;
  warehouse: number | null;
  warehouse_name: string;
  name: string;
  rule_scope: string;
  destination_country: string;
  destination_state: string;
  shipping_method: string;
  min_weight_kg: string;
  max_weight_kg: string;
  min_order_value: string;
  max_order_value: string;
  priority: number;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface LogisticsRuleFormValues {
  logistics_group: string;
  provider_channel: string;
  warehouse: string;
  name: string;
  rule_scope: string;
  destination_country: string;
  destination_state: string;
  shipping_method: string;
  min_weight_kg: string;
  max_weight_kg: string;
  min_order_value: string;
  max_order_value: string;
  priority: string;
  is_active: boolean;
  notes: string;
}

export interface PartitionRuleRecord {
  id: number;
  organization_id: number;
  logistics_group: number | null;
  logistics_group_name: string;
  provider_channel: number | null;
  provider_channel_name: string;
  name: string;
  partition_key: string;
  partition_value: string;
  handling_action: string;
  priority: number;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface PartitionRuleFormValues {
  logistics_group: string;
  provider_channel: string;
  name: string;
  partition_key: string;
  partition_value: string;
  handling_action: string;
  priority: string;
  is_active: boolean;
  notes: string;
}

export interface RemoteAreaRuleRecord {
  id: number;
  organization_id: number;
  provider_channel: number | null;
  provider_channel_name: string;
  country_code: string;
  postal_code_pattern: string;
  city_name: string;
  surcharge_amount: string;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RemoteAreaRuleFormValues {
  provider_channel: string;
  country_code: string;
  postal_code_pattern: string;
  city_name: string;
  surcharge_amount: string;
  currency: string;
  is_active: boolean;
}

export interface FuelRuleRecord {
  id: number;
  organization_id: number;
  provider_channel: number | null;
  provider_channel_name: string;
  effective_from: string;
  effective_to: string | null;
  surcharge_percent: string;
  minimum_charge: string;
  maximum_charge: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FuelRuleFormValues {
  provider_channel: string;
  effective_from: string;
  effective_to: string;
  surcharge_percent: string;
  minimum_charge: string;
  maximum_charge: string;
  is_active: boolean;
}

export interface WaybillWatermarkRecord {
  id: number;
  organization_id: number;
  name: string;
  watermark_text: string;
  position: string;
  opacity_percent: number;
  applies_to_online: boolean;
  applies_to_offline: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WaybillWatermarkFormValues {
  name: string;
  watermark_text: string;
  position: string;
  opacity_percent: string;
  applies_to_online: boolean;
  applies_to_offline: boolean;
  is_active: boolean;
}

export interface LogisticsChargingStrategyRecord {
  id: number;
  organization_id: number;
  logistics_group: number | null;
  logistics_group_name: string;
  provider_channel: number | null;
  provider_channel_name: string;
  name: string;
  charging_basis: string;
  currency: string;
  base_fee: string;
  unit_fee: string;
  minimum_charge: string;
  includes_fuel_rule: boolean;
  includes_remote_area_fee: boolean;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface LogisticsChargingStrategyFormValues {
  logistics_group: string;
  provider_channel: string;
  name: string;
  charging_basis: string;
  currency: string;
  base_fee: string;
  unit_fee: string;
  minimum_charge: string;
  includes_fuel_rule: boolean;
  includes_remote_area_fee: boolean;
  is_active: boolean;
  notes: string;
}

export interface SpecialCustomerLogisticsChargingRecord {
  id: number;
  organization_id: number;
  customer_account: number;
  customer_account_name: string;
  provider_channel: number | null;
  provider_channel_name: string;
  charging_strategy: number | null;
  charging_strategy_name: string;
  base_fee_override: string;
  unit_fee_override: string;
  minimum_charge_override: string;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SpecialCustomerLogisticsChargingFormValues {
  customer_account: string;
  provider_channel: string;
  charging_strategy: string;
  base_fee_override: string;
  unit_fee_override: string;
  minimum_charge_override: string;
  is_active: boolean;
  notes: string;
}

export interface LogisticsChargeRecord {
  id: number;
  organization_id: number;
  customer_account: number | null;
  customer_account_name: string;
  provider_channel: number | null;
  provider_channel_name: string;
  charging_strategy: number | null;
  charging_strategy_name: string;
  warehouse: number | null;
  warehouse_name: string;
  source_reference: string;
  billing_reference: string;
  status: string;
  currency: string;
  base_amount: string;
  fuel_amount: string;
  remote_area_amount: string;
  surcharge_amount: string;
  total_amount: string;
  charged_at: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface LogisticsChargeFormValues {
  customer_account: string;
  provider_channel: string;
  charging_strategy: string;
  warehouse: string;
  source_reference: string;
  billing_reference: string;
  status: string;
  currency: string;
  base_amount: string;
  fuel_amount: string;
  remote_area_amount: string;
  surcharge_amount: string;
  charged_at: string;
  notes: string;
}

export interface LogisticsCostRecord {
  id: number;
  organization_id: number;
  provider_channel: number | null;
  provider_channel_name: string;
  warehouse: number | null;
  warehouse_name: string;
  source_reference: string;
  cost_reference: string;
  status: string;
  currency: string;
  linehaul_amount: string;
  fuel_amount: string;
  remote_area_amount: string;
  other_amount: string;
  total_amount: string;
  incurred_at: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface LogisticsCostFormValues {
  provider_channel: string;
  warehouse: string;
  source_reference: string;
  cost_reference: string;
  status: string;
  currency: string;
  linehaul_amount: string;
  fuel_amount: string;
  remote_area_amount: string;
  other_amount: string;
  incurred_at: string;
  notes: string;
}

