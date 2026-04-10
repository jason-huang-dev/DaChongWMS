import Grid from "@mui/material/Grid";
import { Alert, Box, Stack, Typography } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";
import { useFeesController } from "@/features/fees/controller/useFeesController";
import type {
  BalanceTransactionFormValues,
  BusinessExpenseFormValues,
  ChargeItemFormValues,
  ChargeTemplateFormValues,
  FundFlowFormValues,
  ManualChargeFormValues,
  ProfitCalculationFormValues,
  ReceivableBillFormValues,
  RentDetailFormValues,
  VoucherFormValues,
} from "@/features/fees/model/types";
import { FeesEditorCard, type FeesEditorField, type FeesEditorOption } from "@/features/fees/view/components/FeesEditorCard";
import { PageHeader } from "@/shared/components/page-header";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import { useScrollToHash } from "@/shared/hooks/use-scroll-to-hash";
import { SummaryCard } from "@/shared/components/summary-card";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

function buildOptions(records: Array<{ id: number; name?: string; code?: string }>): FeesEditorOption[] {
  return records.map((record) => ({
    value: String(record.id),
    label: record.code ? `${record.code} · ${record.name ?? record.code}` : (record.name ?? String(record.id)),
  }));
}

const balanceTypeOptions: FeesEditorOption[] = [
  { value: "RECHARGE", label: "Recharge" },
  { value: "DEDUCTION", label: "Deduction" },
];

const reviewStatusOptions: FeesEditorOption[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_REVIEW", label: "Pending review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "POSTED", label: "Posted" },
];

const voucherTypeOptions: FeesEditorOption[] = [
  { value: "RECHARGE", label: "Recharge" },
  { value: "DEDUCTION", label: "Deduction" },
  { value: "CREDIT", label: "Credit" },
  { value: "ADJUSTMENT", label: "Adjustment" },
];

const voucherStatusOptions: FeesEditorOption[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "REDEEMED", label: "Redeemed" },
  { value: "EXPIRED", label: "Expired" },
  { value: "VOID", label: "Void" },
];

const chargeCategoryOptions: FeesEditorOption[] = [
  { value: "STORAGE", label: "Storage" },
  { value: "HANDLING", label: "Handling" },
  { value: "RECHARGE", label: "Recharge" },
  { value: "DEDUCTION", label: "Deduction" },
  { value: "RENT", label: "Rent" },
  { value: "LOGISTICS", label: "Logistics" },
  { value: "MANUAL", label: "Manual" },
  { value: "OTHER", label: "Other" },
];

const billingBasisOptions: FeesEditorOption[] = [
  { value: "FLAT", label: "Flat" },
  { value: "QUANTITY", label: "Quantity" },
  { value: "PER_DAY", label: "Per day" },
  { value: "PER_MONTH", label: "Per month" },
  { value: "PER_ORDER", label: "Per order" },
  { value: "PER_PALLET", label: "Per pallet" },
];

const flowTypeOptions: FeesEditorOption[] = [
  { value: "INBOUND", label: "Inbound" },
  { value: "OUTBOUND", label: "Outbound" },
];

const fundFlowStatusOptions: FeesEditorOption[] = [
  { value: "PENDING", label: "Pending" },
  { value: "POSTED", label: "Posted" },
  { value: "REVERSED", label: "Reversed" },
];

const rentStatusOptions: FeesEditorOption[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACCRUED", label: "Accrued" },
  { value: "BILLED", label: "Billed" },
];

const expenseCategoryOptions: FeesEditorOption[] = [
  { value: "RENT", label: "Rent" },
  { value: "UTILITIES", label: "Utilities" },
  { value: "LABOR", label: "Labor" },
  { value: "LOGISTICS", label: "Logistics" },
  { value: "SUPPLIES", label: "Supplies" },
  { value: "OTHER", label: "Other" },
];

const billStatusOptions: FeesEditorOption[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "OPEN", label: "Open" },
  { value: "PARTIALLY_PAID", label: "Partially paid" },
  { value: "PAID", label: "Paid" },
  { value: "VOID", label: "Void" },
];

const profitStatusOptions: FeesEditorOption[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "FINALIZED", label: "Finalized" },
];

export function FeesPage() {
  const controller = useFeesController();
  const { t, translate, msg } = useI18n();
  const editActionLabel = t("Edit");

  useScrollToHash();

  const renderEditAction = <TRecord,>(onSelect: (record: TRecord) => void) => (record: TRecord) => (
    <Typography component="button" onClick={() => onSelect(record)}>
      {editActionLabel}
    </Typography>
  );

  const customerAccountOptions = controller.customerAccounts.map((account) => ({
    value: String(account.id),
    label: `${account.code} · ${account.name}`,
  }));
  const voucherOptions = controller.vouchers.map((voucher) => ({
    value: String(voucher.id),
    label: voucher.code,
  }));
  const chargeItemOptions = controller.chargeItems.map((item) => ({
    value: String(item.id),
    label: `${item.code} · ${item.name}`,
  }));
  const chargeTemplateOptions = controller.chargeTemplates.map((template) => ({
    value: String(template.id),
    label: `${template.code} · ${template.name}`,
  }));
  const warehouseOptions = controller.warehouses.map((warehouse) => ({
    value: String(warehouse.id),
    label: `${warehouse.code} · ${warehouse.name}`,
  }));

  const balanceTransactionFields: Array<FeesEditorField<BalanceTransactionFormValues>> = [
    { key: "customer_account", label: "Customer account", type: "select", options: [{ value: "", label: "Optional" }, ...customerAccountOptions] },
    { key: "voucher", label: "Voucher", type: "select", options: [{ value: "", label: "Optional" }, ...voucherOptions] },
    { key: "transaction_type", label: "Transaction type", type: "select", options: balanceTypeOptions },
    { key: "status", label: "Review status", type: "select", options: reviewStatusOptions },
    { key: "reference_code", label: "Reference code" },
    { key: "amount", label: "Amount", type: "number" },
    { key: "currency", label: "Currency" },
    { key: "requested_by_name", label: "Requested by" },
    { key: "reviewed_by_name", label: "Reviewed by" },
    { key: "requested_at", label: "Requested at", type: "datetime-local" },
    { key: "reviewed_at", label: "Reviewed at", type: "datetime-local" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const voucherFields: Array<FeesEditorField<VoucherFormValues>> = [
    { key: "customer_account", label: "Customer account", type: "select", options: [{ value: "", label: "Optional" }, ...customerAccountOptions] },
    { key: "code", label: "Voucher code" },
    { key: "voucher_type", label: "Voucher type", type: "select", options: voucherTypeOptions },
    { key: "status", label: "Voucher status", type: "select", options: voucherStatusOptions },
    { key: "face_value", label: "Face value", type: "number" },
    { key: "remaining_value", label: "Remaining value", type: "number" },
    { key: "currency", label: "Currency" },
    { key: "valid_from", label: "Valid from", type: "date" },
    { key: "expires_on", label: "Expires on", type: "date" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const chargeItemFields: Array<FeesEditorField<ChargeItemFormValues>> = [
    { key: "code", label: "Charge item code" },
    { key: "name", label: "Charge item name" },
    { key: "category", label: "Charge category", type: "select", options: chargeCategoryOptions },
    { key: "billing_basis", label: "Billing basis", type: "select", options: billingBasisOptions },
    { key: "default_unit_price", label: "Default unit price", type: "number" },
    { key: "currency", label: "Currency" },
    { key: "unit_label", label: "Unit label" },
    { key: "is_taxable", label: "Taxable", type: "checkbox" },
    { key: "is_active", label: "Active", type: "checkbox" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const chargeTemplateFields: Array<FeesEditorField<ChargeTemplateFormValues>> = [
    { key: "charge_item", label: "Charge item", type: "select", options: chargeItemOptions },
    { key: "warehouse", label: "Warehouse", type: "select", options: [{ value: "", label: "Optional" }, ...warehouseOptions] },
    { key: "customer_account", label: "Customer account", type: "select", options: [{ value: "", label: "Optional" }, ...customerAccountOptions] },
    { key: "code", label: "Template code" },
    { key: "name", label: "Template name" },
    { key: "default_quantity", label: "Default quantity", type: "number" },
    { key: "default_unit_price", label: "Default unit price", type: "number" },
    { key: "currency", label: "Currency" },
    { key: "is_active", label: "Active", type: "checkbox" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const manualChargeFields: Array<FeesEditorField<ManualChargeFormValues>> = [
    { key: "customer_account", label: "Customer account", type: "select", options: [{ value: "", label: "Optional" }, ...customerAccountOptions] },
    { key: "warehouse", label: "Warehouse", type: "select", options: [{ value: "", label: "Optional" }, ...warehouseOptions] },
    { key: "charge_item", label: "Charge item", type: "select", options: [{ value: "", label: "Optional" }, ...chargeItemOptions] },
    { key: "charge_template", label: "Charge template", type: "select", options: [{ value: "", label: "Optional" }, ...chargeTemplateOptions] },
    { key: "status", label: "Charge status", type: "select", options: reviewStatusOptions },
    { key: "source_reference", label: "Source reference" },
    { key: "description", label: "Description" },
    { key: "quantity", label: "Quantity", type: "number" },
    { key: "unit_price", label: "Unit price", type: "number" },
    { key: "currency", label: "Currency" },
    { key: "charged_at", label: "Charged at", type: "datetime-local" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const fundFlowFields: Array<FeesEditorField<FundFlowFormValues>> = [
    { key: "warehouse", label: "Warehouse", type: "select", options: [{ value: "", label: "Optional" }, ...warehouseOptions] },
    { key: "customer_account", label: "Customer account", type: "select", options: [{ value: "", label: "Optional" }, ...customerAccountOptions] },
    { key: "flow_type", label: "Flow type", type: "select", options: flowTypeOptions },
    { key: "source_type", label: "Source type" },
    { key: "reference_code", label: "Reference code" },
    { key: "status", label: "Fund flow status", type: "select", options: fundFlowStatusOptions },
    { key: "amount", label: "Amount", type: "number" },
    { key: "currency", label: "Currency" },
    { key: "occurred_at", label: "Occurred at", type: "datetime-local" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const rentDetailFields: Array<FeesEditorField<RentDetailFormValues>> = [
    { key: "warehouse", label: "Warehouse", type: "select", options: warehouseOptions },
    { key: "customer_account", label: "Customer account", type: "select", options: [{ value: "", label: "Optional" }, ...customerAccountOptions] },
    { key: "period_start", label: "Period start", type: "date" },
    { key: "period_end", label: "Period end", type: "date" },
    { key: "pallet_positions", label: "Pallet positions", type: "number" },
    { key: "bin_positions", label: "Bin positions", type: "number" },
    { key: "area_sqm", label: "Area sqm", type: "number" },
    { key: "amount", label: "Amount", type: "number" },
    { key: "currency", label: "Currency" },
    { key: "status", label: "Rent status", type: "select", options: rentStatusOptions },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const businessExpenseFields: Array<FeesEditorField<BusinessExpenseFormValues>> = [
    { key: "warehouse", label: "Warehouse", type: "select", options: [{ value: "", label: "Optional" }, ...warehouseOptions] },
    { key: "vendor_name", label: "Vendor name" },
    { key: "expense_category", label: "Expense category", type: "select", options: expenseCategoryOptions },
    { key: "status", label: "Expense status", type: "select", options: reviewStatusOptions },
    { key: "expense_date", label: "Expense date", type: "date" },
    { key: "amount", label: "Amount", type: "number" },
    { key: "currency", label: "Currency" },
    { key: "reference_code", label: "Reference code" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const receivableBillFields: Array<FeesEditorField<ReceivableBillFormValues>> = [
    { key: "customer_account", label: "Customer account", type: "select", options: [{ value: "", label: "Optional" }, ...customerAccountOptions] },
    { key: "warehouse", label: "Warehouse", type: "select", options: [{ value: "", label: "Optional" }, ...warehouseOptions] },
    { key: "bill_number", label: "Bill number" },
    { key: "period_start", label: "Period start", type: "date" },
    { key: "period_end", label: "Period end", type: "date" },
    { key: "status", label: "Bill status", type: "select", options: billStatusOptions },
    { key: "subtotal_amount", label: "Subtotal amount", type: "number" },
    { key: "adjustment_amount", label: "Adjustment amount", type: "number" },
    { key: "currency", label: "Currency" },
    { key: "due_at", label: "Due at", type: "datetime-local" },
    { key: "issued_at", label: "Issued at", type: "datetime-local" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const profitCalculationFields: Array<FeesEditorField<ProfitCalculationFormValues>> = [
    { key: "warehouse", label: "Warehouse", type: "select", options: [{ value: "", label: "Optional" }, ...warehouseOptions] },
    { key: "customer_account", label: "Customer account", type: "select", options: [{ value: "", label: "Optional" }, ...customerAccountOptions] },
    { key: "period_start", label: "Period start", type: "date" },
    { key: "period_end", label: "Period end", type: "date" },
    { key: "revenue_amount", label: "Revenue amount", type: "number" },
    { key: "expense_amount", label: "Expense amount", type: "number" },
    { key: "recharge_amount", label: "Recharge amount", type: "number" },
    { key: "deduction_amount", label: "Deduction amount", type: "number" },
    { key: "receivable_amount", label: "Receivable amount", type: "number" },
    { key: "status", label: "Profit status", type: "select", options: profitStatusOptions },
    { key: "generated_at", label: "Generated at", type: "datetime-local" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <Stack spacing={3}>
      <PageHeader
        description="Manage recharges, deductions, vouchers, charging catalog, receivable bills, business expenses, and profit calculation from one fees workbench."
        title="Fees management"
      />
      {!controller.company ? (
        <Alert severity="info">{t("Select an active workspace membership before managing fees.")}</Alert>
      ) : null}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Current workspace and warehouse scope for fees operations."
            items={[
              { label: "Workspace", value: controller.company?.label ?? "No workspace selected" },
              { label: "Warehouse context", value: controller.activeWarehouse?.warehouse_name ?? "All warehouses" },
            ]}
            title="Scope"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Recharge and deduction review posture."
            items={[
              { label: "Pending reviews", value: String(controller.summary.pendingBalanceReviews) },
              { label: "Active vouchers", value: String(controller.summary.activeVouchers) },
            ]}
            title="Recharge / Deduction"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Charging and bill collection workload."
            items={[
              { label: "Pending manual charges", value: String(controller.summary.pendingManualCharges) },
              { label: "Open receivable bills", value: String(controller.summary.openReceivableBills) },
            ]}
            title="Charging Management"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Cash movement and profit posture."
            items={[
              { label: "Posted fund flow", value: String(controller.summary.postedFundFlows) },
              { label: "Latest profit", value: controller.summary.latestProfit ? formatNumber(controller.summary.latestProfit) : "--" },
            ]}
            title="Profit Calculation"
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <Box id="recharge-deduction">
            <FeesEditorCard
              title="Recharge / Deduction"
              description="Capture recharge and deduction requests before review and posting."
              fields={balanceTransactionFields}
              values={controller.balanceTransactionSection.formValues}
              onChange={controller.balanceTransactionSection.updateFormValue}
              onSubmit={() =>
                controller.balanceTransactionSection.selectedRecord
                  ? controller.balanceTransactionMutations.updateMutation.mutateAsync(controller.balanceTransactionSection.formValues)
                  : controller.balanceTransactionMutations.createMutation.mutateAsync(controller.balanceTransactionSection.formValues)
              }
              onCancel={controller.balanceTransactionSection.clearSelection}
              isEditing={Boolean(controller.balanceTransactionSection.selectedRecord)}
              isSubmitting={
                controller.balanceTransactionMutations.createMutation.isPending ||
                controller.balanceTransactionMutations.updateMutation.isPending
              }
              successMessage={controller.balanceTransactionMutations.feedback.successMessage}
              errorMessage={controller.balanceTransactionMutations.feedback.errorMessage}
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ResourceTable
            title="Recharge Deduction"
            subtitle="Recharge and deduction ledger across request, review, and posting."
            rows={controller.balanceTransactions}
            columns={[
              { header: "Reference", key: "reference", render: (row) => row.reference_code || row.id },
              { header: "Type", key: "type", render: (row) => row.transaction_type },
              { header: "Customer", key: "customer", render: (row) => row.customer_account_name || "--" },
              { header: "Amount", key: "amount", align: "right", render: (row) => `${formatNumber(row.amount)} ${row.currency}` },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
              { header: "Edit", key: "edit", render: renderEditAction(controller.balanceTransactionSection.setSelectedRecord) },
            ]}
            getRowId={(row) => row.id}
            isLoading={controller.balanceTransactionsQuery.isLoading}
            error={controller.balanceTransactionsQuery.error ? parseApiError(controller.balanceTransactionsQuery.error) : null}
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Box id="recharge-review">
            <ResourceTable
              title="Recharge Review"
              subtitle="Balance transactions waiting for finance review."
              rows={controller.reviewQueue}
              columns={[
                { header: "Reference", key: "reference", render: (row) => row.reference_code || row.id },
                { header: "Requested by", key: "requestedBy", render: (row) => row.requested_by_name || "--" },
                { header: "Requested at", key: "requestedAt", render: (row) => formatDateTime(row.requested_at) },
                { header: "Amount", key: "amount", align: "right", render: (row) => `${formatNumber(row.amount)} ${row.currency}` },
                { header: "Voucher", key: "voucher", render: (row) => row.voucher_code || "--" },
              ]}
              getRowId={(row) => row.id}
              isLoading={controller.balanceTransactionsQuery.isLoading}
              error={controller.balanceTransactionsQuery.error ? parseApiError(controller.balanceTransactionsQuery.error) : null}
            />
          </Box>
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <Box id="voucher-management">
            <FeesEditorCard
              title="Voucher Management"
              description="Issue and maintain recharge, deduction, and credit vouchers."
              fields={voucherFields}
              values={controller.voucherSection.formValues}
              onChange={controller.voucherSection.updateFormValue}
              onSubmit={() =>
                controller.voucherSection.selectedRecord
                  ? controller.voucherMutations.updateMutation.mutateAsync(controller.voucherSection.formValues)
                  : controller.voucherMutations.createMutation.mutateAsync(controller.voucherSection.formValues)
              }
              onCancel={controller.voucherSection.clearSelection}
              isEditing={Boolean(controller.voucherSection.selectedRecord)}
              isSubmitting={controller.voucherMutations.createMutation.isPending || controller.voucherMutations.updateMutation.isPending}
              successMessage={controller.voucherMutations.feedback.successMessage}
              errorMessage={controller.voucherMutations.feedback.errorMessage}
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ResourceTable
            title="Voucher Management"
            subtitle="Voucher register for credits, recharges, and deductions."
            rows={controller.vouchers}
            columns={[
              { header: "Voucher", key: "voucher", render: (row) => row.code },
              { header: "Type", key: "type", render: (row) => row.voucher_type },
              { header: "Customer", key: "customer", render: (row) => row.customer_account_name || "--" },
              { header: "Remaining", key: "remaining", align: "right", render: (row) => `${formatNumber(row.remaining_value)} ${row.currency}` },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
              { header: "Edit", key: "edit", render: renderEditAction(controller.voucherSection.setSelectedRecord) },
            ]}
            getRowId={(row) => row.id}
            isLoading={controller.vouchersQuery.isLoading}
            error={controller.vouchersQuery.error ? parseApiError(controller.vouchersQuery.error) : null}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <Box id="charging-items">
            <FeesEditorCard
              title="Charging items"
              description="Maintain the fee item catalog used by templates and manual charges."
              fields={chargeItemFields}
              values={controller.chargeItemSection.formValues}
              onChange={controller.chargeItemSection.updateFormValue}
              onSubmit={() =>
                controller.chargeItemSection.selectedRecord
                  ? controller.chargeItemMutations.updateMutation.mutateAsync(controller.chargeItemSection.formValues)
                  : controller.chargeItemMutations.createMutation.mutateAsync(controller.chargeItemSection.formValues)
              }
              onCancel={controller.chargeItemSection.clearSelection}
              isEditing={Boolean(controller.chargeItemSection.selectedRecord)}
              isSubmitting={controller.chargeItemMutations.createMutation.isPending || controller.chargeItemMutations.updateMutation.isPending}
              successMessage={controller.chargeItemMutations.feedback.successMessage}
              errorMessage={controller.chargeItemMutations.feedback.errorMessage}
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ResourceTable
            title="Charging items"
            subtitle="Fee item catalog across storage, handling, rent, recharge, and custom charges."
            rows={controller.chargeItems}
            columns={[
              { header: "Code", key: "code", render: (row) => row.code },
              { header: "Name", key: "name", render: (row) => row.name },
              { header: "Category", key: "category", render: (row) => row.category },
              { header: "Price", key: "price", align: "right", render: (row) => `${formatNumber(row.default_unit_price)} ${row.currency}` },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.is_active ? "ACTIVE" : "VOID"} /> },
              { header: "Edit", key: "edit", render: renderEditAction(controller.chargeItemSection.setSelectedRecord) },
            ]}
            getRowId={(row) => row.id}
            isLoading={controller.chargeItemsQuery.isLoading}
            error={controller.chargeItemsQuery.error ? parseApiError(controller.chargeItemsQuery.error) : null}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <Box id="charging-template">
            <FeesEditorCard
              title="Charging Template"
              description="Create reusable charging presets by customer, warehouse, and charge item."
              fields={chargeTemplateFields}
              values={controller.chargeTemplateSection.formValues}
              onChange={controller.chargeTemplateSection.updateFormValue}
              onSubmit={() =>
                controller.chargeTemplateSection.selectedRecord
                  ? controller.chargeTemplateMutations.updateMutation.mutateAsync(controller.chargeTemplateSection.formValues)
                  : controller.chargeTemplateMutations.createMutation.mutateAsync(controller.chargeTemplateSection.formValues)
              }
              onCancel={controller.chargeTemplateSection.clearSelection}
              isEditing={Boolean(controller.chargeTemplateSection.selectedRecord)}
              isSubmitting={
                controller.chargeTemplateMutations.createMutation.isPending ||
                controller.chargeTemplateMutations.updateMutation.isPending
              }
              successMessage={controller.chargeTemplateMutations.feedback.successMessage}
              errorMessage={controller.chargeTemplateMutations.feedback.errorMessage}
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ResourceTable
            title="Charging Template"
            subtitle="Reusable charge defaults for warehouse and customer billing patterns."
            rows={controller.chargeTemplates}
            columns={[
              { header: "Template", key: "template", render: (row) => row.code },
              { header: "Charge item", key: "item", render: (row) => row.charge_item_name },
              { header: "Warehouse", key: "warehouse", render: (row) => row.warehouse_name || "--" },
              { header: "Customer", key: "customer", render: (row) => row.customer_account_name || "--" },
              { header: "Edit", key: "edit", render: renderEditAction(controller.chargeTemplateSection.setSelectedRecord) },
            ]}
            getRowId={(row) => row.id}
            isLoading={controller.chargeTemplatesQuery.isLoading}
            error={controller.chargeTemplatesQuery.error ? parseApiError(controller.chargeTemplatesQuery.error) : null}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <Box id="charging-manually">
            <FeesEditorCard
              title="Charging Manually"
              description="Post manual warehouse charges outside scheduled billing runs."
              fields={manualChargeFields}
              values={controller.manualChargeSection.formValues}
              onChange={controller.manualChargeSection.updateFormValue}
              onSubmit={() =>
                controller.manualChargeSection.selectedRecord
                  ? controller.manualChargeMutations.updateMutation.mutateAsync(controller.manualChargeSection.formValues)
                  : controller.manualChargeMutations.createMutation.mutateAsync(controller.manualChargeSection.formValues)
              }
              onCancel={controller.manualChargeSection.clearSelection}
              isEditing={Boolean(controller.manualChargeSection.selectedRecord)}
              isSubmitting={controller.manualChargeMutations.createMutation.isPending || controller.manualChargeMutations.updateMutation.isPending}
              successMessage={controller.manualChargeMutations.feedback.successMessage}
              errorMessage={controller.manualChargeMutations.feedback.errorMessage}
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <Box id="charging-management">
            <ResourceTable
              title="Charging Management"
              subtitle="Manual charge queue for review, posting, and billing follow-through."
              rows={controller.manualCharges}
              columns={[
                { header: "Reference", key: "reference", render: (row) => row.source_reference || row.id },
                { header: "Description", key: "description", render: (row) => row.description || "--" },
                { header: "Customer", key: "customer", render: (row) => row.customer_account_name || "--" },
                { header: "Amount", key: "amount", align: "right", render: (row) => `${formatNumber(row.amount)} ${row.currency}` },
                { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
                { header: "Edit", key: "edit", render: renderEditAction(controller.manualChargeSection.setSelectedRecord) },
              ]}
              getRowId={(row) => row.id}
              isLoading={controller.manualChargesQuery.isLoading}
              error={controller.manualChargesQuery.error ? parseApiError(controller.manualChargesQuery.error) : null}
            />
          </Box>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Box id="fees-inquiries">
            <ResourceTable
              title="Fees Inquiries"
              subtitle="Cross-record fee inquiry view across balance transactions, manual charges, and receivable bills."
              rows={controller.feesInquiries}
              columns={[
                { header: "Type", key: "type", render: (row) => row.inquiry_type },
                { header: "Reference", key: "reference", render: (row) => row.reference },
                { header: "Customer", key: "customer", render: (row) => row.customer_name },
                { header: "Warehouse", key: "warehouse", render: (row) => row.warehouse_name },
                { header: "Amount", key: "amount", align: "right", render: (row) => `${formatNumber(row.amount)} ${row.currency}` },
                { header: "Occurred at", key: "occurredAt", render: (row) => formatDateTime(row.occurred_at) },
                { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
              ]}
              getRowId={(row) => row.id}
              isLoading={false}
            />
          </Box>
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <Box id="fund-flow">
            <FeesEditorCard
              title="Fund flow"
              description="Track inbound and outbound fund movement tied to fee events."
              fields={fundFlowFields}
              values={controller.fundFlowSection.formValues}
              onChange={controller.fundFlowSection.updateFormValue}
              onSubmit={() =>
                controller.fundFlowSection.selectedRecord
                  ? controller.fundFlowMutations.updateMutation.mutateAsync(controller.fundFlowSection.formValues)
                  : controller.fundFlowMutations.createMutation.mutateAsync(controller.fundFlowSection.formValues)
              }
              onCancel={controller.fundFlowSection.clearSelection}
              isEditing={Boolean(controller.fundFlowSection.selectedRecord)}
              isSubmitting={controller.fundFlowMutations.createMutation.isPending || controller.fundFlowMutations.updateMutation.isPending}
              successMessage={controller.fundFlowMutations.feedback.successMessage}
              errorMessage={controller.fundFlowMutations.feedback.errorMessage}
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ResourceTable
            title="Fund flow"
            subtitle="Cash movement ledger for fees, recharge, expense, and billing activity."
            rows={controller.fundFlows}
            columns={[
              { header: "Reference", key: "reference", render: (row) => row.reference_code || row.id },
              { header: "Flow type", key: "flowType", render: (row) => row.flow_type },
              { header: "Source type", key: "sourceType", render: (row) => row.source_type || "--" },
              { header: "Amount", key: "amount", align: "right", render: (row) => `${formatNumber(row.amount)} ${row.currency}` },
              { header: "Occurred at", key: "occurredAt", render: (row) => formatDateTime(row.occurred_at) },
              { header: "Edit", key: "edit", render: renderEditAction(controller.fundFlowSection.setSelectedRecord) },
            ]}
            getRowId={(row) => row.id}
            isLoading={controller.fundFlowsQuery.isLoading}
            error={controller.fundFlowsQuery.error ? parseApiError(controller.fundFlowsQuery.error) : null}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <Box id="rent-details">
            <FeesEditorCard
              title="Rent Details"
              description="Maintain rent accrual detail for warehouse space, bins, and pallets."
              fields={rentDetailFields}
              values={controller.rentDetailSection.formValues}
              onChange={controller.rentDetailSection.updateFormValue}
              onSubmit={() =>
                controller.rentDetailSection.selectedRecord
                  ? controller.rentDetailMutations.updateMutation.mutateAsync(controller.rentDetailSection.formValues)
                  : controller.rentDetailMutations.createMutation.mutateAsync(controller.rentDetailSection.formValues)
              }
              onCancel={controller.rentDetailSection.clearSelection}
              isEditing={Boolean(controller.rentDetailSection.selectedRecord)}
              isSubmitting={controller.rentDetailMutations.createMutation.isPending || controller.rentDetailMutations.updateMutation.isPending}
              successMessage={controller.rentDetailMutations.feedback.successMessage}
              errorMessage={controller.rentDetailMutations.feedback.errorMessage}
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ResourceTable
            title="Rent Details"
            subtitle="Warehouse rent detail records by period and customer."
            rows={controller.rentDetails}
            columns={[
              { header: "Warehouse", key: "warehouse", render: (row) => row.warehouse_name },
              { header: "Customer", key: "customer", render: (row) => row.customer_account_name || "--" },
              { header: "Period start", key: "start", render: (row) => row.period_start },
              { header: "Period end", key: "end", render: (row) => row.period_end },
              { header: "Amount", key: "amount", align: "right", render: (row) => `${formatNumber(row.amount)} ${row.currency}` },
              { header: "Edit", key: "edit", render: renderEditAction(controller.rentDetailSection.setSelectedRecord) },
            ]}
            getRowId={(row) => row.id}
            isLoading={controller.rentDetailsQuery.isLoading}
            error={controller.rentDetailsQuery.error ? parseApiError(controller.rentDetailsQuery.error) : null}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <Box id="business-expenses">
            <FeesEditorCard
              title="Business Expenses"
              description="Track internal operational expenses that offset warehouse profitability."
              fields={businessExpenseFields}
              values={controller.businessExpenseSection.formValues}
              onChange={controller.businessExpenseSection.updateFormValue}
              onSubmit={() =>
                controller.businessExpenseSection.selectedRecord
                  ? controller.businessExpenseMutations.updateMutation.mutateAsync(controller.businessExpenseSection.formValues)
                  : controller.businessExpenseMutations.createMutation.mutateAsync(controller.businessExpenseSection.formValues)
              }
              onCancel={controller.businessExpenseSection.clearSelection}
              isEditing={Boolean(controller.businessExpenseSection.selectedRecord)}
              isSubmitting={
                controller.businessExpenseMutations.createMutation.isPending ||
                controller.businessExpenseMutations.updateMutation.isPending
              }
              successMessage={controller.businessExpenseMutations.feedback.successMessage}
              errorMessage={controller.businessExpenseMutations.feedback.errorMessage}
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ResourceTable
            title="Business Expenses"
            subtitle="Internal business-expense ledger for rent, utilities, labor, logistics, and supplies."
            rows={controller.businessExpenses}
            columns={[
              { header: "Reference", key: "reference", render: (row) => row.reference_code || row.id },
              { header: "Vendor", key: "vendor", render: (row) => row.vendor_name || "--" },
              { header: "Category", key: "category", render: (row) => row.expense_category },
              { header: "Amount", key: "amount", align: "right", render: (row) => `${formatNumber(row.amount)} ${row.currency}` },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
              { header: "Edit", key: "edit", render: renderEditAction(controller.businessExpenseSection.setSelectedRecord) },
            ]}
            getRowId={(row) => row.id}
            isLoading={controller.businessExpensesQuery.isLoading}
            error={controller.businessExpensesQuery.error ? parseApiError(controller.businessExpensesQuery.error) : null}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <Box id="receivable-bill">
            <FeesEditorCard
              title="Receivable Bill"
              description="Issue and adjust receivable bills for customer-facing warehouse fees."
              fields={receivableBillFields}
              values={controller.receivableBillSection.formValues}
              onChange={controller.receivableBillSection.updateFormValue}
              onSubmit={() =>
                controller.receivableBillSection.selectedRecord
                  ? controller.receivableBillMutations.updateMutation.mutateAsync(controller.receivableBillSection.formValues)
                  : controller.receivableBillMutations.createMutation.mutateAsync(controller.receivableBillSection.formValues)
              }
              onCancel={controller.receivableBillSection.clearSelection}
              isEditing={Boolean(controller.receivableBillSection.selectedRecord)}
              isSubmitting={
                controller.receivableBillMutations.createMutation.isPending ||
                controller.receivableBillMutations.updateMutation.isPending
              }
              successMessage={controller.receivableBillMutations.feedback.successMessage}
              errorMessage={controller.receivableBillMutations.feedback.errorMessage}
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ResourceTable
            title="Receivable Bill"
            subtitle="Customer receivable bills across draft, open, and paid states."
            rows={controller.receivableBills}
            columns={[
              { header: "Bill", key: "bill", render: (row) => row.bill_number },
              { header: "Customer", key: "customer", render: (row) => row.customer_account_name || "--" },
              { header: "Warehouse", key: "warehouse", render: (row) => row.warehouse_name || "--" },
              { header: "Total", key: "total", align: "right", render: (row) => `${formatNumber(row.total_amount)} ${row.currency}` },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
              { header: "Edit", key: "edit", render: renderEditAction(controller.receivableBillSection.setSelectedRecord) },
            ]}
            getRowId={(row) => row.id}
            isLoading={controller.receivableBillsQuery.isLoading}
            error={controller.receivableBillsQuery.error ? parseApiError(controller.receivableBillsQuery.error) : null}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 4 }}>
          <Box id="profit-calculation">
            <FeesEditorCard
              title="Profit Calculation"
              description="Capture profitability snapshots from revenue, recharge, deduction, and expense inputs."
              fields={profitCalculationFields}
              values={controller.profitCalculationSection.formValues}
              onChange={controller.profitCalculationSection.updateFormValue}
              onSubmit={() =>
                controller.profitCalculationSection.selectedRecord
                  ? controller.profitCalculationMutations.updateMutation.mutateAsync(controller.profitCalculationSection.formValues)
                  : controller.profitCalculationMutations.createMutation.mutateAsync(controller.profitCalculationSection.formValues)
              }
              onCancel={controller.profitCalculationSection.clearSelection}
              isEditing={Boolean(controller.profitCalculationSection.selectedRecord)}
              isSubmitting={
                controller.profitCalculationMutations.createMutation.isPending ||
                controller.profitCalculationMutations.updateMutation.isPending
              }
              successMessage={controller.profitCalculationMutations.feedback.successMessage}
              errorMessage={controller.profitCalculationMutations.feedback.errorMessage}
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ResourceTable
            title="Profit Calculation"
            subtitle="Profit snapshots for warehouse and customer financial performance."
            rows={controller.profitCalculations}
            columns={[
              { header: "Period start", key: "start", render: (row) => row.period_start },
              { header: "Period end", key: "end", render: (row) => row.period_end },
              { header: "Revenue", key: "revenue", align: "right", render: (row) => formatNumber(row.revenue_amount) },
              { header: "Profit", key: "profit", align: "right", render: (row) => formatNumber(row.profit_amount) },
              { header: "Margin %", key: "margin", align: "right", render: (row) => formatNumber(row.margin_percent) },
              { header: "Edit", key: "edit", render: renderEditAction(controller.profitCalculationSection.setSelectedRecord) },
            ]}
            getRowId={(row) => row.id}
            isLoading={controller.profitCalculationsQuery.isLoading}
            error={controller.profitCalculationsQuery.error ? parseApiError(controller.profitCalculationsQuery.error) : null}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
