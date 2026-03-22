import { useEffect, useMemo, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTenantScope } from "@/app/scope-context";
import { buildClientAccountsPath } from "@/features/clients/model/api";
import type { ClientAccountRecord } from "@/features/clients/model/types";
import {
  buildBalanceTransactionDetailPath,
  buildBalanceTransactionsPath,
  buildBusinessExpenseDetailPath,
  buildBusinessExpensesPath,
  buildChargeItemDetailPath,
  buildChargeItemsPath,
  buildChargeTemplateDetailPath,
  buildChargeTemplatesPath,
  buildFundFlowDetailPath,
  buildFundFlowsPath,
  buildOrganizationWarehousesPath,
  buildManualChargeDetailPath,
  buildManualChargesPath,
  buildProfitCalculationDetailPath,
  buildProfitCalculationsPath,
  buildReceivableBillDetailPath,
  buildReceivableBillsPath,
  buildRentDetailDetailPath,
  buildRentDetailsPath,
  buildVoucherDetailPath,
  buildVouchersPath,
} from "@/features/fees/model/api";
import {
  defaultBalanceTransactionFormValues,
  defaultBusinessExpenseFormValues,
  defaultChargeItemFormValues,
  defaultChargeTemplateFormValues,
  defaultFundFlowFormValues,
  defaultManualChargeFormValues,
  defaultProfitCalculationFormValues,
  defaultReceivableBillFormValues,
  defaultRentDetailFormValues,
  defaultVoucherFormValues,
  mapBalanceTransactionToFormValues,
  mapBusinessExpenseToFormValues,
  mapChargeItemToFormValues,
  mapChargeTemplateToFormValues,
  mapFundFlowToFormValues,
  mapManualChargeToFormValues,
  mapProfitCalculationToFormValues,
  mapReceivableBillToFormValues,
  mapRentDetailToFormValues,
  mapVoucherToFormValues,
} from "@/features/fees/model/mappers";
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
import { apiPatch, apiPost } from "@/lib/http";
import { useResource } from "@/shared/hooks/use-resource";
import { parseApiError } from "@/shared/utils/parse-api-error";

interface WarehouseOptionRecord {
  id: number;
  organization_id: number;
  name: string;
  code: string;
  is_active: boolean;
}

interface FeedbackState {
  successMessage: string | null;
  errorMessage: string | null;
}

type FeesSectionValues<TFormValues> = {
  [K in keyof TFormValues]: string | boolean;
};

interface EditableSectionState<TRecord, TFormValues extends FeesSectionValues<TFormValues>> {
  selectedRecord: TRecord | null;
  setSelectedRecord: (record: TRecord | null) => void;
  formValues: TFormValues;
  updateFormValue: <TKey extends keyof TFormValues & string>(key: TKey, value: TFormValues[TKey]) => void;
  clearSelection: () => void;
}

interface SaveMutationOptions<TRecord extends { id: number }, TFormValues> {
  companyId: number | undefined;
  selectedRecord: TRecord | null;
  setSelectedRecord: (record: TRecord | null) => void;
  createPath: (companyId: number) => string;
  updatePath: (companyId: number, recordId: number) => string;
  mapToPayload: (values: TFormValues) => object;
  getSuccessLabel: (record: TRecord) => string;
  resourceLabel: string;
}

interface FeesInquiryRecord {
  id: string;
  inquiry_type: string;
  reference: string;
  status: string;
  amount: string;
  currency: string;
  occurred_at: string;
  customer_name: string;
  warehouse_name: string;
}

function emptyFeedback(): FeedbackState {
  return { successMessage: null, errorMessage: null };
}

function normalizeNullableNumber(value: string) {
  return value ? Number(value) : null;
}

function optionalValue(value: string) {
  return value ? value : undefined;
}

function optionalDateTime(value: string) {
  return value ? value : undefined;
}

function useEditableSection<TRecord, TFormValues extends FeesSectionValues<TFormValues>>(
  defaultValues: TFormValues,
  mapRecordToFormValues: (record: TRecord) => TFormValues,
): EditableSectionState<TRecord, TFormValues> {
  const [selectedRecord, setSelectedRecord] = useState<TRecord | null>(null);
  const [formValues, setFormValues] = useState<TFormValues>(defaultValues);

  useEffect(() => {
    setFormValues(selectedRecord ? mapRecordToFormValues(selectedRecord) : defaultValues);
  }, [defaultValues, mapRecordToFormValues, selectedRecord]);

  return {
    selectedRecord,
    setSelectedRecord,
    formValues,
    updateFormValue: (key, value) => {
      setFormValues((current) => ({ ...current, [key]: value }));
    },
    clearSelection: () => setSelectedRecord(null),
  };
}

function useSectionMutations<TRecord extends { id: number }, TFormValues>({
  companyId,
  selectedRecord,
  setSelectedRecord,
  createPath,
  updatePath,
  mapToPayload,
  getSuccessLabel,
  resourceLabel,
}: SaveMutationOptions<TRecord, TFormValues>) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<FeedbackState>(emptyFeedback);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["fees", companyId] });
  };

  const createMutation = useMutation({
    mutationFn: async (values: TFormValues) => {
      if (!companyId) {
        throw new Error("No active workspace selected");
      }
      return apiPost<TRecord>(createPath(companyId), mapToPayload(values));
    },
    onSuccess: async (record) => {
      setFeedback({ successMessage: `${resourceLabel} ${getSuccessLabel(record)} created.`, errorMessage: null });
      setSelectedRecord(record);
      await invalidate();
    },
    onError: (error) => {
      setFeedback({ successMessage: null, errorMessage: parseApiError(error) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: TFormValues) => {
      if (!companyId || !selectedRecord) {
        throw new Error(`No ${resourceLabel.toLowerCase()} selected`);
      }
      return apiPatch<TRecord>(updatePath(companyId, selectedRecord.id), mapToPayload(values));
    },
    onSuccess: async (record) => {
      setFeedback({ successMessage: `${resourceLabel} ${getSuccessLabel(record)} updated.`, errorMessage: null });
      setSelectedRecord(record);
      await invalidate();
    },
    onError: (error) => {
      setFeedback({ successMessage: null, errorMessage: parseApiError(error) });
    },
  });

  return { createMutation, updateMutation, feedback };
}

export function useFeesController() {
  const { company, activeWarehouse, activeWarehouseId } = useTenantScope();
  const companyId =
    typeof company?.id === "number"
      ? company.id
      : typeof company?.id === "string" && company.id.length > 0
        ? Number(company.id)
        : undefined;

  const customerAccountsQuery = useResource<ClientAccountRecord[]>(
    ["fees", companyId, "customer-accounts"],
    buildClientAccountsPath(companyId ?? "0"),
    undefined,
    { enabled: Boolean(companyId) },
  );
  const warehousesQuery = useResource<WarehouseOptionRecord[]>(
    ["fees", companyId, "warehouses"],
    buildOrganizationWarehousesPath(companyId ?? "0"),
    undefined,
    { enabled: Boolean(companyId) },
  );
  const balanceTransactionsQuery = useResource<BalanceTransactionRecord[]>(
    ["fees", companyId, "balance-transactions"],
    buildBalanceTransactionsPath(companyId ?? "0"),
    undefined,
    { enabled: Boolean(companyId) },
  );
  const vouchersQuery = useResource<VoucherRecord[]>(
    ["fees", companyId, "vouchers"],
    buildVouchersPath(companyId ?? "0"),
    undefined,
    { enabled: Boolean(companyId) },
  );
  const chargeItemsQuery = useResource<ChargeItemRecord[]>(
    ["fees", companyId, "charge-items"],
    buildChargeItemsPath(companyId ?? "0"),
    undefined,
    { enabled: Boolean(companyId) },
  );
  const chargeTemplatesQuery = useResource<ChargeTemplateRecord[]>(
    ["fees", companyId, "charge-templates", activeWarehouseId],
    buildChargeTemplatesPath(companyId ?? "0"),
    { warehouse_id: activeWarehouseId ?? undefined },
    { enabled: Boolean(companyId) },
  );
  const manualChargesQuery = useResource<ManualChargeRecord[]>(
    ["fees", companyId, "manual-charges", activeWarehouseId],
    buildManualChargesPath(companyId ?? "0"),
    { warehouse_id: activeWarehouseId ?? undefined },
    { enabled: Boolean(companyId) },
  );
  const fundFlowsQuery = useResource<FundFlowRecord[]>(
    ["fees", companyId, "fund-flows", activeWarehouseId],
    buildFundFlowsPath(companyId ?? "0"),
    { warehouse_id: activeWarehouseId ?? undefined },
    { enabled: Boolean(companyId) },
  );
  const rentDetailsQuery = useResource<RentDetailRecord[]>(
    ["fees", companyId, "rent-details", activeWarehouseId],
    buildRentDetailsPath(companyId ?? "0"),
    { warehouse_id: activeWarehouseId ?? undefined },
    { enabled: Boolean(companyId) },
  );
  const businessExpensesQuery = useResource<BusinessExpenseRecord[]>(
    ["fees", companyId, "business-expenses", activeWarehouseId],
    buildBusinessExpensesPath(companyId ?? "0"),
    { warehouse_id: activeWarehouseId ?? undefined },
    { enabled: Boolean(companyId) },
  );
  const receivableBillsQuery = useResource<ReceivableBillRecord[]>(
    ["fees", companyId, "receivable-bills", activeWarehouseId],
    buildReceivableBillsPath(companyId ?? "0"),
    { warehouse_id: activeWarehouseId ?? undefined },
    { enabled: Boolean(companyId) },
  );
  const profitCalculationsQuery = useResource<ProfitCalculationRecord[]>(
    ["fees", companyId, "profit-calculations", activeWarehouseId],
    buildProfitCalculationsPath(companyId ?? "0"),
    { warehouse_id: activeWarehouseId ?? undefined },
    { enabled: Boolean(companyId) },
  );

  const balanceTransactionSection = useEditableSection(
    defaultBalanceTransactionFormValues,
    mapBalanceTransactionToFormValues,
  );
  const voucherSection = useEditableSection(defaultVoucherFormValues, mapVoucherToFormValues);
  const chargeItemSection = useEditableSection(defaultChargeItemFormValues, mapChargeItemToFormValues);
  const chargeTemplateSection = useEditableSection(defaultChargeTemplateFormValues, mapChargeTemplateToFormValues);
  const manualChargeSection = useEditableSection(defaultManualChargeFormValues, mapManualChargeToFormValues);
  const fundFlowSection = useEditableSection(defaultFundFlowFormValues, mapFundFlowToFormValues);
  const rentDetailSection = useEditableSection(defaultRentDetailFormValues, mapRentDetailToFormValues);
  const businessExpenseSection = useEditableSection(defaultBusinessExpenseFormValues, mapBusinessExpenseToFormValues);
  const receivableBillSection = useEditableSection(defaultReceivableBillFormValues, mapReceivableBillToFormValues);
  const profitCalculationSection = useEditableSection(
    defaultProfitCalculationFormValues,
    mapProfitCalculationToFormValues,
  );

  const balanceTransactionMutations = useSectionMutations({
    companyId,
    selectedRecord: balanceTransactionSection.selectedRecord,
    setSelectedRecord: balanceTransactionSection.setSelectedRecord,
    createPath: buildBalanceTransactionsPath,
    updatePath: buildBalanceTransactionDetailPath,
    mapToPayload: (values: BalanceTransactionFormValues) => ({
      customer_account: normalizeNullableNumber(values.customer_account),
      voucher: normalizeNullableNumber(values.voucher),
      transaction_type: values.transaction_type,
      status: values.status,
      reference_code: values.reference_code,
      amount: values.amount,
      currency: values.currency,
      requested_by_name: values.requested_by_name,
      reviewed_by_name: values.reviewed_by_name,
      requested_at: optionalDateTime(values.requested_at),
      reviewed_at: values.reviewed_at ? values.reviewed_at : null,
      notes: values.notes,
    }),
    getSuccessLabel: (record) => record.reference_code || String(record.id),
    resourceLabel: "Balance transaction",
  });

  const voucherMutations = useSectionMutations({
    companyId,
    selectedRecord: voucherSection.selectedRecord,
    setSelectedRecord: voucherSection.setSelectedRecord,
    createPath: buildVouchersPath,
    updatePath: buildVoucherDetailPath,
    mapToPayload: (values: VoucherFormValues) => ({
      customer_account: normalizeNullableNumber(values.customer_account),
      code: values.code,
      voucher_type: values.voucher_type,
      status: values.status,
      face_value: values.face_value,
      remaining_value: values.remaining_value,
      currency: values.currency,
      valid_from: optionalValue(values.valid_from),
      expires_on: values.expires_on || null,
      notes: values.notes,
    }),
    getSuccessLabel: (record) => record.code,
    resourceLabel: "Voucher",
  });

  const chargeItemMutations = useSectionMutations({
    companyId,
    selectedRecord: chargeItemSection.selectedRecord,
    setSelectedRecord: chargeItemSection.setSelectedRecord,
    createPath: buildChargeItemsPath,
    updatePath: buildChargeItemDetailPath,
    mapToPayload: (values: ChargeItemFormValues) => values,
    getSuccessLabel: (record) => record.code,
    resourceLabel: "Charge item",
  });

  const chargeTemplateMutations = useSectionMutations({
    companyId,
    selectedRecord: chargeTemplateSection.selectedRecord,
    setSelectedRecord: chargeTemplateSection.setSelectedRecord,
    createPath: buildChargeTemplatesPath,
    updatePath: buildChargeTemplateDetailPath,
    mapToPayload: (values: ChargeTemplateFormValues) => ({
      charge_item: Number(values.charge_item),
      warehouse: normalizeNullableNumber(values.warehouse),
      customer_account: normalizeNullableNumber(values.customer_account),
      code: values.code,
      name: values.name,
      default_quantity: values.default_quantity,
      default_unit_price: values.default_unit_price,
      currency: values.currency,
      notes: values.notes,
      is_active: values.is_active,
    }),
    getSuccessLabel: (record) => record.code,
    resourceLabel: "Charge template",
  });

  const manualChargeMutations = useSectionMutations({
    companyId,
    selectedRecord: manualChargeSection.selectedRecord,
    setSelectedRecord: manualChargeSection.setSelectedRecord,
    createPath: buildManualChargesPath,
    updatePath: buildManualChargeDetailPath,
    mapToPayload: (values: ManualChargeFormValues) => ({
      customer_account: normalizeNullableNumber(values.customer_account),
      warehouse: normalizeNullableNumber(values.warehouse),
      charge_item: normalizeNullableNumber(values.charge_item),
      charge_template: normalizeNullableNumber(values.charge_template),
      status: values.status,
      source_reference: values.source_reference,
      description: values.description,
      quantity: values.quantity,
      unit_price: values.unit_price,
      currency: values.currency,
      charged_at: optionalDateTime(values.charged_at),
      notes: values.notes,
    }),
    getSuccessLabel: (record) => record.source_reference || String(record.id),
    resourceLabel: "Manual charge",
  });

  const fundFlowMutations = useSectionMutations({
    companyId,
    selectedRecord: fundFlowSection.selectedRecord,
    setSelectedRecord: fundFlowSection.setSelectedRecord,
    createPath: buildFundFlowsPath,
    updatePath: buildFundFlowDetailPath,
    mapToPayload: (values: FundFlowFormValues) => ({
      warehouse: normalizeNullableNumber(values.warehouse),
      customer_account: normalizeNullableNumber(values.customer_account),
      flow_type: values.flow_type,
      source_type: values.source_type,
      reference_code: values.reference_code,
      status: values.status,
      amount: values.amount,
      currency: values.currency,
      occurred_at: optionalDateTime(values.occurred_at),
      notes: values.notes,
    }),
    getSuccessLabel: (record) => record.reference_code || String(record.id),
    resourceLabel: "Fund flow",
  });

  const rentDetailMutations = useSectionMutations({
    companyId,
    selectedRecord: rentDetailSection.selectedRecord,
    setSelectedRecord: rentDetailSection.setSelectedRecord,
    createPath: buildRentDetailsPath,
    updatePath: buildRentDetailDetailPath,
    mapToPayload: (values: RentDetailFormValues) => ({
      warehouse: Number(values.warehouse),
      customer_account: normalizeNullableNumber(values.customer_account),
      period_start: optionalValue(values.period_start),
      period_end: optionalValue(values.period_end),
      pallet_positions: Number(values.pallet_positions),
      bin_positions: Number(values.bin_positions),
      area_sqm: values.area_sqm,
      amount: values.amount,
      currency: values.currency,
      status: values.status,
      notes: values.notes,
    }),
    getSuccessLabel: (record) => `${record.period_start}`,
    resourceLabel: "Rent detail",
  });

  const businessExpenseMutations = useSectionMutations({
    companyId,
    selectedRecord: businessExpenseSection.selectedRecord,
    setSelectedRecord: businessExpenseSection.setSelectedRecord,
    createPath: buildBusinessExpensesPath,
    updatePath: buildBusinessExpenseDetailPath,
    mapToPayload: (values: BusinessExpenseFormValues) => ({
      warehouse: normalizeNullableNumber(values.warehouse),
      vendor_name: values.vendor_name,
      expense_category: values.expense_category,
      status: values.status,
      expense_date: optionalValue(values.expense_date),
      amount: values.amount,
      currency: values.currency,
      reference_code: values.reference_code,
      notes: values.notes,
    }),
    getSuccessLabel: (record) => record.reference_code || String(record.id),
    resourceLabel: "Business expense",
  });

  const receivableBillMutations = useSectionMutations({
    companyId,
    selectedRecord: receivableBillSection.selectedRecord,
    setSelectedRecord: receivableBillSection.setSelectedRecord,
    createPath: buildReceivableBillsPath,
    updatePath: buildReceivableBillDetailPath,
    mapToPayload: (values: ReceivableBillFormValues) => ({
      customer_account: normalizeNullableNumber(values.customer_account),
      warehouse: normalizeNullableNumber(values.warehouse),
      bill_number: values.bill_number,
      period_start: optionalValue(values.period_start),
      period_end: optionalValue(values.period_end),
      status: values.status,
      subtotal_amount: values.subtotal_amount,
      adjustment_amount: values.adjustment_amount,
      currency: values.currency,
      due_at: values.due_at || null,
      issued_at: optionalDateTime(values.issued_at),
      notes: values.notes,
    }),
    getSuccessLabel: (record) => record.bill_number,
    resourceLabel: "Receivable bill",
  });

  const profitCalculationMutations = useSectionMutations({
    companyId,
    selectedRecord: profitCalculationSection.selectedRecord,
    setSelectedRecord: profitCalculationSection.setSelectedRecord,
    createPath: buildProfitCalculationsPath,
    updatePath: buildProfitCalculationDetailPath,
    mapToPayload: (values: ProfitCalculationFormValues) => ({
      warehouse: normalizeNullableNumber(values.warehouse),
      customer_account: normalizeNullableNumber(values.customer_account),
      period_start: optionalValue(values.period_start),
      period_end: optionalValue(values.period_end),
      revenue_amount: values.revenue_amount,
      expense_amount: values.expense_amount,
      recharge_amount: values.recharge_amount,
      deduction_amount: values.deduction_amount,
      receivable_amount: values.receivable_amount,
      status: values.status,
      generated_at: optionalDateTime(values.generated_at),
      notes: values.notes,
    }),
    getSuccessLabel: (record) => record.period_start,
    resourceLabel: "Profit calculation",
  });

  const customerAccounts = customerAccountsQuery.data ?? [];
  const warehouses = warehousesQuery.data ?? [];
  const balanceTransactions = balanceTransactionsQuery.data ?? [];
  const vouchers = vouchersQuery.data ?? [];
  const chargeItems = chargeItemsQuery.data ?? [];
  const chargeTemplates = chargeTemplatesQuery.data ?? [];
  const manualCharges = manualChargesQuery.data ?? [];
  const fundFlows = fundFlowsQuery.data ?? [];
  const rentDetails = rentDetailsQuery.data ?? [];
  const businessExpenses = businessExpensesQuery.data ?? [];
  const receivableBills = receivableBillsQuery.data ?? [];
  const profitCalculations = profitCalculationsQuery.data ?? [];

  const feesInquiries = useMemo<FeesInquiryRecord[]>(() => {
    const inquiries: FeesInquiryRecord[] = [
      ...balanceTransactions.map((record) => ({
        id: `balance-${record.id}`,
        inquiry_type: "Recharge / Deduction",
        reference: record.reference_code || record.id.toString(),
        status: record.status,
        amount: record.amount,
        currency: record.currency,
        occurred_at: record.requested_at,
        customer_name: record.customer_account_name || "--",
        warehouse_name: "--",
      })),
      ...manualCharges.map((record) => ({
        id: `manual-${record.id}`,
        inquiry_type: "Charging Manually",
        reference: record.source_reference || record.id.toString(),
        status: record.status,
        amount: record.amount,
        currency: record.currency,
        occurred_at: record.charged_at,
        customer_name: record.customer_account_name || "--",
        warehouse_name: record.warehouse_name || "--",
      })),
      ...receivableBills.map((record) => ({
        id: `bill-${record.id}`,
        inquiry_type: "Receivable Bill",
        reference: record.bill_number,
        status: record.status,
        amount: record.total_amount,
        currency: record.currency,
        occurred_at: record.issued_at,
        customer_name: record.customer_account_name || "--",
        warehouse_name: record.warehouse_name || "--",
      })),
    ];

    return inquiries.sort((left, right) => right.occurred_at.localeCompare(left.occurred_at));
  }, [balanceTransactions, manualCharges, receivableBills]);

  const reviewQueue = balanceTransactions.filter((record) => record.status === "PENDING_REVIEW");

  return {
    company,
    activeWarehouse,
    customerAccounts,
    warehouses,
    balanceTransactions,
    vouchers,
    chargeItems,
    chargeTemplates,
    manualCharges,
    fundFlows,
    rentDetails,
    businessExpenses,
    receivableBills,
    profitCalculations,
    feesInquiries,
    reviewQueue,
    balanceTransactionsQuery,
    vouchersQuery,
    chargeItemsQuery,
    chargeTemplatesQuery,
    manualChargesQuery,
    fundFlowsQuery,
    rentDetailsQuery,
    businessExpensesQuery,
    receivableBillsQuery,
    profitCalculationsQuery,
    balanceTransactionSection,
    voucherSection,
    chargeItemSection,
    chargeTemplateSection,
    manualChargeSection,
    fundFlowSection,
    rentDetailSection,
    businessExpenseSection,
    receivableBillSection,
    profitCalculationSection,
    balanceTransactionMutations,
    voucherMutations,
    chargeItemMutations,
    chargeTemplateMutations,
    manualChargeMutations,
    fundFlowMutations,
    rentDetailMutations,
    businessExpenseMutations,
    receivableBillMutations,
    profitCalculationMutations,
    summary: {
      pendingBalanceReviews: reviewQueue.length,
      activeVouchers: vouchers.filter((record) => record.status === "ACTIVE").length,
      pendingManualCharges: manualCharges.filter((record) => record.status === "PENDING_REVIEW").length,
      openReceivableBills: receivableBills.filter((record) =>
        ["OPEN", "PARTIALLY_PAID"].includes(record.status),
      ).length,
      postedFundFlows: fundFlows.filter((record) => record.status === "POSTED").length,
      latestProfit:
        [...profitCalculations]
          .sort((left, right) => right.generated_at.localeCompare(left.generated_at))[0]
          ?.profit_amount ?? null,
    },
  };
}

