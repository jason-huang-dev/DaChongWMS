import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { ScanPutawayPanel } from "@/features/inbound/view/components/ScanPutawayPanel";
import { ScanReceivePanel } from "@/features/inbound/view/components/ScanReceivePanel";
import { installFetchMock, jsonResponse } from "@/test/fetch";
import { renderWithProviders } from "@/test/render";

function parseJsonBody(init?: RequestInit) {
  return JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
}

test("posts scan receive payloads and shows a success message", async () => {
  const user = userEvent.setup();
  const { queryClient } = renderWithProviders(<ScanReceivePanel />);
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

  installFetchMock((url, init) => {
    if (url.pathname === "/api/inbound/receipts/scan-receive/") {
      expect(init?.method).toBe("POST");
      expect(parseJsonBody(init)).toMatchObject({
        purchase_order_number: "PO-2001",
        receipt_number: "RCV-2001",
        receipt_location_barcode: "RECV-01",
        goods_barcode: "SKU-2001",
        received_qty: 4,
        stock_status: "AVAILABLE",
        unit_cost: 12.5,
      });
      return jsonResponse(
        {
          id: 10,
          asn: null,
          asn_number: null,
          purchase_order: 5,
          purchase_order_number: "PO-2001",
          warehouse: 1,
          warehouse_name: "Inbound WH",
          receipt_location: 3,
          receipt_location_code: "RECV-01",
          receipt_number: "RCV-2001",
          status: "RECEIVED",
          reference_code: "",
          notes: "",
          lines: [],
          received_by: "Tester",
          received_at: "2026-03-14T12:00:00Z",
          create_time: "2026-03-14 12:00:00",
          update_time: "2026-03-14 12:00:00",
        },
        { status: 201 },
      );
    }
    return undefined;
  });

  await user.type(screen.getByLabelText(/Purchase order number/i), "PO-2001");
  await user.type(screen.getByLabelText(/Receipt number/i), "RCV-2001");
  await user.type(screen.getByLabelText(/Receipt location barcode/i), "RECV-01");
  await user.type(screen.getByLabelText(/Goods barcode/i), "SKU-2001");
  await user.clear(screen.getByLabelText(/Received quantity/i));
  await user.type(screen.getByLabelText(/Received quantity/i), "4");
  await user.clear(screen.getByLabelText(/Unit cost/i));
  await user.type(screen.getByLabelText(/Unit cost/i), "12.5");
  await user.click(screen.getByRole("button", { name: /post scan receipt/i }));

  expect(await screen.findByText("Receipt RCV-2001 posted to RECV-01.")).toBeInTheDocument();
  await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(3));
});

test("posts scan putaway payloads and shows a success message", async () => {
  const user = userEvent.setup();
  const { queryClient } = renderWithProviders(<ScanPutawayPanel />);
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

  installFetchMock((url, init) => {
    if (url.pathname === "/api/inbound/putaway-tasks/scan-complete/") {
      expect(init?.method).toBe("POST");
      expect(parseJsonBody(init)).toMatchObject({
        task_number: "PT-3001",
        from_location_barcode: "RECV-01",
        to_location_barcode: "A-01-01",
        goods_barcode: "SKU-3001",
        lpn_barcode: "LPN-3001",
      });
      return jsonResponse({
        id: 4,
        receipt_line: 8,
        receipt_number: "RCV-3001",
        warehouse: 1,
        warehouse_name: "Inbound WH",
        goods: 55,
        goods_code: "SKU-3001",
        task_number: "PT-3001",
        from_location: 9,
        from_location_code: "RECV-01",
        to_location: 10,
        to_location_code: "A-01-01",
        quantity: "6.0000",
        stock_status: "AVAILABLE",
        lot_number: "",
        serial_number: "",
        status: "COMPLETED",
        assigned_to: null,
        assigned_to_name: "",
        completed_by: "Tester",
        completed_at: "2026-03-14T12:10:00Z",
        inventory_movement: 44,
        license_plate: null,
        license_plate_code: "LPN-3001",
        notes: "",
        create_time: "2026-03-14 12:00:00",
        update_time: "2026-03-14 12:10:00",
      });
    }
    return undefined;
  });

  await user.type(screen.getByLabelText(/Task number/i), "PT-3001");
  await user.type(screen.getByLabelText(/^Goods barcode/i), "SKU-3001");
  await user.type(screen.getByLabelText(/From-location barcode/i), "RECV-01");
  await user.type(screen.getByLabelText(/To-location barcode/i), "A-01-01");
  await user.type(screen.getByLabelText(/LPN barcode/i), "LPN-3001");
  await user.click(screen.getByRole("button", { name: /complete putaway/i }));

  expect(await screen.findByText("Putaway task PT-3001 completed to A-01-01.")).toBeInTheDocument();
  await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(3));
});
