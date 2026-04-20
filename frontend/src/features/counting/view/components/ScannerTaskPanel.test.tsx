import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { ScannerTaskPanel } from "@/features/counting/view/components/ScannerTaskPanel";
import type { NextCountTaskRecord } from "@/shared/types/domain";
import { installFetchMock, jsonResponse } from "@/test/fetch";
import { renderWithProviders } from "@/test/render";

const task: NextCountTaskRecord = {
  id: 77,
  cycle_count: 9,
  line_number: 3,
  location_code: "A-02-01",
  goods_code: "SKU-7700",
  stock_status: "AVAILABLE",
  system_qty: null,
  counted_qty: null,
  variance_qty: "0.0000",
  status: "OPEN",
  assigned_to_name: "Counter One",
  recount_assigned_to_name: "",
  scanner_task_type: "COUNT",
  scanner_task_status: "PENDING",
  scanner_task_last_operator: "",
  adjustment_reason_code: null,
  counted_at: null,
  recounted_at: null,
  notes: "",
  update_time: "2026-03-14 14:00:00",
  task_type: "COUNT",
};

function buildLine(overrides: Partial<NextCountTaskRecord> = {}) {
  return {
    ...task,
    ...overrides,
  };
}

function parseJsonBody(init?: RequestInit) {
  return JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
}

test("runs scanner ack, start, and complete actions from the handheld panel", async () => {
  const user = userEvent.setup();
  const { queryClient } = renderWithProviders(<ScannerTaskPanel errorMessage={null} isLoading={false} task={task} />);
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

  installFetchMock((url, init) => {
    if (url.pathname === "/api/counting/cycle-count-lines/77/scanner-ack/") {
      expect(init?.method).toBe("POST");
      return jsonResponse(buildLine({ scanner_task_status: "ACKNOWLEDGED", scanner_task_last_operator: "Counter One" }));
    }
    if (url.pathname === "/api/counting/cycle-count-lines/77/scanner-start/") {
      expect(init?.method).toBe("POST");
      return jsonResponse(buildLine({ scanner_task_status: "IN_PROGRESS", scanner_task_last_operator: "Counter One" }));
    }
    if (url.pathname === "/api/counting/cycle-count-lines/77/scanner-complete/") {
      expect(init?.method).toBe("POST");
      expect(parseJsonBody(init)).toMatchObject({
        counted_qty: 6,
        adjustment_reason_code: "COUNT_VAR",
        notes: "Scanner complete",
      });
      return jsonResponse(
        buildLine({
          status: "COUNTED",
          counted_qty: "6.0000",
          variance_qty: "1.0000",
          scanner_task_status: "COMPLETED",
          scanner_task_last_operator: "Counter One",
        }),
      );
    }
    return undefined;
  });

  await user.click(screen.getByRole("button", { name: /acknowledge/i }));
  expect(await screen.findByText("Scanner task acknowledged for SKU-7700.")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /^start$/i }));
  expect(await screen.findByText("Scanner task started at A-02-01.")).toBeInTheDocument();

  await user.clear(screen.getByLabelText(/Counted quantity/i));
  await user.type(screen.getByLabelText(/Counted quantity/i), "6");
  await user.type(screen.getByLabelText(/Adjustment reason code/i), "COUNT_VAR");
  await user.type(screen.getByLabelText(/Notes/i), "Scanner complete");
  await user.click(screen.getByRole("button", { name: /complete scanner count/i }));

  expect(await screen.findByText("Scanner task completed with counted quantity 6.")).toBeInTheDocument();
  await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(9));
});
