import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";

import { LogisticsPage } from "@/features/logistics/view/LogisticsPage";
import { renderWithProviders } from "@/test/render";

const mockUseLogisticsController = vi.fn();

vi.mock("@/features/logistics/controller/useLogisticsController", () => ({
  useLogisticsController: () => mockUseLogisticsController(),
}));

const emptyMutation = {
  createMutation: { isPending: false, mutateAsync: vi.fn() },
  updateMutation: { isPending: false, mutateAsync: vi.fn() },
  feedback: { successMessage: null, errorMessage: null },
};

const emptySection = {
  selectedRecord: null,
  setSelectedRecord: vi.fn(),
  formValues: {},
  updateFormValue: vi.fn(),
  clearSelection: vi.fn(),
};

beforeEach(() => {
  mockUseLogisticsController.mockReset();
});

test("renders the logistics workbench sections", () => {
  mockUseLogisticsController.mockReturnValue({
    company: { id: 1, openid: "org-openid", label: "Acme", description: "" },
    providers: [],
    providersQuery: { isLoading: false, error: null },
    logisticsGroups: [],
    logisticsGroupsQuery: { isLoading: false, error: null },
    providerChannels: [],
    providerChannelsQuery: { isLoading: false, error: null },
    onlineChannels: [],
    offlineChannels: [],
    customerAccounts: [],
    warehouses: [],
    customerChannels: [],
    customerChannelsQuery: { isLoading: false, error: null },
    logisticsRules: [],
    logisticsRulesQuery: { isLoading: false, error: null },
    partitionRules: [],
    partitionRulesQuery: { isLoading: false, error: null },
    remoteAreaRules: [],
    remoteAreaRulesQuery: { isLoading: false, error: null },
    fuelRules: [],
    fuelRulesQuery: { isLoading: false, error: null },
    waybillWatermarks: [],
    watermarksQuery: { isLoading: false, error: null },
    chargingStrategies: [],
    chargingStrategiesQuery: { isLoading: false, error: null },
    specialCustomerChargingRules: [],
    specialCustomerChargingQuery: { isLoading: false, error: null },
    logisticsCharges: [],
    logisticsChargesQuery: { isLoading: false, error: null },
    logisticsCosts: [],
    logisticsCostsQuery: { isLoading: false, error: null },
    summary: {
      onlineChannelCount: 0,
      offlineChannelCount: 0,
      customerChannelCount: 0,
      activeRuleCount: 0,
      pendingChargeCount: 0,
      postedCostCount: 0,
    },
    providerSection: emptySection,
    providerMutations: emptyMutation,
    groupSection: emptySection,
    groupMutations: emptyMutation,
    providerChannelSection: emptySection,
    providerChannelMutations: emptyMutation,
    customerChannelSection: emptySection,
    customerChannelMutations: emptyMutation,
    logisticsRuleSection: emptySection,
    logisticsRuleMutations: emptyMutation,
    partitionRuleSection: emptySection,
    partitionRuleMutations: emptyMutation,
    remoteAreaRuleSection: emptySection,
    remoteAreaRuleMutations: emptyMutation,
    fuelRuleSection: emptySection,
    fuelRuleMutations: emptyMutation,
    waybillWatermarkSection: emptySection,
    waybillWatermarkMutations: emptyMutation,
    chargingStrategySection: emptySection,
    chargingStrategyMutations: emptyMutation,
    specialCustomerChargingSection: emptySection,
    specialCustomerChargingMutations: emptyMutation,
    logisticsChargeSection: emptySection,
    logisticsChargeMutations: emptyMutation,
    logisticsCostSection: emptySection,
    logisticsCostMutations: emptyMutation,
  });

  renderWithProviders(
    <MemoryRouter>
      <LogisticsPage />
    </MemoryRouter>,
  );

  expect(screen.getByText("Logistics")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Online Logistics" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Offline Logistics" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Logistics Provider Management" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Customer Logistics Channel" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Logistics Rules" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Partition Rules" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Remote Area Rules" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Fuel Rules" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Waybill Watermark" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Logistics Charging Strategy" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Special customer logistics charging" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Logistics Charging" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Logistics Cost" })).toBeInTheDocument();
});
