import { screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { InterwarehouseTransferFilters } from "@/features/inventory/view/components/InterwarehouseTransferFilters";
import { renderWithProviders } from "@/test/render";

test("renders inter-warehouse transfer status tabs and translated filter copy", () => {
  window.localStorage.setItem(
    "dachongwms.ui-preferences",
    JSON.stringify({ locale: "zh-CN", themeMode: "light" }),
  );

  renderWithProviders(
    <InterwarehouseTransferFilters
      activeBucket="all"
      activeFilterCount={2}
      bucketItems={[
        { count: 4, label: "All", value: "all" },
        { count: 2, label: "Pending", value: "pending" },
        { count: 1, label: "Pending Stock-in", value: "pending_stock_in" },
      ]}
      filters={{
        dateField: "create_time",
        dateFrom: "",
        dateTo: "",
        fromWarehouseId: "",
        searchField: "transfer_number",
        searchMode: "contains",
        searchText: "",
        toWarehouseId: "",
        transferType: "",
      }}
      hasActiveFilters
      onBucketChange={vi.fn()}
      onChange={vi.fn()}
      onReset={vi.fn()}
      transferTypes={[
        { label: "Transfer Type", value: "" },
        { label: "Cross warehouse", value: "CROSS_WAREHOUSE" },
      ]}
      warehouses={[]}
    />,
  );

  expect(screen.getByRole("tab", { name: "全部(4)" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "待处理(2)" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "待入库(1)" })).toBeInTheDocument();
  expect(screen.getByText("已启用 2 个筛选条件")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("搜索内容")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "重置" })).toBeInTheDocument();
});
