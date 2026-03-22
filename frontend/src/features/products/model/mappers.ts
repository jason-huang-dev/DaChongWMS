import type {
  DistributionProductFormValues,
  DistributionProductRecord,
  ProductFormValues,
  ProductMarkFormValues,
  ProductMarkRecord,
  ProductPackagingFormValues,
  ProductPackagingRecord,
  ProductRecord,
  ProductSerialManagementFormValues,
  ProductSerialManagementRecord,
} from "@/features/products/model/types";

export const defaultProductFormValues: ProductFormValues = {
  sku: "",
  name: "",
  barcode: "",
  unit_of_measure: "EA",
  category: "",
  brand: "",
  description: "",
  is_active: true,
};

export const defaultDistributionProductFormValues: DistributionProductFormValues = {
  customer_account_id: "",
  external_sku: "",
  external_name: "",
  channel_name: "",
  allow_dropshipping_orders: true,
  allow_inbound_goods: true,
  is_active: true,
};

export const defaultProductSerialManagementFormValues: ProductSerialManagementFormValues = {
  tracking_mode: "NONE",
  serial_pattern: "",
  requires_uniqueness: true,
  capture_on_inbound: false,
  capture_on_outbound: false,
  capture_on_returns: false,
};

export const defaultProductPackagingFormValues: ProductPackagingFormValues = {
  package_type: "UNIT",
  package_code: "",
  units_per_package: "1",
  length_cm: "0.00",
  width_cm: "0.00",
  height_cm: "0.00",
  weight_kg: "0.00",
  is_default: false,
  is_active: true,
};

export const defaultProductMarkFormValues: ProductMarkFormValues = {
  mark_type: "CUSTOM",
  value: "",
  notes: "",
  is_active: true,
};

export function mapProductToFormValues(record: ProductRecord): ProductFormValues {
  return {
    sku: record.sku,
    name: record.name,
    barcode: record.barcode,
    unit_of_measure: record.unit_of_measure,
    category: record.category,
    brand: record.brand,
    description: record.description,
    is_active: record.is_active,
  };
}

export function mapDistributionProductToFormValues(record: DistributionProductRecord): DistributionProductFormValues {
  return {
    customer_account_id: String(record.customer_account_id),
    external_sku: record.external_sku,
    external_name: record.external_name,
    channel_name: record.channel_name,
    allow_dropshipping_orders: record.allow_dropshipping_orders,
    allow_inbound_goods: record.allow_inbound_goods,
    is_active: record.is_active,
  };
}

export function mapSerialManagementToFormValues(
  record: ProductSerialManagementRecord | null | undefined,
): ProductSerialManagementFormValues {
  if (!record) {
    return defaultProductSerialManagementFormValues;
  }

  return {
    tracking_mode: record.tracking_mode,
    serial_pattern: record.serial_pattern,
    requires_uniqueness: record.requires_uniqueness,
    capture_on_inbound: record.capture_on_inbound,
    capture_on_outbound: record.capture_on_outbound,
    capture_on_returns: record.capture_on_returns,
  };
}

export function mapPackagingToFormValues(record: ProductPackagingRecord): ProductPackagingFormValues {
  return {
    package_type: record.package_type,
    package_code: record.package_code,
    units_per_package: String(record.units_per_package),
    length_cm: record.length_cm,
    width_cm: record.width_cm,
    height_cm: record.height_cm,
    weight_kg: record.weight_kg,
    is_default: record.is_default,
    is_active: record.is_active,
  };
}

export function mapProductMarkToFormValues(record: ProductMarkRecord): ProductMarkFormValues {
  return {
    mark_type: record.mark_type,
    value: record.value,
    notes: record.notes,
    is_active: record.is_active,
  };
}

export function mapDistributionProductFormToPayload(values: DistributionProductFormValues) {
  return {
    ...values,
    customer_account_id: Number(values.customer_account_id),
  };
}

export function mapProductPackagingFormToPayload(values: ProductPackagingFormValues) {
  return {
    ...values,
    units_per_package: Number(values.units_per_package),
  };
}
