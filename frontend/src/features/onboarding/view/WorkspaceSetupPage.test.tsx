import { screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { saveStoredSession } from "@/shared/storage/auth-storage";
import { installFetchMock, jsonResponse } from "@/test/fetch";
import { renderWithRouter } from "@/test/render";

function installAuthenticatedSetupMocks() {
  installFetchMock((url, init) => {
    if (url.pathname === "/api/staff/7/") {
      return jsonResponse({
        id: 7,
        staff_name: "Setup Owner",
        staff_type: "Owner",
        permission_codes: [
          "warehouse.add_warehouse",
          "locations.manage_location_topology",
        ],
        check_code: 8888,
        create_time: "2026-04-21 09:00:00",
        update_time: "2026-04-21 09:00:00",
        error_check_code_counter: 0,
        is_lock: false,
      });
    }
    if (url.pathname === "/api/v1/auth/onboarding/workspace-setup/") {
      expect(new Headers(init?.headers).get("TOKEN")).toBe("owner-token");
      return jsonResponse({
        is_required: true,
        can_manage_setup: true,
        warehouse_count: 0,
        storage_area_count: 0,
        location_type_count: 0,
        location_count: 0,
      });
    }
    return undefined;
  });
}

test("renders warehouse setup for authenticated owners without topology", async () => {
  saveStoredSession({
    username: "setup-owner",
    openid: "setup-org",
    token: "owner-token",
    operatorId: 7,
    operatorName: "",
    operatorRole: "",
    membershipId: 11,
    companyId: 3,
  });
  installAuthenticatedSetupMocks();

  renderWithRouter(["/onboarding/warehouse-setup"]);

  expect(await screen.findByText("Set up your warehouse")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Create warehouse setup" })).toBeInTheDocument();
  expect(screen.getByText("This will create 24 shelf locations in the first storage area.")).toBeInTheDocument();
});
