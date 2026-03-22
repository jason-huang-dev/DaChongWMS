export interface ProductRecord {
  id: number;
  organization_id: number;
  sku: string;
  name: string;
  barcode: string;
  unit_of_measure: string;
  category: string;
  brand: string;
  description: string;
  is_active: boolean;
}

export interface ProductFormValues {
  sku: string;
  name: string;
  barcode: string;
  unit_of_measure: string;
  category: string;
  brand: string;
  description: string;
  is_active: boolean;
}

export interface DistributionProductRecord {
  id: number;
  product_id: number;
  customer_account_id: number;
  customer_account_name: string;
  customer_account_code: string;
  external_sku: string;
  external_name: string;
  channel_name: string;
  allow_dropshipping_orders: boolean;
  allow_inbound_goods: boolean;
  is_active: boolean;
}

export interface DistributionProductFormValues {
  customer_account_id: string;
  external_sku: string;
  external_name: string;
  channel_name: string;
  allow_dropshipping_orders: boolean;
  allow_inbound_goods: boolean;
  is_active: boolean;
}

export interface ProductSerialManagementRecord {
  id: number | null;
  product_id: number;
  tracking_mode: string;
  serial_pattern: string;
  requires_uniqueness: boolean;
  capture_on_inbound: boolean;
  capture_on_outbound: boolean;
  capture_on_returns: boolean;
}

export interface ProductSerialManagementFormValues {
  tracking_mode: string;
  serial_pattern: string;
  requires_uniqueness: boolean;
  capture_on_inbound: boolean;
  capture_on_outbound: boolean;
  capture_on_returns: boolean;
}

export interface ProductPackagingRecord {
  id: number;
  product_id: number;
  package_type: string;
  package_code: string;
  units_per_package: number;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  weight_kg: string;
  is_default: boolean;
  is_active: boolean;
}

export interface ProductPackagingFormValues {
  package_type: string;
  package_code: string;
  units_per_package: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  weight_kg: string;
  is_default: boolean;
  is_active: boolean;
}

export interface ProductMarkRecord {
  id: number;
  product_id: number;
  mark_type: string;
  value: string;
  notes: string;
  is_active: boolean;
}

export interface ProductMarkFormValues {
  mark_type: string;
  value: string;
  notes: string;
  is_active: boolean;
}
