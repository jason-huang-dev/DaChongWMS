import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { renderWithProviders } from "@/test/render";
import { InventoryBalancesPage } from "@/features/inventory/view/InventoryBalancesPage";
import type { InventoryInformationListResponse } from "@/features/inventory/model/types";

const apiGetMock = vi.fn();

vi.mock("@/app/scope-context", () => ({
  useTenantScope: () => ({
    company: { id: 1, openid: "tenant-openid" },
    activeWarehouseId: 7,
  }),
}));

vi.mock("@/lib/http", async () => {
  const actual = await vi.importActual<typeof import("@/lib/http")>("@/lib/http");
  return {
    ...actual,
    apiGet: (...args: Parameters<typeof actual.apiGet>) => apiGetMock(...args),
  };
});

const inventoryInformationResponse: InventoryInformationListResponse = {
  count: 1,
  next: null,
  previous: null,
  results: [
    {
      id: "live:7:SKU-001",
      merchantSku: "SKU-001",
      productName: "Scanner",
      productBarcode: "BC-001",
      productCategory: "Hardware",
      productBrand: "DaChong",
      productDescription: "Warehouse scanner",
      productTags: ["DaChong", "Hardware"],
      clients: [],
      shelf: "A-01-01",
      shelves: ["A-01-01"],
      inTransit: 0,
      pendingReceival: 0,
      toList: 1,
      orderAllocated: 2,
      availableStock: 9,
      defectiveProducts: 0,
      totalInventory: 12,
      listingTime: "2026-03-14",
      actualLength: "",
      actualWidth: "",
      actualHeight: "",
      actualWeight: "",
      measurementUnit: "EA",
      merchantCode: "",
      customerCode: "",
      warehouseName: "Main WH",
      stockStatus: "AVAILABLE",
      stockStatuses: ["AVAILABLE"],
      zoneCode: "STOR",
      zoneCodes: ["STOR"],
      locationTypeCode: "STORAGE",
      locationTypeCodes: ["STORAGE"],
      areaKey: "storage",
      areaLabel: "Storage",
      source: "live",
    },
  ],
  filterOptions: {
    warehouses: [{ value: "Main WH", label: "Main WH" }],
    tags: [
      { value: "DaChong", label: "DaChong" },
      { value: "Hardware", label: "Hardware" },
    ],
    clients: [],
    skus: [{ value: "SKU-001", label: "SKU-001" }],
  },
};

describe("InventoryBalancesPage", () => {
  beforeEach(() => {
    apiGetMock.mockResolvedValue(inventoryInformationResponse);
  });

  afterEach(() => {
    apiGetMock.mockReset();
  });

  test("renders backend-driven inventory information and opens the print modal for selected rows", async () => {
    const user = userEvent.setup();

    renderWithProviders(<InventoryBalancesPage />);

    expect(await screen.findByText("SKU-001")).toBeInTheDocument();
    expect(screen.getByText("Main WH")).toBeInTheDocument();
    expect(screen.getByText("0 selected")).toBeInTheDocument();
    expect(screen.getByLabelText("In stock only")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export queried rows" })).toBeInTheDocument();
    expect(apiGetMock).toHaveBeenCalledWith(
      "/api/v1/organizations/1/inventory/information/",
      expect.objectContaining({
        page: 1,
        page_size: 10,
        sortKey: "merchantSku",
        sortDirection: "asc",
        warehouse_id: 7,
      }),
    );

    await user.click(screen.getByLabelText("In stock only"));

    expect(apiGetMock).toHaveBeenLastCalledWith(
      "/api/v1/organizations/1/inventory/information/",
      expect.objectContaining({
        hideZeroStock: "true",
      }),
    );

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[checkboxes.length - 1]);

    expect(screen.getByText("1 selected")).toBeInTheDocument();
    await waitFor(() => {
      const hasEnabledPrintButton = screen
        .getAllByRole("button", { name: "Print selected labels" })
        .some((button) => !(button as HTMLButtonElement).disabled);
      expect(hasEnabledPrintButton).toBe(true);
    });
    const enabledPrintButton = screen
      .getAllByRole("button", { name: "Print selected labels" })
      .find((button) => !(button as HTMLButtonElement).disabled);

    await user.click(enabledPrintButton as HTMLButtonElement);

    expect(await screen.findByRole("heading", { name: "Print labels" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("9")).toBeInTheDocument();
    expect(screen.getAllByText("Scanner").length).toBeGreaterThan(0);
  });
});
