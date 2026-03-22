import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";

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
} from "@/features/fees/model/mappers";
import { FeesPage } from "@/features/fees/view/FeesPage";
import { renderWithProviders } from "@/test/render";

const mockUseFeesController = vi.fn();

vi.mock("@/features/fees/controller/useFeesController", () => ({
  useFeesController: () => mockUseFeesController(),
}));

const emptyMutation = {
  createMutation: { isPending: false, mutateAsync: vi.fn() },
  updateMutation: { isPending: false, mutateAsync: vi.fn() },
  feedback: { successMessage: null, errorMessage: null },
};

beforeEach(() => {
  mockUseFeesController.mockReset();
});

test("renders the fees workbench sections", () => {
  mockUseFeesController.mockReturnValue({
    company: { id: 1, openid: "org-openid", label: "Acme", description: "" },
    activeWarehouse: null,
    customerAccounts: [],
    warehouses: [],
    balanceTransactions: [],
    vouchers: [],
    chargeItems: [],
    chargeTemplates: [],
    manualCharges: [],
    fundFlows: [],
    rentDetails: [],
    businessExpenses: [],
    receivableBills: [],
    profitCalculations: [],
    feesInquiries: [],
    reviewQueue: [],
    balanceTransactionsQuery: { isLoading: false, error: null },
    vouchersQuery: { isLoading: false, error: null },
    chargeItemsQuery: { isLoading: false, error: null },
    chargeTemplatesQuery: { isLoading: false, error: null },
    manualChargesQuery: { isLoading: false, error: null },
    fundFlowsQuery: { isLoading: false, error: null },
    rentDetailsQuery: { isLoading: false, error: null },
    businessExpensesQuery: { isLoading: false, error: null },
    receivableBillsQuery: { isLoading: false, error: null },
    profitCalculationsQuery: { isLoading: false, error: null },
    balanceTransactionSection: {
      selectedRecord: null,
      setSelectedRecord: vi.fn(),
      formValues: defaultBalanceTransactionFormValues,
      updateFormValue: vi.fn(),
      clearSelection: vi.fn(),
    },
    voucherSection: {
      selectedRecord: null,
      setSelectedRecord: vi.fn(),
      formValues: defaultVoucherFormValues,
      updateFormValue: vi.fn(),
      clearSelection: vi.fn(),
    },
    chargeItemSection: {
      selectedRecord: null,
      setSelectedRecord: vi.fn(),
      formValues: defaultChargeItemFormValues,
      updateFormValue: vi.fn(),
      clearSelection: vi.fn(),
    },
    chargeTemplateSection: {
      selectedRecord: null,
      setSelectedRecord: vi.fn(),
      formValues: defaultChargeTemplateFormValues,
      updateFormValue: vi.fn(),
      clearSelection: vi.fn(),
    },
    manualChargeSection: {
      selectedRecord: null,
      setSelectedRecord: vi.fn(),
      formValues: defaultManualChargeFormValues,
      updateFormValue: vi.fn(),
      clearSelection: vi.fn(),
    },
    fundFlowSection: {
      selectedRecord: null,
      setSelectedRecord: vi.fn(),
      formValues: defaultFundFlowFormValues,
      updateFormValue: vi.fn(),
      clearSelection: vi.fn(),
    },
    rentDetailSection: {
      selectedRecord: null,
      setSelectedRecord: vi.fn(),
      formValues: defaultRentDetailFormValues,
      updateFormValue: vi.fn(),
      clearSelection: vi.fn(),
    },
    businessExpenseSection: {
      selectedRecord: null,
      setSelectedRecord: vi.fn(),
      formValues: defaultBusinessExpenseFormValues,
      updateFormValue: vi.fn(),
      clearSelection: vi.fn(),
    },
    receivableBillSection: {
      selectedRecord: null,
      setSelectedRecord: vi.fn(),
      formValues: defaultReceivableBillFormValues,
      updateFormValue: vi.fn(),
      clearSelection: vi.fn(),
    },
    profitCalculationSection: {
      selectedRecord: null,
      setSelectedRecord: vi.fn(),
      formValues: defaultProfitCalculationFormValues,
      updateFormValue: vi.fn(),
      clearSelection: vi.fn(),
    },
    balanceTransactionMutations: emptyMutation,
    voucherMutations: emptyMutation,
    chargeItemMutations: emptyMutation,
    chargeTemplateMutations: emptyMutation,
    manualChargeMutations: emptyMutation,
    fundFlowMutations: emptyMutation,
    rentDetailMutations: emptyMutation,
    businessExpenseMutations: emptyMutation,
    receivableBillMutations: emptyMutation,
    profitCalculationMutations: emptyMutation,
    summary: {
      pendingBalanceReviews: 0,
      activeVouchers: 0,
      pendingManualCharges: 0,
      openReceivableBills: 0,
      postedFundFlows: 0,
      latestProfit: null,
    },
  });

  renderWithProviders(
    <MemoryRouter>
      <FeesPage />
    </MemoryRouter>,
  );

  expect(screen.getByText("Fees management")).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { name: "Recharge / Deduction" }).length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: "Recharge Review" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { name: "Voucher Management" }).length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: "Charging Manually" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Fees Inquiries" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { name: "Fund flow" }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("heading", { name: "Rent Details" }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("heading", { name: "Charging Management" }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("heading", { name: "Charging items" }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("heading", { name: "Charging Template" }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("heading", { name: "Business Expenses" }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("heading", { name: "Receivable Bill" }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("heading", { name: "Profit Calculation" }).length).toBeGreaterThan(0);
});
