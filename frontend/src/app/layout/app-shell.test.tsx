import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";

import { AppShell } from "@/app/layout/app-shell";
import { renderWithProviders } from "@/test/render";

const useAuthMock = vi.fn();
const useTenantScopeMock = vi.fn();

vi.mock("@/features/auth/controller/useAuthController", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/app/scope-context", () => ({
  useTenantScope: () => useTenantScopeMock(),
}));

test("renders accessible module tabs with workspace and warehouse controls in the navbar", () => {
  useAuthMock.mockReturnValue({
    logout: vi.fn(),
    session: {
      membershipId: 1,
      openid: "tenant-openid",
      operatorId: 11,
      operatorName: "Route Tester",
      operatorRole: "Manager",
      token: "token-1",
      username: "manager",
    },
  });
  useTenantScopeMock.mockReturnValue({
    activeMembershipId: 1,
    activeWarehouse: {
      create_time: "2026-03-21T00:00:00Z",
      creator: "Route Tester",
      id: 1,
      update_time: "2026-03-21T00:00:00Z",
      warehouse_address: "1 Dock Way",
      warehouse_city: "New York",
      warehouse_contact: "Dock Lead",
      warehouse_manager: "Ops Manager",
      warehouse_name: "Main WH",
    },
    activeWarehouseId: 1,
    company: {
      description: "Primary workspace",
      id: 1,
      label: "DaChong WMS",
      openid: "tenant-openid",
    },
    memberships: [
      {
        can_manage_users: true,
        check_code: 8888,
        company_code: "DCWMS",
        company_description: "Primary workspace",
        company_id: 1,
        company_name: "DaChong WMS",
        company_openid: "tenant-openid",
        create_time: "2026-03-21T00:00:00Z",
        default_warehouse: 1,
        default_warehouse_name: "Main WH",
        email: "manager@example.com",
        id: 1,
        is_active: true,
        is_company_admin: true,
        is_current: true,
        is_lock: false,
        last_selected_at: "2026-03-21T00:00:00Z",
        profile_token: "token-1",
        staff_id: 11,
        staff_name: "Route Tester",
        staff_type: "Manager",
        update_time: "2026-03-21T00:00:00Z",
        username: "manager",
      },
      {
        can_manage_users: false,
        check_code: 9999,
        company_code: "DCWMS-2",
        company_description: "Overflow workspace",
        company_id: 2,
        company_name: "DaChong East",
        company_openid: "tenant-openid-2",
        create_time: "2026-03-21T00:00:00Z",
        default_warehouse: 2,
        default_warehouse_name: "Overflow WH",
        email: "manager@example.com",
        id: 2,
        is_active: true,
        is_company_admin: false,
        is_current: false,
        is_lock: false,
        last_selected_at: "2026-03-21T00:00:00Z",
        profile_token: "token-2",
        staff_id: 11,
        staff_name: "Route Tester",
        staff_type: "Supervisor",
        update_time: "2026-03-21T00:00:00Z",
        username: "manager",
      },
    ],
    setActiveWarehouseId: vi.fn(),
    switchMembership: vi.fn(),
    warehouses: [
      {
        create_time: "2026-03-21T00:00:00Z",
        creator: "Route Tester",
        id: 1,
        update_time: "2026-03-21T00:00:00Z",
        warehouse_address: "1 Dock Way",
        warehouse_city: "New York",
        warehouse_contact: "Dock Lead",
        warehouse_manager: "Ops Manager",
        warehouse_name: "Main WH",
      },
      {
        create_time: "2026-03-21T00:00:00Z",
        creator: "Route Tester",
        id: 2,
        update_time: "2026-03-21T00:00:00Z",
        warehouse_address: "9 Harbor Road",
        warehouse_city: "Jersey City",
        warehouse_contact: "Backup Lead",
        warehouse_manager: "Ops Manager",
        warehouse_name: "Overflow WH",
      },
    ],
    warehousesQuery: {
      data: undefined,
      error: null,
      fetchStatus: "idle",
      isError: false,
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
      isInitialLoading: false,
      isLoading: false,
      isLoadingError: false,
      isPaused: false,
      isPending: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: false,
      isSuccess: true,
      refetch: vi.fn(),
      status: "success",
    },
  });
  const router = createMemoryRouter(
    [
      {
        element: <AppShell />,
        children: [
          {
            element: <h1>Dashboard content</h1>,
            handle: { crumb: "Dashboard" },
            path: "/dashboard",
          },
        ],
      },
    ],
    { initialEntries: ["/dashboard"] },
  );

  renderWithProviders(<RouterProvider router={router} />);

  const primaryNavigation = screen.getByRole("tablist", { name: "Primary navigation" });
  expect(within(primaryNavigation).getByRole("tab", { name: "Dashboard" })).toBeInTheDocument();
  expect(within(primaryNavigation).getByRole("tab", { name: "Inventory" })).toBeInTheDocument();
  expect(within(primaryNavigation).getByRole("tab", { name: "Clients" })).toBeInTheDocument();
  expect(within(primaryNavigation).getByRole("tab", { name: "Logistics" })).toBeInTheDocument();
  expect(within(primaryNavigation).getByRole("tab", { name: "Finance" })).toBeInTheDocument();
  expect(within(primaryNavigation).getByRole("tab", { name: "Security" })).toBeInTheDocument();

  const navbarContext = screen.getByTestId("navbar-context-switcher");
  expect(within(navbarContext).getByRole("button", { name: "Workspace: DaChong WMS" })).toBeInTheDocument();
  expect(within(navbarContext).queryByRole("button", { name: "Warehouse: Main WH" })).not.toBeInTheDocument();
  expect(navbarContext).toHaveStyle({
    height: "32px",
    minHeight: "32px",
  });
  expect(screen.queryByRole("tablist", { name: "Open workspaces" })).not.toBeInTheDocument();
  expect(screen.getByAltText("DaChong brand logo")).toBeInTheDocument();
  expect(screen.getByTestId("top-info-bar")).toHaveStyle({
    height: "6px",
    maxHeight: "6px",
  });
  expect(screen.getByTestId("navbar-preferences-pill")).toHaveStyle({
    height: "32px",
    minHeight: "32px",
  });
  expect(screen.getByTestId("navbar-profile-pill")).toHaveStyle({
    height: "32px",
    minHeight: "32px",
  });
  expect(screen.getByRole("heading", { name: "Dashboard content" })).toBeInTheDocument();
});

test("opens workspace options from the navbar context block", async () => {
  const user = userEvent.setup();

  useAuthMock.mockReturnValue({
    logout: vi.fn(),
    session: {
      membershipId: 1,
      openid: "tenant-openid",
      operatorId: 11,
      operatorName: "Route Tester",
      operatorRole: "Manager",
      token: "token-1",
      username: "manager",
    },
  });
  useTenantScopeMock.mockReturnValue({
    activeMembershipId: 1,
    activeWarehouse: null,
    activeWarehouseId: 1,
    company: {
      description: "Primary workspace",
      id: 1,
      label: "DaChong WMS",
      openid: "tenant-openid",
    },
    memberships: [
      {
        can_manage_users: true,
        check_code: 8888,
        company_code: "DCWMS",
        company_description: "Primary workspace",
        company_id: 1,
        company_name: "DaChong WMS",
        company_openid: "tenant-openid",
        create_time: "2026-03-21T00:00:00Z",
        default_warehouse: 1,
        default_warehouse_name: "Main WH",
        email: "manager@example.com",
        id: 1,
        is_active: true,
        is_company_admin: true,
        is_current: true,
        is_lock: false,
        last_selected_at: "2026-03-21T00:00:00Z",
        profile_token: "token-1",
        staff_id: 11,
        staff_name: "Route Tester",
        staff_type: "Manager",
        update_time: "2026-03-21T00:00:00Z",
        username: "manager",
      },
      {
        can_manage_users: false,
        check_code: 9999,
        company_code: "DCWMS-2",
        company_description: "Overflow workspace",
        company_id: 2,
        company_name: "DaChong East",
        company_openid: "tenant-openid-2",
        create_time: "2026-03-21T00:00:00Z",
        default_warehouse: 2,
        default_warehouse_name: "Overflow WH",
        email: "manager@example.com",
        id: 2,
        is_active: true,
        is_company_admin: false,
        is_current: false,
        is_lock: false,
        last_selected_at: "2026-03-21T00:00:00Z",
        profile_token: "token-2",
        staff_id: 11,
        staff_name: "Route Tester",
        staff_type: "Supervisor",
        update_time: "2026-03-21T00:00:00Z",
        username: "manager",
      },
    ],
    setActiveWarehouseId: vi.fn(),
    switchMembership: vi.fn(),
    warehouses: [
      {
        create_time: "2026-03-21T00:00:00Z",
        creator: "Route Tester",
        id: 1,
        update_time: "2026-03-21T00:00:00Z",
        warehouse_address: "1 Dock Way",
        warehouse_city: "New York",
        warehouse_contact: "Dock Lead",
        warehouse_manager: "Ops Manager",
        warehouse_name: "Main WH",
      },
      {
        create_time: "2026-03-21T00:00:00Z",
        creator: "Route Tester",
        id: 2,
        update_time: "2026-03-21T00:00:00Z",
        warehouse_address: "9 Harbor Road",
        warehouse_city: "Jersey City",
        warehouse_contact: "Backup Lead",
        warehouse_manager: "Ops Manager",
        warehouse_name: "Overflow WH",
      },
    ],
    warehousesQuery: {
      data: undefined,
      error: null,
      fetchStatus: "idle",
      isError: false,
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
      isInitialLoading: false,
      isLoading: false,
      isLoadingError: false,
      isPaused: false,
      isPending: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: false,
      isSuccess: true,
      refetch: vi.fn(),
      status: "success",
    },
  });

  const router = createMemoryRouter(
    [
      {
        element: <AppShell />,
        children: [
          {
            element: <h1>Dashboard content</h1>,
            handle: { crumb: "Dashboard" },
            path: "/dashboard",
          },
        ],
      },
    ],
    { initialEntries: ["/dashboard"] },
  );

  renderWithProviders(<RouterProvider router={router} />);

  await user.click(screen.getByRole("button", { name: "Workspace: DaChong WMS" }));
  expect(await screen.findByText("DaChong East")).toBeInTheDocument();
});
