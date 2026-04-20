import { expect, test } from "vitest";

import { hasAnyPermission, hasEveryPermissionGroup, permissionCodes } from "@/shared/utils/permissions";

test("sessions can access surfaces when they include any required permission", () => {
  expect(
    hasAnyPermission(
      {
        username: "demo@example.com",
        openid: "demo-org",
        operatorId: 1,
        operatorName: "Demo Owner",
        operatorRole: "Owner",
        permissionCodes: [permissionCodes.VIEW_FEES],
      },
      [permissionCodes.VIEW_FEES, permissionCodes.VIEW_REPORTING],
    ),
  ).toBe(true);
});

test("sessions fail permission checks when none of the required permissions are granted", () => {
  expect(
    hasAnyPermission(
      {
        username: "staff@example.com",
        openid: "demo-org",
        operatorId: 2,
        operatorName: "Staff User",
        operatorRole: "Staff",
        permissionCodes: [permissionCodes.VIEW_INBOUND],
      },
      [permissionCodes.VIEW_FEES],
    ),
  ).toBe(false);
});

test("grouped permission checks require at least one permission from each group", () => {
  expect(
    hasEveryPermissionGroup(
      {
        username: "ops@example.com",
        openid: "demo-org",
        operatorId: 3,
        operatorName: "Ops User",
        operatorRole: "Supervisor",
        permissionCodes: [permissionCodes.VIEW_INBOUND, permissionCodes.VIEW_OUTBOUND],
      },
      [
        [permissionCodes.VIEW_INBOUND, permissionCodes.MANAGE_INBOUND_ORDERS],
        [permissionCodes.VIEW_OUTBOUND, permissionCodes.MANAGE_OUTBOUND_ORDERS],
      ],
    ),
  ).toBe(true);
});
