import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { ScanPickPanel } from "@/features/outbound/view/components/ScanPickPanel";
import { ScanShipPanel } from "@/features/outbound/view/components/ScanShipPanel";
import { installFetchMock, jsonResponse } from "@/test/fetch";
import { renderWithProviders } from "@/test/render";

function parseJsonBody(init?: RequestInit) {
  return JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
}

test("posts scan pick payloads and shows a success message", async () => {
  const user = userEvent.setup();
  const { queryClient } = renderWithProviders(<ScanPickPanel />);
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

  installFetchMock((url, init) => {
    if (url.pathname === "/api/outbound/pick-tasks/scan-complete/") {
      expect(init?.method).toBe("POST");
      expect(parseJsonBody(init)).toMatchObject({
        task_number: "PK-4001",
        from_location_barcode: "A-01-01",
        goods_barcode: "SKU-4001",
        to_location_barcode: "STAGE-01",
      });
      return jsonResponse({
        id: 12,
        sales_order_line: 5,
        order_number: "SO-4001",
        warehouse: 1,
        warehouse_name: "Outbound WH",
        goods: 44,
        goods_code: "SKU-4001",
        task_number: "PK-4001",
        from_location: 3,
        from_location_code: "A-01-01",
        to_location: 4,
        to_location_code: "STAGE-01",
        quantity: "3.0000",
        stock_status: "AVAILABLE",
        lot_number: "",
        serial_number: "",
        status: "COMPLETED",
        assigned_to: null,
        assigned_to_name: "",
        completed_by: "Tester",
        completed_at: "2026-03-14T13:00:00Z",
        inventory_movement: 14,
        license_plate: null,
        license_plate_code: "",
        notes: "",
        create_time: "2026-03-14 12:30:00",
        update_time: "2026-03-14 13:00:00",
      });
    }
    return undefined;
  });

  await user.type(screen.getByLabelText(/Task number/i), "PK-4001");
  await user.type(screen.getByLabelText(/^Goods barcode/i), "SKU-4001");
  await user.type(screen.getByLabelText(/From-location barcode/i), "A-01-01");
  await user.type(screen.getByLabelText(/To-location barcode/i), "STAGE-01");
  await user.click(screen.getByRole("button", { name: /complete pick/i }));

  expect(await screen.findByText("Pick task PK-4001 completed for SKU-4001.")).toBeInTheDocument();
  await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(3));
});

test("posts scan ship payloads and shows a success message", async () => {
  const user = userEvent.setup();
  const { queryClient } = renderWithProviders(<ScanShipPanel />);
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

  installFetchMock((url, init) => {
    if (url.pathname === "/api/outbound/shipments/scan-ship/") {
      expect(init?.method).toBe("POST");
      expect(parseJsonBody(init)).toMatchObject({
        sales_order_number: "SO-5001",
        shipment_number: "SHP-5001",
        staging_location_barcode: "STAGE-01",
        goods_barcode: "SKU-5001",
        shipped_qty: 2,
        stock_status: "AVAILABLE",
        dock_location_barcode: "DOCK-01",
        trailer_reference: "TRAILER-5",
      });
      return jsonResponse(
        {
          id: 20,
          sales_order: 7,
          order_number: "SO-5001",
          warehouse: 1,
          warehouse_name: "Outbound WH",
          staging_location: 4,
          staging_location_code: "STAGE-01",
          shipment_number: "SHP-5001",
          status: "SHIPPED",
          reference_code: "",
          notes: "",
          lines: [],
          shipped_by: "Tester",
          shipped_at: "2026-03-14T13:10:00Z",
          create_time: "2026-03-14 13:00:00",
          update_time: "2026-03-14 13:10:00",
        },
        { status: 201 },
      );
    }
    return undefined;
  });

  await user.type(screen.getByLabelText(/Sales order number/i), "SO-5001");
  await user.type(screen.getByLabelText(/Shipment number/i), "SHP-5001");
  await user.type(screen.getByLabelText(/Staging location barcode/i), "STAGE-01");
  await user.type(screen.getByLabelText(/^Goods barcode/i), "SKU-5001");
  await user.clear(screen.getByLabelText(/Shipped quantity/i));
  await user.type(screen.getByLabelText(/Shipped quantity/i), "2");
  await user.type(screen.getByLabelText(/Dock location barcode/i), "DOCK-01");
  await user.type(screen.getByLabelText(/Trailer reference/i), "TRAILER-5");
  await user.click(screen.getByRole("button", { name: /post shipment/i }));

  expect(await screen.findByText("Shipment SHP-5001 posted for order SO-5001.")).toBeInTheDocument();
  await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(4));
});
