export interface ClientAccountRecord {
  id: number;
  organization_id: number;
  name: string;
  code: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  billing_email: string;
  shipping_method: string;
  allow_dropshipping_orders: boolean;
  allow_inbound_goods: boolean;
  notes: string;
  is_active: boolean;
}

export interface ClientAccountFormValues {
  name: string;
  code: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  billing_email: string;
  shipping_method: string;
  allow_dropshipping_orders: boolean;
  allow_inbound_goods: boolean;
  notes: string;
  is_active: boolean;
}
