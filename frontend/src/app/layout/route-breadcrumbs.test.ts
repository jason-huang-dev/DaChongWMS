import { expect, test } from "vitest";

import { resolveRouteBreadcrumbsLayout } from "@/app/layout/route-breadcrumbs-layout";

test("shows every breadcrumb when the measured widths fit the container", () => {
  const entries = ["Dashboard", "Inventory information", "Stock Age Report"];
  const widths: Record<string, number> = {
    Dashboard: 88,
    "Inventory information": 160,
    "Stock Age Report": 140,
  };

  const result = resolveRouteBreadcrumbsLayout({
    containerWidth: 430,
    entries,
    getEntryWidth: (entry) => widths[entry] ?? 0,
    getOverflowWidth: () => 60,
    separatorWidth: 18,
  });

  expect(result.visibleEntries).toEqual(entries);
  expect(result.hiddenEntries).toEqual([]);
});

test("collapses trailing breadcrumbs into a single overflow trigger when space runs out", () => {
  const entries = ["Inventory information", "Dashboard", "History 1", "History 2", "History 3"];
  const widths: Record<string, number> = {
    "Inventory information": 147,
    Dashboard: 112,
    "History 1": 120,
    "History 2": 120,
    "History 3": 120,
  };

  const result = resolveRouteBreadcrumbsLayout({
    containerWidth: 470,
    entries,
    getEntryWidth: (entry) => widths[entry] ?? 0,
    getOverflowWidth: () => 60,
    separatorWidth: 18,
  });

  expect(result.visibleEntries).toEqual(["Inventory information", "Dashboard"]);
  expect(result.hiddenEntries).toEqual(["History 1", "History 2", "History 3"]);
});

test("keeps the first breadcrumb visible when only it and the overflow trigger fit", () => {
  const entries = ["Inventory information", "Dashboard", "History 1"];
  const widths: Record<string, number> = {
    "Inventory information": 147,
    Dashboard: 112,
    "History 1": 120,
  };

  const result = resolveRouteBreadcrumbsLayout({
    containerWidth: 240,
    entries,
    getEntryWidth: (entry) => widths[entry] ?? 0,
    getOverflowWidth: () => 60,
    separatorWidth: 18,
  });

  expect(result.visibleEntries).toEqual(["Inventory information"]);
  expect(result.hiddenEntries).toEqual(["Dashboard", "History 1"]);
});
