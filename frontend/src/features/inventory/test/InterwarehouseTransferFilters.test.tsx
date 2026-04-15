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
  expect(screen.queryByText("已启用 2 个筛选条件")).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText("搜索内容")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "重置" })).toBeInTheDocument();
});

test("can hide inter-warehouse-only filters for the internal move workspace", () => {
  renderWithProviders(
    <InterwarehouseTransferFilters
      activeBucket="all"
      bucketItems={[{ count: 1, label: "All", value: "all" }]}
      compact
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
      hasActiveFilters={false}
      onBucketChange={vi.fn()}
      onChange={vi.fn()}
      onReset={vi.fn()}
      showToWarehouseFilter={false}
      showTransferTypeFilter={false}
      statusBucketsAriaLabel="Internal move status buckets"
      transferTypes={[{ label: "Transfer Type", value: "" }]}
      warehouses={[]}
    />,
  );

  expect(screen.getByRole("tablist", { name: "Internal move status buckets" })).toBeInTheDocument();
  expect(screen.queryByText("0 active filters")).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "To Warehouse" })).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "Transfer Type" })).not.toBeInTheDocument();
});
