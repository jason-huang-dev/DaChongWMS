import { screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import {
  InventoryAdjustmentFilters,
  type InventoryAdjustmentViewFilters,
} from "@/features/inventory/view/components/InventoryAdjustmentFilters";
import { renderWithProviders } from "@/test/render";

const filters: InventoryAdjustmentViewFilters = {
  adjustmentType: "",
  dateFrom: "2026-04-10",
  dateTo: "2026-04-10",
  matchMode: "",
  searchField: "merchantSku",
  searchText: "demo",
};

describe("InventoryAdjustmentFilters", () => {
  test("renders the adjustment controls across primary and search rows", () => {
    const { container } = renderWithProviders(
      <InventoryAdjustmentFilters
        filters={filters}
        onChange={vi.fn()}
        onWarehouseChange={vi.fn()}
        warehouseId={7}
        warehouses={[
          {
            create_time: "2026-04-10T00:00:00Z",
            creator: "tester",
            id: 7,
            update_time: "2026-04-10T00:00:00Z",
            warehouse_address: "123 Demo Street",
            warehouse_city: "Newark",
            warehouse_contact: "ops@example.com",
            warehouse_manager: "Manager A",
            warehouse_name: "Main Warehouse",
          },
          {
            create_time: "2026-04-10T00:00:00Z",
            creator: "tester",
            id: 8,
            update_time: "2026-04-10T00:00:00Z",
            warehouse_address: "456 Overflow Avenue",
            warehouse_city: "Jersey City",
            warehouse_contact: "overflow@example.com",
            warehouse_manager: "Manager B",
            warehouse_name: "Overflow Warehouse",
          },
        ]}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Warehouse" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Adjustment type" })).toBeInTheDocument();
    expect(screen.getByLabelText("Adjustment date from")).toBeInTheDocument();
    expect(screen.getByLabelText("Adjustment date to")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Adjustment search field" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Adjustment search text" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Adjustment match mode" })).toBeInTheDocument();

    expect(container.querySelector('[data-adjustment-filter-row="primary"]')).not.toBeNull();
    expect(container.querySelector('[data-adjustment-filter-row="search"]')).not.toBeNull();
  });
});
