import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
    rows: [
      {
        id: 11,
        bucket: "pending",
        cancelTime: null,
        createTime: "2026-04-10T12:00:00Z",
        fromWarehouseId: 1,
        fromWarehouseName: "Main WH",
        raw: {
          notes: "Urgent move",
          reference_code: "REF-100",
        },
        requestedDate: "2026-04-11",
        status: "OPEN",
        stockInTime: null,
        stockOutTime: null,
        toWarehouseIds: [2],
        toWarehouseName: "Overflow WH",
        transferDetails: "1 line · 5 requested",
        transferNumber: "TR-1001",
        transferType: "CROSS_WAREHOUSE",
      },
    ],
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
  useInventoryTransferWorkbenchControllerMock.mockReturnValue(
    buildControllerState({
      rows: [
        {
          id: 12,
          bucket: "pending",
          cancelTime: null,
          createTime: "2026-04-10T12:00:00Z",
          fromWarehouseId: 1,
          fromWarehouseName: "Main WH",
          raw: {
            notes: "Internal move",
            reference_code: "REF-101",
          },
          requestedDate: "2026-04-11",
          status: "OPEN",
          stockInTime: null,
          stockOutTime: null,
          toWarehouseIds: [1],
          toWarehouseName: "Main WH",
          transferDetails: "1 line · 3 requested",
          transferNumber: "TR-1002",
          transferType: "INTERNAL_RELOCATION",
        },
      ],
    }),
  );

  renderWithProviders(
    <MemoryRouter>
      <InventoryTransferWorkbenchPage scope="internal" />
    </MemoryRouter>,
  );

  expect(screen.getByRole("button", { name: "New Internal Move" })).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByText("0 active filters")).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "To Warehouse" })).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "Transfer Type" })).not.toBeInTheDocument();
  expect(screen.queryByRole("columnheader", { name: "Creator" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/transfers/transfer-orders/12");
});

test("lets the inter-warehouse page create and edit transfer orders while showing warehouse-scoped filters", () => {
  useInventoryTransferWorkbenchControllerMock.mockReturnValue(
    buildControllerState({
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

  renderWithProviders(
    <MemoryRouter>
      <InventoryTransferWorkbenchPage scope="interWarehouse" />
    </MemoryRouter>,
  );

  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "New Inter-warehouse Transfer" })).toBeInTheDocument();
  expect(screen.queryByText("4 active filters")).not.toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "To Warehouse" })).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "Transfer Type" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/transfers/transfer-orders/11");
});
