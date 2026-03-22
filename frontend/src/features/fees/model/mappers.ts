import type {
  BalanceTransactionFormValues,
  BalanceTransactionRecord,
  BusinessExpenseFormValues,
  BusinessExpenseRecord,
  ChargeItemFormValues,
  ChargeItemRecord,
  ChargeTemplateFormValues,
  ChargeTemplateRecord,
  FundFlowFormValues,
  FundFlowRecord,
  ManualChargeFormValues,
  ManualChargeRecord,
  ProfitCalculationFormValues,
  ProfitCalculationRecord,
  ReceivableBillFormValues,
  ReceivableBillRecord,
  RentDetailFormValues,
  RentDetailRecord,
  VoucherFormValues,
  VoucherRecord,
} from "@/features/fees/model/types";

function stringifyId(value: number | null | undefined) {
  return value ? String(value) : "";
}

function toLocalDateTime(value: string | null) {
  return value ? value.slice(0, 16) : "";
}

export const defaultBalanceTransactionFormValues: BalanceTransactionFormValues = {
  customer_account: "",
  voucher: "",
  transaction_type: "RECHARGE",
  status: "PENDING_REVIEW",
  reference_code: "",
  amount: "0.00",
  currency: "USD",
  requested_by_name: "",
  reviewed_by_name: "",
  requested_at: "",
  reviewed_at: "",
  notes: "",
};

export function mapBalanceTransactionToFormValues(record: BalanceTransactionRecord): BalanceTransactionFormValues {
  return {
    customer_account: stringifyId(record.customer_account),
    voucher: stringifyId(record.voucher),
    transaction_type: record.transaction_type,
    status: record.status,
    reference_code: record.reference_code,
    amount: record.amount,
    currency: record.currency,
    requested_by_name: record.requested_by_name,
    reviewed_by_name: record.reviewed_by_name,
    requested_at: toLocalDateTime(record.requested_at),
    reviewed_at: toLocalDateTime(record.reviewed_at),
    notes: record.notes,
  };
}

export const defaultVoucherFormValues: VoucherFormValues = {
  customer_account: "",
  code: "",
  voucher_type: "CREDIT",
  status: "DRAFT",
  face_value: "0.00",
  remaining_value: "0.00",
  currency: "USD",
  valid_from: "",
  expires_on: "",
  notes: "",
};

export function mapVoucherToFormValues(record: VoucherRecord): VoucherFormValues {
  return {
    customer_account: stringifyId(record.customer_account),
    code: record.code,
    voucher_type: record.voucher_type,
    status: record.status,
    face_value: record.face_value,
    remaining_value: record.remaining_value,
    currency: record.currency,
    valid_from: record.valid_from,
    expires_on: record.expires_on ?? "",
    notes: record.notes,
  };
}

export const defaultChargeItemFormValues: ChargeItemFormValues = {
  code: "",
  name: "",
  category: "OTHER",
  billing_basis: "FLAT",
  default_unit_price: "0.00",
  currency: "USD",
  unit_label: "",
  is_taxable: false,
  is_active: true,
  notes: "",
};

export function mapChargeItemToFormValues(record: ChargeItemRecord): ChargeItemFormValues {
  return {
    code: record.code,
    name: record.name,
    category: record.category,
    billing_basis: record.billing_basis,
    default_unit_price: record.default_unit_price,
    currency: record.currency,
    unit_label: record.unit_label,
    is_taxable: record.is_taxable,
    is_active: record.is_active,
    notes: record.notes,
  };
}

export const defaultChargeTemplateFormValues: ChargeTemplateFormValues = {
  charge_item: "",
  warehouse: "",
  customer_account: "",
  code: "",
  name: "",
  default_quantity: "1.00",
  default_unit_price: "0.00",
  currency: "USD",
  notes: "",
  is_active: true,
};

export function mapChargeTemplateToFormValues(record: ChargeTemplateRecord): ChargeTemplateFormValues {
  return {
    charge_item: String(record.charge_item),
    warehouse: stringifyId(record.warehouse),
    customer_account: stringifyId(record.customer_account),
    code: record.code,
    name: record.name,
    default_quantity: record.default_quantity,
    default_unit_price: record.default_unit_price,
    currency: record.currency,
    notes: record.notes,
    is_active: record.is_active,
  };
}

export const defaultManualChargeFormValues: ManualChargeFormValues = {
  customer_account: "",
  warehouse: "",
  charge_item: "",
  charge_template: "",
  status: "PENDING_REVIEW",
  source_reference: "",
  description: "",
  quantity: "1.00",
  unit_price: "0.00",
  currency: "USD",
  charged_at: "",
  notes: "",
};

export function mapManualChargeToFormValues(record: ManualChargeRecord): ManualChargeFormValues {
  return {
    customer_account: stringifyId(record.customer_account),
    warehouse: stringifyId(record.warehouse),
    charge_item: stringifyId(record.charge_item),
    charge_template: stringifyId(record.charge_template),
    status: record.status,
    source_reference: record.source_reference,
    description: record.description,
    quantity: record.quantity,
    unit_price: record.unit_price,
    currency: record.currency,
    charged_at: toLocalDateTime(record.charged_at),
    notes: record.notes,
  };
}

export const defaultFundFlowFormValues: FundFlowFormValues = {
  warehouse: "",
  customer_account: "",
  flow_type: "INBOUND",
  source_type: "",
  reference_code: "",
  status: "POSTED",
  amount: "0.00",
  currency: "USD",
  occurred_at: "",
  notes: "",
};

export function mapFundFlowToFormValues(record: FundFlowRecord): FundFlowFormValues {
  return {
    warehouse: stringifyId(record.warehouse),
    customer_account: stringifyId(record.customer_account),
    flow_type: record.flow_type,
    source_type: record.source_type,
    reference_code: record.reference_code,
    status: record.status,
    amount: record.amount,
    currency: record.currency,
    occurred_at: toLocalDateTime(record.occurred_at),
    notes: record.notes,
  };
}

export const defaultRentDetailFormValues: RentDetailFormValues = {
  warehouse: "",
  customer_account: "",
  period_start: "",
  period_end: "",
  pallet_positions: "0",
  bin_positions: "0",
  area_sqm: "0.00",
  amount: "0.00",
  currency: "USD",
  status: "DRAFT",
  notes: "",
};

export function mapRentDetailToFormValues(record: RentDetailRecord): RentDetailFormValues {
  return {
    warehouse: String(record.warehouse),
    customer_account: stringifyId(record.customer_account),
    period_start: record.period_start,
    period_end: record.period_end,
    pallet_positions: String(record.pallet_positions),
    bin_positions: String(record.bin_positions),
    area_sqm: record.area_sqm,
    amount: record.amount,
    currency: record.currency,
    status: record.status,
    notes: record.notes,
  };
}

export const defaultBusinessExpenseFormValues: BusinessExpenseFormValues = {
  warehouse: "",
  vendor_name: "",
  expense_category: "OTHER",
  status: "PENDING_REVIEW",
  expense_date: "",
  amount: "0.00",
  currency: "USD",
  reference_code: "",
  notes: "",
};

export function mapBusinessExpenseToFormValues(record: BusinessExpenseRecord): BusinessExpenseFormValues {
  return {
    warehouse: stringifyId(record.warehouse),
    vendor_name: record.vendor_name,
    expense_category: record.expense_category,
    status: record.status,
    expense_date: record.expense_date,
    amount: record.amount,
    currency: record.currency,
    reference_code: record.reference_code,
    notes: record.notes,
  };
}

export const defaultReceivableBillFormValues: ReceivableBillFormValues = {
  customer_account: "",
  warehouse: "",
  bill_number: "",
  period_start: "",
  period_end: "",
  status: "DRAFT",
  subtotal_amount: "0.00",
  adjustment_amount: "0.00",
  currency: "USD",
  due_at: "",
  issued_at: "",
  notes: "",
};

export function mapReceivableBillToFormValues(record: ReceivableBillRecord): ReceivableBillFormValues {
  return {
    customer_account: stringifyId(record.customer_account),
    warehouse: stringifyId(record.warehouse),
    bill_number: record.bill_number,
    period_start: record.period_start,
    period_end: record.period_end,
    status: record.status,
    subtotal_amount: record.subtotal_amount,
    adjustment_amount: record.adjustment_amount,
    currency: record.currency,
    due_at: toLocalDateTime(record.due_at),
    issued_at: toLocalDateTime(record.issued_at),
    notes: record.notes,
  };
}

export const defaultProfitCalculationFormValues: ProfitCalculationFormValues = {
  warehouse: "",
  customer_account: "",
  period_start: "",
  period_end: "",
  revenue_amount: "0.00",
  expense_amount: "0.00",
  recharge_amount: "0.00",
  deduction_amount: "0.00",
  receivable_amount: "0.00",
  status: "DRAFT",
  generated_at: "",
  notes: "",
};

export function mapProfitCalculationToFormValues(record: ProfitCalculationRecord): ProfitCalculationFormValues {
  return {
    warehouse: stringifyId(record.warehouse),
    customer_account: stringifyId(record.customer_account),
    period_start: record.period_start,
    period_end: record.period_end,
    revenue_amount: record.revenue_amount,
    expense_amount: record.expense_amount,
    recharge_amount: record.recharge_amount,
    deduction_amount: record.deduction_amount,
    receivable_amount: record.receivable_amount,
    status: record.status,
    generated_at: toLocalDateTime(record.generated_at),
    notes: record.notes,
  };
}

