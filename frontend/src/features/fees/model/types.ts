export interface BalanceTransactionRecord {
  id: number;
  organization_id: number;
  customer_account: number | null;
  customer_account_name: string;
  voucher: number | null;
  voucher_code: string;
  transaction_type: string;
  status: string;
  reference_code: string;
  amount: string;
  currency: string;
  requested_by_name: string;
  reviewed_by_name: string;
  requested_at: string;
  reviewed_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface BalanceTransactionFormValues {
  customer_account: string;
  voucher: string;
  transaction_type: string;
  status: string;
  reference_code: string;
  amount: string;
  currency: string;
  requested_by_name: string;
  reviewed_by_name: string;
  requested_at: string;
  reviewed_at: string;
  notes: string;
}

export interface VoucherRecord {
  id: number;
  organization_id: number;
  customer_account: number | null;
  customer_account_name: string;
  code: string;
  voucher_type: string;
  status: string;
  face_value: string;
  remaining_value: string;
  currency: string;
  valid_from: string;
  expires_on: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface VoucherFormValues {
  customer_account: string;
  code: string;
  voucher_type: string;
  status: string;
  face_value: string;
  remaining_value: string;
  currency: string;
  valid_from: string;
  expires_on: string;
  notes: string;
}

export interface ChargeItemRecord {
  id: number;
  organization_id: number;
  code: string;
  name: string;
  category: string;
  billing_basis: string;
  default_unit_price: string;
  currency: string;
  unit_label: string;
  is_taxable: boolean;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ChargeItemFormValues {
  code: string;
  name: string;
  category: string;
  billing_basis: string;
  default_unit_price: string;
  currency: string;
  unit_label: string;
  is_taxable: boolean;
  is_active: boolean;
  notes: string;
}

export interface ChargeTemplateRecord {
  id: number;
  organization_id: number;
  charge_item: number;
  charge_item_name: string;
  warehouse: number | null;
  warehouse_name: string;
  customer_account: number | null;
  customer_account_name: string;
  code: string;
  name: string;
  default_quantity: string;
  default_unit_price: string;
  currency: string;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChargeTemplateFormValues {
  charge_item: string;
  warehouse: string;
  customer_account: string;
  code: string;
  name: string;
  default_quantity: string;
  default_unit_price: string;
  currency: string;
  notes: string;
  is_active: boolean;
}

export interface ManualChargeRecord {
  id: number;
  organization_id: number;
  customer_account: number | null;
  customer_account_name: string;
  warehouse: number | null;
  warehouse_name: string;
  charge_item: number | null;
  charge_item_name: string;
  charge_template: number | null;
  charge_template_name: string;
  status: string;
  source_reference: string;
  description: string;
  quantity: string;
  unit_price: string;
  amount: string;
  currency: string;
  charged_at: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ManualChargeFormValues {
  customer_account: string;
  warehouse: string;
  charge_item: string;
  charge_template: string;
  status: string;
  source_reference: string;
  description: string;
  quantity: string;
  unit_price: string;
  currency: string;
  charged_at: string;
  notes: string;
}

export interface FundFlowRecord {
  id: number;
  organization_id: number;
  warehouse: number | null;
  warehouse_name: string;
  customer_account: number | null;
  customer_account_name: string;
  flow_type: string;
  source_type: string;
  reference_code: string;
  status: string;
  amount: string;
  currency: string;
  occurred_at: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface FundFlowFormValues {
  warehouse: string;
  customer_account: string;
  flow_type: string;
  source_type: string;
  reference_code: string;
  status: string;
  amount: string;
  currency: string;
  occurred_at: string;
  notes: string;
}

export interface RentDetailRecord {
  id: number;
  organization_id: number;
  warehouse: number;
  warehouse_name: string;
  customer_account: number | null;
  customer_account_name: string;
  period_start: string;
  period_end: string;
  pallet_positions: number;
  bin_positions: number;
  area_sqm: string;
  amount: string;
  currency: string;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface RentDetailFormValues {
  warehouse: string;
  customer_account: string;
  period_start: string;
  period_end: string;
  pallet_positions: string;
  bin_positions: string;
  area_sqm: string;
  amount: string;
  currency: string;
  status: string;
  notes: string;
}

export interface BusinessExpenseRecord {
  id: number;
  organization_id: number;
  warehouse: number | null;
  warehouse_name: string;
  vendor_name: string;
  expense_category: string;
  status: string;
  expense_date: string;
  amount: string;
  currency: string;
  reference_code: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface BusinessExpenseFormValues {
  warehouse: string;
  vendor_name: string;
  expense_category: string;
  status: string;
  expense_date: string;
  amount: string;
  currency: string;
  reference_code: string;
  notes: string;
}

export interface ReceivableBillRecord {
  id: number;
  organization_id: number;
  customer_account: number | null;
  customer_account_name: string;
  warehouse: number | null;
  warehouse_name: string;
  bill_number: string;
  period_start: string;
  period_end: string;
  status: string;
  subtotal_amount: string;
  adjustment_amount: string;
  total_amount: string;
  currency: string;
  due_at: string | null;
  issued_at: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ReceivableBillFormValues {
  customer_account: string;
  warehouse: string;
  bill_number: string;
  period_start: string;
  period_end: string;
  status: string;
  subtotal_amount: string;
  adjustment_amount: string;
  currency: string;
  due_at: string;
  issued_at: string;
  notes: string;
}

export interface ProfitCalculationRecord {
  id: number;
  organization_id: number;
  warehouse: number | null;
  warehouse_name: string;
  customer_account: number | null;
  customer_account_name: string;
  period_start: string;
  period_end: string;
  revenue_amount: string;
  expense_amount: string;
  recharge_amount: string;
  deduction_amount: string;
  receivable_amount: string;
  profit_amount: string;
  margin_percent: string;
  status: string;
  generated_at: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ProfitCalculationFormValues {
  warehouse: string;
  customer_account: string;
  period_start: string;
  period_end: string;
  revenue_amount: string;
  expense_amount: string;
  recharge_amount: string;
  deduction_amount: string;
  receivable_amount: string;
  status: string;
  generated_at: string;
  notes: string;
}

