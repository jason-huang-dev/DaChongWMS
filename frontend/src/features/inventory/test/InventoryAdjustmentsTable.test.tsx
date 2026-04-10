import { screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import type { InventoryAdjustmentGroupRow } from "@/features/inventory/model/types";
import { InventoryAdjustmentsTable } from "@/features/inventory/view/components/InventoryAdjustmentsTable";
import { renderWithProviders } from "@/test/render";

const groups: InventoryAdjustmentGroupRow[] = [
  {
    adjustmentNumber: "AD5ZG110658",
    id: "AD5ZG110658",
    items: [
      {
        adjustmentTypeLabel: "Good Product Adjustment",
        goodsCode: "5ZG00112",
        id: 301,
        lotNumber: "LOT-001",
        occurredAt: "2026-04-09T05:43:12Z",
        performedBy: "Fujian Linsen Media",
        productName: "03-CSKJ-5124-BLACK-46",
        quantity: 1,
        serialNumber: "",
        shelfCode: "01",
        signedQuantity: -1,
      },
      {
        adjustmentTypeLabel: "Good Product Adjustment",
        goodsCode: "5ZG00304",
        id: 302,
        lotNumber: "LOT-002",
        occurredAt: "2026-04-09T05:43:12Z",
        performedBy: "Fujian Linsen Media",
        productName: "QIC-MLQ528-130",
        quantity: 2,
        serialNumber: "",
        shelfCode: "01",
        signedQuantity: -2,
      },
    ],
    latestOccurredAt: "2026-04-09T05:43:12Z",
    note: "Recount variance",
    warehouseName: "NJ",
  },
];

describe("InventoryAdjustmentsTable", () => {
  test("renders grouped detail rows in a shared grid without fixed per-line heights", () => {
    const { container } = renderWithProviders(
      <div style={{ height: 640, width: 1600 }}>
        <InventoryAdjustmentsTable
          activeFilterCount={0}
          groups={groups}
          isLoading={false}
          onClearSelection={vi.fn()}
          onExport={vi.fn()}
          onOpenCreate={vi.fn()}
          onPageChange={vi.fn()}
          onRefresh={vi.fn()}
          onResetFilters={vi.fn()}
          page={1}
          pageSize={20}
          rowSelection={{
            onToggleAll: vi.fn(),
            onToggleRow: vi.fn(),
            selectedRowIds: [],
          }}
          selectedCount={0}
          total={groups.length}
        />
      </div>,
    );

    expect(screen.getByText("5ZG00112")).toBeInTheDocument();
    expect(screen.getByText("5ZG00304")).toBeInTheDocument();
    expect(screen.getAllByText("Good Product Adjustment")).toHaveLength(2);

    const grid = container.querySelector('[data-adjustment-grid="true"]');
    expect(grid).not.toBeNull();
    expect(grid).toHaveStyle({
      display: "grid",
      gridTemplateColumns: "28% 20% 8% 12% 16% 16%",
    });

    for (const column of ["product", "type", "shelf", "quantity", "operator", "time"]) {
      const lineItems = container.querySelectorAll(`[data-adjustment-grid-column="${column}"]`);

      expect(lineItems).toHaveLength(groups[0].items.length);
      lineItems.forEach((lineItem, index) => {
        expect(lineItem).toHaveAttribute("data-adjustment-grid-row", String(index));
        expect(lineItem).not.toHaveStyle({ height: "96px" });
      });
    }
  });
});
