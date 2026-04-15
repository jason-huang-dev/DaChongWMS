import { screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { InventoryTransferWorkbenchPage } from "@/features/inventory/view/InventoryTransferWorkbenchPage";
import { renderWithProviders } from "@/test/render";

const { useInventoryTransferWorkbenchControllerMock } = vi.hoisted(() => ({
  useInventoryTransferWorkbenchControllerMock: vi.fn(),
}));

vi.mock("@/features/inventory/controller/useInventoryCrossWarehouseController", () => ({
  useInventoryTransferWorkbenchController: useInventoryTransferWorkbenchControllerMock,
}));

function buildControllerState(overrides: Record<string, unknown> = {}) {
  return {
    activeBucket: "all",
    allowCreation: true,
    bucketItems: [{ count: 1, label: "All", value: "all" }],
    columnVisibilityStorageKey: "inventory.test.columns",
    createErrorMessage: null,
    createSuccessMessage: null,
    createTransferOrderMutation: {
      isPending: false,
      mutateAsync: vi.fn(),
    },
    dataView: {
      activeFilterCount: 0,
      filters: {
        dateField: "create_time",
        dateFrom: "",
        dateTo: "",
        fromWarehouseId: "",
        searchField: "transfer_number",
        searchMode: "contains",
        searchText: "",
        toWarehouseId: "",
        transferType: "",
      },
      updateFilter: vi.fn(),
    },
    exportVisibleRows: vi.fn(),
    filterOptions: {
      transferTypes: [{ label: "Transfer Type", value: "" }],
    },
    hasActiveFilters: false,
    isCreateDialogOpen: false,
    closeCreateDialog: vi.fn(),
    locationsQuery: {
      isLoading: false,
    },
    openCreateDialog: vi.fn(),
    pagination: {
      onPageChange: vi.fn(),
      page: 1,
      pageSize: 50,
      total: 0,
    },
    queryError: null,
    refetch: vi.fn(),
    resetFilters: vi.fn(),
    rows: [],
    setActiveBucket: vi.fn(),
    setSort: vi.fn(),
    sorting: {
      direction: "desc",
      sortKey: "createTime",
    },
    transferOrdersQuery: {
      isLoading: false,
    },
    warehouses: [
      {
        id: 1,
        warehouse_name: "Main WH",
        warehouse_city: "",
        warehouse_address: "",
        warehouse_contact: "",
        warehouse_manager: "",
        creator: "",
        create_time: "",
        update_time: "",
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  useInventoryTransferWorkbenchControllerMock.mockReset();
});

test("shows internal move creation controls and hides inter-warehouse-only filters", () => {
  useInventoryTransferWorkbenchControllerMock.mockReturnValue(buildControllerState());

  renderWithProviders(<InventoryTransferWorkbenchPage scope="internal" />);

  expect(screen.getByRole("button", { name: "New Internal Move" })).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByText("0 active filters")).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "To Warehouse" })).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "Transfer Type" })).not.toBeInTheDocument();
  expect(screen.queryByRole("columnheader", { name: "Creator" })).not.toBeInTheDocument();
});

test("keeps the inter-warehouse page read-only and shows warehouse-scoped filters", () => {
  useInventoryTransferWorkbenchControllerMock.mockReturnValue(
    buildControllerState({
      allowCreation: false,
      dataView: {
        activeFilterCount: 4,
        filters: {
          dateField: "create_time",
          dateFrom: "",
          dateTo: "",
          fromWarehouseId: "",
          searchField: "transfer_number",
          searchMode: "contains",
          searchText: "",
          toWarehouseId: "",
          transferType: "",
        },
        updateFilter: vi.fn(),
      },
      filterOptions: {
        transferTypes: [
          { label: "Transfer Type", value: "" },
          { label: "Cross warehouse", value: "CROSS_WAREHOUSE" },
        ],
      },
    }),
  );

  renderWithProviders(<InventoryTransferWorkbenchPage scope="interWarehouse" />);

  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "New Internal Move" })).not.toBeInTheDocument();
  expect(screen.queryByText("4 active filters")).not.toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "To Warehouse" })).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "Transfer Type" })).toBeInTheDocument();
});
