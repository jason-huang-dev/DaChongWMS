export type ClientLifecycleStatus = "PENDING_APPROVAL" | "APPROVED" | "REVIEW_NOT_APPROVED" | "DEACTIVATED";

export interface ClientContactPerson {
  id?: number | string;
  name: string;
  email?: string;
  phone?: string;
}

export interface ClientAccountRecord {
  id: number;
  organization_id: number;
  name: string;
  code: string;
  create_time?: string | null;
  update_time?: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  billing_email: string;
  shipping_method: string;
  allow_dropshipping_orders: boolean;
  allow_inbound_goods: boolean;
  notes: string;
  is_active: boolean;
  approval_status?: ClientLifecycleStatus | string | null;
  company_name?: string | null;
  country_region?: string | null;
  settlement_currency?: string | null;
  distribution_mode?: string | null;
  serial_number_management?: string | null;
  total_available_balance?: number | null;
  credit_limit?: number | null;
  credit_used?: number | null;
  authorized_order_quantity?: number | null;
  limit_balance_documents?: boolean | null;
  charging_template_name?: string | null;
  warehouse_assignments?: string[] | null;
  contact_people?: ClientContactPerson[] | null;
  oms_login_url?: string | null;
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
