import { screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { StickyTableLayout } from "@/shared/components/sticky-table-layout";
import { renderWithProviders } from "@/test/render";

test("keeps page chrome in normal flow and bounds the table workspace with flex", () => {
  renderWithProviders(
    <StickyTableLayout
      pageChrome={<div>Page chrome</div>}
      table={<div>Table workspace</div>}
    />,
  );

  const chrome = screen.getByText("Page chrome");
  const workspace = screen.getByText("Table workspace").parentElement as HTMLElement;

  expect(chrome.parentElement).not.toBeNull();
  expect(workspace).toHaveStyle({
    display: "flex",
    flex: "1 1 auto",
    minHeight: "0",
    overflow: "hidden",
  });
});

test("continues to support the legacy filters prop", () => {
  renderWithProviders(
    <StickyTableLayout
      filters={<div>Filters</div>}
      table={<div>Table workspace</div>}
    />,
  );

  expect(screen.getByText("Filters")).toBeInTheDocument();
  expect(screen.getByText("Table workspace")).toBeInTheDocument();
});
