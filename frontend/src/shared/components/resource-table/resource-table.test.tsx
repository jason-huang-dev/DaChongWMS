import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test } from "vitest";

import { ResourceTable, type ResourceTableColumnDefinition } from "@/shared/components/resource-table";
import { renderWithProviders } from "@/test/render";

interface TestRow {
  id: number;
  name: string;
  status: string;
}

const columns: Array<ResourceTableColumnDefinition<TestRow>> = [
  {
    header: "Name",
    key: "name",
    render: (row) => row.name,
    width: 180,
  },
  {
    header: "Status",
    key: "status",
    render: (row) => row.status,
    width: 140,
  },
];

const rows: TestRow[] = [
  { id: 1, name: "Alpha", status: "Open" },
];

beforeEach(() => {
  window.localStorage.clear();
});

test("persists resource table column visibility using the provided storage key", async () => {
  const user = userEvent.setup();
  const { rerender } = renderWithProviders(
    <ResourceTable
      allowHorizontalScroll
      columnVisibility={{ storageKey: "resource-table.test" }}
      columns={columns}
      getRowId={(row) => row.id}
      rows={rows}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Configure columns" }));
  await user.click(screen.getByRole("button", { name: "Status" }));
  await user.keyboard("{Escape}");

  expect(screen.queryByRole("columnheader", { name: "Status" })).not.toBeInTheDocument();

  rerender(
    <ResourceTable
      allowHorizontalScroll
      columnVisibility={{ storageKey: "resource-table.test" }}
      columns={columns}
      getRowId={(row) => row.id}
      rows={rows}
    />,
  );

  expect(screen.queryByRole("columnheader", { name: "Status" })).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Configure columns" }));
  await user.click(screen.getByRole("button", { name: "Restore default" }));
  await user.keyboard("{Escape}");

  expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
});
