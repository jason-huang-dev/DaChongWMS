import { expect, test } from "vitest";

import { hasAnyRole } from "@/shared/utils/permissions";

test("owner sessions can access any role-gated surface", () => {
  expect(
    hasAnyRole(
      {
        username: "demo@example.com",
        openid: "demo-org",
        operatorId: 1,
        operatorName: "Demo Owner",
        operatorRole: "Owner",
      },
      ["Manager", "Finance"],
    ),
  ).toBe(true);
});

test("non-owner sessions still require an explicit matching role", () => {
  expect(
    hasAnyRole(
      {
        username: "staff@example.com",
        openid: "demo-org",
        operatorId: 2,
        operatorName: "Staff User",
        operatorRole: "Staff",
      },
      ["Manager", "Finance"],
    ),
  ).toBe(false);
});
