import { fireEvent, screen, waitFor } from "@testing-library/react";
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
  count: 3,
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
    {
      id: "live:7:SKU-002",
      merchantSku: "SKU-002",
      productName: "Label Printer",
      productBarcode: "BC-002",
      productCategory: "Hardware",
      productBrand: "DaChong",
      productDescription: "Packing station printer",
      productTags: ["DaChong", "Printer"],
      clients: [{ code: "RTL-1", name: "Retail Client", label: "Retail Client [RTL-1]" }],
      shelf: "PICK-01",
      shelves: ["PICK-01"],
      inTransit: 1,
      pendingReceival: 2,
      toList: 0,
      orderAllocated: 1,
      availableStock: 4,
      defectiveProducts: 0,
      totalInventory: 5,
      listingTime: "2026-03-15",
      actualLength: "",
      actualWidth: "",
      actualHeight: "",
      actualWeight: "",
      measurementUnit: "EA",
      merchantCode: "MER-002",
      customerCode: "RTL-1",
      warehouseName: "Main WH",
      stockStatus: "AVAILABLE",
      stockStatuses: ["AVAILABLE"],
      zoneCode: "PICK",
      zoneCodes: ["PICK"],
      locationTypeCode: "PICKFACE",
      locationTypeCodes: ["PICKFACE"],
      areaKey: "picking",
      areaLabel: "Picking",
      source: "live",
    },
    {
      id: "live:8:SKU-003",
      merchantSku: "SKU-003",
      productName: "Damaged Scanner",
      productBarcode: "BC-003",
      productCategory: "Hardware",
      productBrand: "DaChong",
      productDescription: "Returns cage scanner",
      productTags: ["DaChong", "Returns"],
      clients: [],
      shelf: "DEF-01",
      shelves: ["DEF-01"],
      inTransit: 0,
      pendingReceival: 0,
      toList: 0,
      orderAllocated: 0,
      availableStock: 0,
      defectiveProducts: 3,
      totalInventory: 3,
      listingTime: "2026-03-16",
      actualLength: "",
      actualWidth: "",
      actualHeight: "",
      actualWeight: "",
      measurementUnit: "EA",
      merchantCode: "MER-003",
      customerCode: "",
      warehouseName: "Overflow WH",
      stockStatus: "DEFECTIVE",
      stockStatuses: ["DEFECTIVE"],
      zoneCode: "DEF",
      zoneCodes: ["DEF"],
      locationTypeCode: "DEFECT",
      locationTypeCodes: ["DEFECT"],
      areaKey: "defect",
      areaLabel: "Defect",
      source: "live",
    },
  ],
  filterOptions: {
    warehouses: [
      { value: "Main WH", label: "Main WH" },
      { value: "Overflow WH", label: "Overflow WH" },
    ],
    tags: [
      { value: "DaChong", label: "DaChong" },
      { value: "Hardware", label: "Hardware" },
    ],
    clients: [{ value: "RTL-1", label: "Retail Client [RTL-1]" }],
    skus: [
      { value: "SKU-001", label: "SKU-001" },
      { value: "SKU-002", label: "SKU-002" },
      { value: "SKU-003", label: "SKU-003" },
    ],
  },
};

describe("InventoryBalancesPage", () => {
  beforeEach(() => {
    apiGetMock.mockResolvedValue(inventoryInformationResponse);
  });

  afterEach(() => {
    apiGetMock.mockReset();
  });

  test("renders backend-driven inventory information with visible filters and area tabs", async () => {
    const user = userEvent.setup();

    renderWithProviders(<InventoryBalancesPage />);

    expect(await screen.findByText("SKU-001")).toBeInTheDocument();
    expect(screen.getAllByText("Main WH").length).toBeGreaterThan(0);
    expect(screen.getByText("SKU-002")).toBeInTheDocument();
    expect(screen.getByText("SKU-003")).toBeInTheDocument();
    expect(screen.getByText("0 selected")).toBeInTheDocument();
    expect(screen.getByLabelText("In stock only")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Warehouse filter" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Client filter" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Product info field" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Product info" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Shelf" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Numeric column" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Minimum value" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Maximum value" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /All areas\(3\)/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Storage area\(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Picking area\(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Defective area\(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export queried rows" })).toBeInTheDocument();
    expect(apiGetMock).toHaveBeenCalledWith(
      "/api/v1/organizations/1/inventory/information/",
      expect.objectContaining({
        page: 1,
        page_size: 500,
        sortKey: "merchantSku",
        sortDirection: "asc",
      }),
    );

    await user.type(screen.getByRole("textbox", { name: "Product info" }), "SKU-002");

    await waitFor(() => {
      expect(screen.getByText("SKU-002")).toBeInTheDocument();
    });
    expect(screen.queryByText("SKU-001")).not.toBeInTheDocument();
    expect(screen.queryByText("SKU-003")).not.toBeInTheDocument();

    await user.clear(screen.getByRole("textbox", { name: "Product info" }));
    await user.click(screen.getByRole("tab", { name: /Picking area\(1\)/i }));

    await waitFor(() => {
      expect(screen.getByText("SKU-002")).toBeInTheDocument();
    });
    expect(screen.queryByText("SKU-001")).not.toBeInTheDocument();
    expect(screen.queryByText("SKU-003")).not.toBeInTheDocument();

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
    expect(screen.getByDisplayValue("4")).toBeInTheDocument();
    expect(screen.getAllByText("Label Printer").length).toBeGreaterThan(0);
  });

  test("uses the standard sticky-table page chrome collapse interaction", async () => {
    renderWithProviders(<InventoryBalancesPage />);

    expect(await screen.findByText("SKU-001")).toBeInTheDocument();
    expect(screen.getByTestId("inventory-information-page-chrome")).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByTestId("inventory-information-page-chrome")).toHaveAttribute("data-collapse-progress", "0.00");

    const tableScrollRegion = screen.getByRole("table").parentElement;
    expect(tableScrollRegion).not.toBeNull();

    fireEvent.scroll(tableScrollRegion!, { target: { scrollTop: 80 } });

    await waitFor(() => {
      expect(Number(screen.getByTestId("inventory-information-page-chrome").getAttribute("data-collapse-progress"))).toBeGreaterThan(0);
    });

    expect(screen.getByTestId("inventory-information-page-chrome")).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByLabelText("In stock only")).toBeInTheDocument();

    fireEvent.scroll(tableScrollRegion!, { target: { scrollTop: 220 } });

    await waitFor(() => {
      expect(screen.getByTestId("inventory-information-page-chrome")).toHaveAttribute("aria-hidden", "true");
    });

    expect(Number(screen.getByTestId("inventory-information-page-chrome").getAttribute("data-collapse-progress"))).toBeGreaterThanOrEqual(0.98);

    fireEvent.scroll(tableScrollRegion!, { target: { scrollTop: 0 } });

    await waitFor(() => {
      expect(screen.getByTestId("inventory-information-page-chrome")).toHaveAttribute("aria-hidden", "false");
    });
  });

  test("renders combined stock status labels without treating the joined text as a translation key", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    apiGetMock.mockResolvedValueOnce({
      ...inventoryInformationResponse,
      results: [
        {
          ...inventoryInformationResponse.results[0],
          stockStatus: "AVAILABLE",
          stockStatuses: ["AVAILABLE", "DAMAGED"],
        },
      ],
    });

    renderWithProviders(<InventoryBalancesPage />);

    expect(await screen.findByText("Available, Damaged")).toBeInTheDocument();
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      'Missing translation key "Available, Damaged" for locale "en".',
    );

    consoleErrorSpy.mockRestore();
  });
});
