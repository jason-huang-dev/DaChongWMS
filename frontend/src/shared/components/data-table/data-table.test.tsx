import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  const toolbar = screen.getByText("Bulk actions");
  const pagination = container.querySelector(".MuiTablePagination-root") as HTMLElement;

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

test("supports column visibility controls without breaking the rendered table", async () => {
  const user = userEvent.setup();

  renderWithProviders(
    <div style={{ height: 320, width: 360 }}>
      <DataTable
        columns={[
          ...columns,
          {
            header: "Actions",
            key: "actions",
            render: () => "Open",
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

  await user.click(screen.getByRole("button", { name: "Configure columns" }));
  await user.click(screen.getByRole("button", { name: "Actions" }));
  await user.keyboard("{Escape}");

  expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
  expect(screen.queryByText("Open")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Configure columns" }));
  await user.click(screen.getByRole("button", { name: "Restore default" }));
  await user.keyboard("{Escape}");

  expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
  expect(screen.getAllByText("Open")).toHaveLength(2);
});

test("supports reordering columns from the shared column configuration control", async () => {
  const user = userEvent.setup();

  renderWithProviders(
    <div style={{ height: 320, width: 420 }}>
      <DataTable
        columns={[
          ...columns,
          {
            header: "Code",
            key: "code",
            render: (row) => `SKU-${row.id}`,
            width: 140,
          },
        ]}
        fillHeight
        getRowId={(row) => row.id}
        rows={rows}
        stickyHeader
      />
    </div>,
  );

  expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Name", "Code"]);

  await user.click(screen.getByRole("button", { name: "Configure columns" }));
  await user.click(screen.getByRole("button", { name: "Move Code earlier" }));
  await user.keyboard("{Escape}");

  expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Code", "Name"]);

  await user.click(screen.getByRole("button", { name: "Configure columns" }));
  await user.click(screen.getByRole("button", { name: "Restore default" }));
  await user.keyboard("{Escape}");

  expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Name", "Code"]);
});
