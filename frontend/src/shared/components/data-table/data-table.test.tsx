import { screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { DataTable, type DataTableColumnDefinition } from "@/shared/components/data-table";
import { renderWithProviders } from "@/test/render";

interface TestRow {
  id: number;
  name: string;
}

const columns: DataTableColumnDefinition<TestRow>[] = [
  {
    header: "Name",
    key: "name",
    render: (row) => row.name,
    width: 220,
  },
];

const rows: TestRow[] = [
  { id: 1, name: "Alpha" },
  { id: 2, name: "Beta" },
];

test("supports sticky right columns for action rails", () => {
  renderWithProviders(
    <div style={{ height: 320, width: 320 }}>
      <DataTable
        columns={[
          ...columns,
          {
            header: "Actions",
            key: "actions",
            render: () => "Open",
            sticky: "right",
            width: 96,
          },
        ]}
        fillHeight
        getRowId={(row) => row.id}
        rows={rows}
        stickyHeader
      />
    </div>,
  );

  const actionsHeader = screen.getByRole("columnheader", { name: "Actions" });
  const actionsCell = screen.getAllByText("Open")[0].closest("td");

  expect(actionsHeader).toHaveAttribute("data-sticky-column", "right");
  expect(actionsHeader).toHaveStyle({ position: "sticky", right: "0px" });
  expect(actionsCell).not.toBeNull();
  expect(actionsCell).toHaveAttribute("data-sticky-column", "right");
  expect(actionsCell).toHaveStyle({ position: "sticky", right: "0px" });
});

test("renders the inner toolbar above the scrollable table region and keeps pagination outside it", () => {
  const { container } = renderWithProviders(
    <div style={{ height: 420 }}>
      <DataTable
        columns={columns}
        fillHeight
        getRowId={(row) => row.id}
        pagination={{
          onPageChange: vi.fn(),
          page: 1,
          pageSize: 10,
          total: 25,
        }}
        rows={rows}
        stickyHeader
        toolbar={<div>Bulk actions</div>}
        toolbarPlacement="inner"
      />
    </div>,
  );

  const tableContainer = container.querySelector(".MuiTableContainer-root") as HTMLElement;
  const toolbar = screen.getByText("Bulk actions").parentElement as HTMLElement;
  const pagination = container.querySelector(".MuiTablePagination-root") as HTMLElement;

  expect(toolbar).toHaveStyle({
    borderBottomStyle: "solid",
    flex: "0 0 auto",
  });
  expect(tableContainer).toHaveStyle({
    overflowY: "auto",
  });
  expect(toolbar.compareDocumentPosition(tableContainer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(tableContainer.compareDocumentPosition(pagination) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("keeps selection and pagination behavior intact when using the bounded table layout", () => {
  renderWithProviders(
    <div style={{ height: 420 }}>
      <DataTable
        columns={columns}
        fillHeight
        getRowId={(row) => row.id}
        pagination={{
          onPageChange: vi.fn(),
          page: 1,
          pageSize: 10,
          total: 25,
        }}
        rowSelection={{
          onToggleAll: vi.fn(),
          onToggleRow: vi.fn(),
          selectedRowIds: [1],
        }}
        rows={rows}
        stickyHeader
      />
    </div>,
  );

  expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  expect(screen.getByText("1-10 of 25")).toBeInTheDocument();
});
