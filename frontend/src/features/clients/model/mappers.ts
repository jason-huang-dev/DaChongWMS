import type { ClientAccountFormValues, ClientAccountRecord } from "@/features/clients/model/types";

export const defaultClientAccountFormValues: ClientAccountFormValues = {
  name: "",
  code: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  billing_email: "",
  shipping_method: "",
  allow_dropshipping_orders: true,
  allow_inbound_goods: true,
  notes: "",
  is_active: true,
};

export function mapClientAccountToFormValues(record: ClientAccountRecord): ClientAccountFormValues {
  return {
    name: record.name,
    code: record.code,
    contact_name: record.contact_name,
    contact_email: record.contact_email,
    contact_phone: record.contact_phone,
    billing_email: record.billing_email,
    shipping_method: record.shipping_method,
    allow_dropshipping_orders: record.allow_dropshipping_orders,
    allow_inbound_goods: record.allow_inbound_goods,
    notes: record.notes,
    is_active: record.is_active,
  };
}
